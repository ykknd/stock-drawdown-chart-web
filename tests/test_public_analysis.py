from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient

from stock_drawdown_app import (
    MemoryPublicAnalysisStore,
    PricePoint,
    PublicAnalysisSnapshot,
    SecurityInfo,
    RankedSecurity,
    PUBLIC_ANALYSIS_LIVE_KEY,
    build_public_analysis_universe,
    calculate_current_drawdown_metrics,
    create_app,
    is_public_analysis_snapshot_stale,
    publish_public_analysis_snapshot,
    public_analysis_staged_key,
    refresh_public_analysis_snapshot,
)


def price_points(values: list[float]) -> list[PricePoint]:
    return [
        PricePoint(
            date=f"2026-06-0{index + 1}",
            price=value,
            open=value,
            high=value,
            low=value,
            close=value,
        )
        for index, value in enumerate(values)
    ]


def test_calculate_current_drawdown_metrics_unrecovered_decline():
    metrics = calculate_current_drawdown_metrics(price_points([100.0, 95.0, 90.0]))

    assert metrics.peak_date == "2026-06-01"
    assert metrics.trough_date == "2026-06-03"
    assert metrics.latest_price_date == "2026-06-03"
    assert metrics.current_drawdown_pct == 0.1
    assert metrics.current_drawdown_days == 2
    assert metrics.recovery_progress_pct == 0.0
    assert metrics.status == "in_progress"


def test_calculate_current_drawdown_metrics_partial_recovery():
    metrics = calculate_current_drawdown_metrics(price_points([100.0, 80.0, 90.0]))

    assert metrics.current_drawdown_pct == 0.1
    assert metrics.current_drawdown_days == 2
    assert metrics.recovery_progress_pct == 0.5
    assert metrics.status == "in_progress"


def test_calculate_current_drawdown_metrics_recovered():
    metrics = calculate_current_drawdown_metrics(price_points([100.0, 80.0, 100.0]))

    assert metrics.current_drawdown_pct == 0.0
    assert metrics.current_drawdown_days == 0
    assert metrics.recovery_progress_pct == 1.0
    assert metrics.status == "recovered"


def test_calculate_current_drawdown_metrics_new_high_and_flat():
    new_high = calculate_current_drawdown_metrics(price_points([100.0, 120.0]))
    flat = calculate_current_drawdown_metrics(price_points([100.0, 100.0, 100.0]))

    assert new_high.status == "recovered"
    assert new_high.current_drawdown_pct == 0.0
    assert flat.status == "recovered"
    assert flat.current_drawdown_pct == 0.0


def test_build_public_analysis_universe_intersects_only_nikkei_members():
    month, universe = build_public_analysis_universe(
        nikkei_constituents=[
            SecurityInfo(code="7203", name="トヨタ自動車"),
            SecurityInfo(code="6758", name="ソニーグループ"),
        ],
        market_cap_ranking=[
            RankedSecurity(universe_month="2026-05", rank=1, code="7203", name="トヨタ自動車"),
            RankedSecurity(universe_month="2026-05", rank=2, code="9984", name="ソフトバンクグループ"),
            RankedSecurity(universe_month="2026-05", rank=3, code="6758", name="ソニーグループ"),
        ],
        limit=100,
    )

    assert month == "2026-05"
    assert [security.code for security in universe] == ["7203", "6758"]


class FakeProvider:
    def __init__(self, by_symbol: dict[str, list[PricePoint]]) -> None:
        self.by_symbol = by_symbol

    def get_adjusted_close(self, symbol, period, custom_months=None, api_key=None, jquants_free_tier=True):
        assert period == "5y"
        return self.by_symbol[symbol]

    def get_security_name(self, symbol, api_key=None):
        return symbol


