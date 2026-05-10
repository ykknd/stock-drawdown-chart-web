from fastapi.testclient import TestClient
import pytest

from stock_drawdown_app import (
    PricePoint,
    TechnicalIndicatorSetting,
    adjusted_price_point,
    aggregate_price_points,
    calculate_drawdown,
    calculate_recovery_metrics,
    calculate_technical_indicators,
    create_app,
    load_market_events,
    normalize_japanese_symbol,
    subtract_months,
)


@pytest.fixture(autouse=True)
def disable_auth_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("APP_AUTH_ENABLED", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("ALLOWED_EMAIL", raising=False)


class FakeProvider:
    def get_adjusted_close(self, symbol: str, period: str, custom_months: int | None = None) -> list[PricePoint]:
        if symbol == "9999.T":
            raise ValueError("not found")
        return [
            PricePoint("2026-01-01", 100.0),
            PricePoint("2026-01-02", 120.0),
            PricePoint("2026-01-03", 90.0),
            PricePoint("2026-01-04", 108.0),
        ]

    def get_security_name(self, symbol: str) -> str | None:
        return {"7203.T": "Toyota Motor Corporation"}.get(symbol)


class CountingProvider(FakeProvider):
    def __init__(self) -> None:
        self.price_calls = 0
        self.name_calls = 0

    def get_adjusted_close(self, symbol: str, period: str, custom_months: int | None = None) -> list[PricePoint]:
        self.price_calls += 1
        return super().get_adjusted_close(symbol, period, custom_months)

    def get_security_name(self, symbol: str) -> str | None:
        self.name_calls += 1
        return super().get_security_name(symbol)


def test_normalize_japanese_symbol_adds_t_suffix() -> None:
    assert normalize_japanese_symbol("7203") == "7203.T"
    assert normalize_japanese_symbol("7203.T") == "7203.T"
    assert normalize_japanese_symbol("^N225") == "^N225"


def test_subtract_months_clamps_to_last_day() -> None:
    assert subtract_months(__import__("datetime").date(2026, 3, 31), 1).isoformat() == "2026-02-28"


def test_calculate_drawdown_from_known_prices() -> None:
    data, max_drawdown, current_drawdown = calculate_drawdown(
        [
            PricePoint("2026-01-01", 100.0),
            PricePoint("2026-01-02", 120.0),
            PricePoint("2026-01-03", 90.0),
            PricePoint("2026-01-04", 108.0),
        ]
    )

    assert [point.drawdown for point in data] == [0.0, 0.0, -0.25, -0.1]
    assert max_drawdown == -0.25
    assert current_drawdown == -0.1
    assert data[0].open == 100.0
    assert data[0].high == 100.0
    assert data[0].low == 100.0
    assert data[0].close == 100.0


def test_adjusted_price_point_scales_ohlc_by_adj_close_ratio() -> None:
    point = adjusted_price_point(
        date_value="2026-01-01",
        open_price=100.0,
        high=120.0,
        low=90.0,
        close=110.0,
        adj_close=55.0,
    )

    assert point.open == 50.0
    assert point.high == 60.0
    assert point.low == 45.0
    assert point.close == 55.0
    assert point.price == 55.0


def test_aggregate_price_points_weekly_uses_standard_ohlc() -> None:
    points = [
        PricePoint("2026-01-05", 12.0, open=10.0, high=13.0, low=9.0, close=12.0),
        PricePoint("2026-01-06", 15.0, open=12.0, high=16.0, low=11.0, close=15.0),
        PricePoint("2026-01-12", 18.0, open=17.0, high=19.0, low=16.0, close=18.0),
    ]

    aggregated = aggregate_price_points(points, "weekly")

    assert len(aggregated) == 2
    assert aggregated[0].date == "2026-01-06"
    assert aggregated[0].open == 10.0
    assert aggregated[0].high == 16.0
    assert aggregated[0].low == 9.0
    assert aggregated[0].close == 15.0
    assert aggregated[0].price == 15.0


def test_aggregate_price_points_monthly_uses_standard_ohlc() -> None:
    points = [
        PricePoint("2026-01-30", 12.0, open=10.0, high=13.0, low=9.0, close=12.0),
        PricePoint("2026-01-31", 14.0, open=12.0, high=15.0, low=11.0, close=14.0),
        PricePoint("2026-02-02", 16.0, open=15.0, high=17.0, low=14.0, close=16.0),
    ]

    aggregated = aggregate_price_points(points, "monthly")

    assert len(aggregated) == 2
    assert aggregated[0].date == "2026-01-31"
    assert aggregated[0].open == 10.0
    assert aggregated[0].high == 15.0
    assert aggregated[0].low == 9.0
    assert aggregated[0].close == 14.0


def test_calculate_technical_indicators_with_pandas_ta() -> None:
    points = [
        PricePoint(f"2026-01-{day:02d}", float(day), open=float(day), high=float(day + 1), low=float(day - 1), close=float(day))
        for day in range(1, 22)
    ]

    indicators = calculate_technical_indicators(
        points,
        {
            "sma": TechnicalIndicatorSetting(enabled=True, period=20),
            "ema": TechnicalIndicatorSetting(enabled=True, period=20),
            "bbands": TechnicalIndicatorSetting(enabled=True, period=20),
            "unknown": TechnicalIndicatorSetting(enabled=True, period=20),
        },
    )

    assert indicators["2026-01-19"]["sma20"] is None or "sma20" not in indicators["2026-01-19"]
    assert indicators["2026-01-20"]["sma20"] == 10.5
    assert indicators["2026-01-21"]["sma20"] == 11.5
    assert "ema20" in indicators["2026-01-21"]
    assert "bbands20_upper" in indicators["2026-01-21"]


def test_calculate_recovery_metrics_for_recovered_drawdown() -> None:
    metrics = calculate_recovery_metrics(
        [
            PricePoint("2026-01-01", 100.0),
            PricePoint("2026-01-02", 120.0),
            PricePoint("2026-01-03", 90.0),
            PricePoint("2026-01-10", 121.0),
        ]
    )

    assert metrics.peak_date == "2026-01-02"
    assert metrics.trough_date == "2026-01-03"
    assert metrics.recovery_date == "2026-01-10"
    assert metrics.decline_days == 1
    assert metrics.recovery_days == 7
    assert metrics.underwater_days == 8
    assert metrics.is_recovered is True
    assert metrics.recovery_progress == 1.0


def test_calculate_recovery_metrics_for_unrecovered_drawdown() -> None:
    metrics = calculate_recovery_metrics(
        [
            PricePoint("2026-01-01", 100.0),
            PricePoint("2026-01-02", 120.0),
            PricePoint("2026-01-03", 80.0),
            PricePoint("2026-01-05", 100.0),
        ]
    )

    assert metrics.peak_date == "2026-01-02"
    assert metrics.trough_date == "2026-01-03"
    assert metrics.recovery_date is None
    assert metrics.decline_days == 1
    assert metrics.recovery_days is None
    assert metrics.underwater_days == 3
    assert metrics.is_recovered is False
    assert metrics.recovery_progress == 0.5


def test_load_market_events_from_csv() -> None:
    events = load_market_events()

    assert any(event.name == "コロナショック" and event.date == "2020-03-12" for event in events)
    assert events == sorted(events, key=lambda event: event.date)


def test_drawdowns_endpoint_returns_success_and_symbol_errors() -> None:
    client = TestClient(create_app(FakeProvider()))
    response = client.post("/api/drawdowns", json={"symbols": ["7203", "9999", "7203.T"], "period": "1y"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["period"] == "1y"
    assert len(payload["results"]) == 2
    assert payload["results"][0]["symbol"] == "7203.T"
    assert payload["results"][0]["name"] == "Toyota Motor Corporation"
    assert payload["results"][0]["max_drawdown"] == -0.25
    assert payload["results"][0]["peak_date"] == "2026-01-02"
    assert payload["results"][0]["trough_date"] == "2026-01-03"
    assert payload["results"][0]["recovery_date"] is None
    assert payload["results"][0]["is_recovered"] is False
    assert payload["results"][0]["recovery_progress"] == 0.6
    assert payload["results"][1]["symbol"] == "9999.T"
    assert payload["results"][1]["error"] == "not found"


def test_drawdowns_endpoint_accepts_custom_months() -> None:
    client = TestClient(create_app(FakeProvider()))
    response = client.post("/api/drawdowns", json={"symbols": ["7203"], "period": "custom", "custom_months": 53})

    assert response.status_code == 200
    payload = response.json()
    assert payload["period"] == "custom"
    assert payload["custom_months"] == 53


def test_config_reports_auth_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_AUTH_ENABLED", "true")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "example-client-id")
    client = TestClient(create_app(FakeProvider()))

    response = client.get("/api/config")

    assert response.status_code == 200
    assert response.json() == {"enabled": True, "google_client_id": "example-client-id"}


def test_drawdowns_requires_bearer_token_when_auth_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_AUTH_ENABLED", "true")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "example-client-id")
    monkeypatch.setenv("ALLOWED_EMAIL", "user@example.com")
    client = TestClient(create_app(FakeProvider()))

    response = client.post("/api/drawdowns", json={"symbols": ["7203"], "period": "1y"})

    assert response.status_code == 401


def test_drawdowns_endpoint_accepts_candle_intervals() -> None:
    client = TestClient(create_app(FakeProvider()))
    response = client.post("/api/drawdowns", json={"symbols": ["7203"], "period": "1y", "candle_interval": "weekly"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["candle_interval"] == "weekly"
    assert payload["results"][0]["data"][0]["open"] == 100.0
    assert payload["results"][0]["data"][0]["high"] == 120.0
    assert payload["results"][0]["data"][0]["low"] == 90.0
    assert payload["results"][0]["data"][0]["close"] == 108.0


def test_drawdowns_endpoint_accepts_technical_indicators() -> None:
    client = TestClient(create_app(FakeProvider()))
    response = client.post(
        "/api/drawdowns",
        json={
            "symbols": ["7203"],
            "period": "1y",
            "technical_indicators": {
                "sma": {"enabled": True, "period": 10},
                "bad": {"enabled": True, "period": 20},
                "ema": {"enabled": True, "period": 25},
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["technical_indicators"] == {
        "sma": {"enabled": True, "period": 10},
        "ema": {"enabled": True, "period": 25},
    }
    assert isinstance(payload["results"][0]["data"][0]["indicators"], dict)


def test_drawdowns_endpoint_reuses_cached_market_data_when_indicators_change() -> None:
    provider = CountingProvider()
    client = TestClient(create_app(provider))

    first = client.post(
        "/api/drawdowns",
        json={"symbols": ["7203"], "period": "1y", "technical_indicators": {"sma": {"enabled": True, "period": 20}}},
    )
    second = client.post(
        "/api/drawdowns",
        json={
            "symbols": ["7203"],
            "period": "1y",
            "technical_indicators": {
                "ema": {"enabled": True, "period": 20},
                "bbands": {"enabled": True, "period": 20},
            },
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert provider.price_calls == 1
    assert provider.name_calls == 1
    assert second.json()["technical_indicators"] == {
        "ema": {"enabled": True, "period": 20},
        "bbands": {"enabled": True, "period": 20},
    }
