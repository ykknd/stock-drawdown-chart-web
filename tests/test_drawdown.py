from fastapi.testclient import TestClient

from stock_drawdown_app import PricePoint, calculate_drawdown, create_app, normalize_japanese_symbol


class FakeProvider:
    def get_adjusted_close(self, symbol: str, period: str) -> list[PricePoint]:
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
    assert payload["results"][1]["symbol"] == "9999.T"
    assert payload["results"][1]["error"] == "not found"