def test_refresh_public_analysis_snapshot_stages_data_without_market_cap_fields():
    store = MemoryPublicAnalysisStore()
    provider = FakeProvider(
        {
            "7203.T": price_points([100.0, 90.0, 80.0]),
            "6758.T": price_points([100.0, 80.0, 90.0]),
        }
    )

    snapshot = refresh_public_analysis_snapshot(
        store=store,
        provider=provider,
        nikkei_constituents=[
            SecurityInfo(code="7203", name="トヨタ自動車"),
            SecurityInfo(code="6758", name="ソニーグループ"),
        ],
        market_cap_ranking=[
            RankedSecurity(universe_month="2026-05", rank=1, code="7203", name="トヨタ自動車"),
            RankedSecurity(universe_month="2026-05", rank=2, code="6758", name="ソニーグループ"),
        ],
        generated_at="2026-06-08T18:00:00+09:00",
    )

    staged_payload = store.load(public_analysis_staged_key(snapshot.as_of_date))
    assert snapshot.item_count == 2
    assert staged_payload is not None
    assert "market_cap" not in str(staged_payload)
    assert staged_payload["items"][0]["code"] == "7203"


def test_public_analysis_snapshot_normalizes_percentage_point_values():
    snapshot = PublicAnalysisSnapshot.model_validate(
        {
            "as_of_date": "2026-06-09",
            "published_at": "2026-06-09T20:00:00+09:00",
            "provider": "yfinance",
            "universe_month": "2026-06",
            "item_count": 1,
            "items": [
                {
                    "code": "7203",
                    "name": "トヨタ自動車",
                    "current_drawdown_pct": 12.4,
                    "current_drawdown_days": 47,
                    "recovery_progress_pct": 68.2,
                    "peak_date": "2026-04-15",
                    "trough_date": "2026-05-20",
                    "latest_price_date": "2026-06-09",
                    "status": "in_progress",
                }
            ],
        }
    )

    item = snapshot.items[0]
    assert item.current_drawdown_pct == 0.124
    assert item.recovery_progress_pct == 0.682


def test_publish_public_analysis_snapshot_promotes_staged_version_and_keeps_live_when_missing():
    store = MemoryPublicAnalysisStore()
    staged = PublicAnalysisSnapshot(
        as_of_date="2026-06-08",
        published_at="2026-06-08T18:00:00+09:00",
        provider="yfinance",
        universe_month="2026-05",
        item_count=1,
        items=[],
    )
    store.save(public_analysis_staged_key("2026-06-08"), staged.model_dump())

    live = publish_public_analysis_snapshot(store=store, snapshot_date="2026-06-08", published_at="2026-06-08T20:00:00+09:00")
    assert live is not None
    assert store.load(PUBLIC_ANALYSIS_LIVE_KEY)["published_at"] == "2026-06-08T20:00:00+09:00"

    previous_live = store.load(PUBLIC_ANALYSIS_LIVE_KEY)
    missing = publish_public_analysis_snapshot(store=store, snapshot_date="2026-06-09", published_at="2026-06-09T20:00:00+09:00")
    assert missing is None
    assert store.load(PUBLIC_ANALYSIS_LIVE_KEY) == previous_live


def test_public_analysis_api_is_unauthenticated_and_reports_stale_flag():
    store = MemoryPublicAnalysisStore()
    store.save(
        PUBLIC_ANALYSIS_LIVE_KEY,
        PublicAnalysisSnapshot(
            as_of_date="2026-06-08",
            published_at="2026-06-08T20:00:00+09:00",
            provider="yfinance",
            universe_month="2026-05",
            item_count=1,
            items=[],
        ).model_dump(),
    )

    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2026, 6, 8)

    with patch.dict("stock_drawdown_app.os.environ", {"APP_AUTH_ENABLED": "true", "GOOGLE_CLIENT_ID": "client-id"}):
        with patch("stock_drawdown_app.date", FixedDate):
            client = TestClient(create_app(public_analysis_store=store))
            public_response = client.get("/api/public-analysis")
            securities_response = client.get("/api/securities")

    assert public_response.status_code == 200
    assert public_response.json()["stale"] is False
    assert securities_response.status_code == 401


def test_is_public_analysis_snapshot_stale():
    snapshot = PublicAnalysisSnapshot(
        as_of_date="2026-06-01",
        published_at="2026-06-01T20:00:00+09:00",
        provider="yfinance",
        universe_month="2026-05",
        item_count=0,
        items=[],
    )

    assert is_public_analysis_snapshot_stale(snapshot, today=date(2026, 6, 8)) is True
    assert is_public_analysis_snapshot_stale(snapshot, today=date(2026, 6, 4)) is False
