from fastapi.testclient import TestClient

from stock_drawdown_app import (
    PricePoint,
    calculate_drawdown,
    calculate_recovery_metrics,
    create_app,
    load_market_events,
    normalize_japanese_symbol,
    subtract_months,
)


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
