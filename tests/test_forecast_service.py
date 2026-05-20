from fastapi.testclient import TestClient

import forecast_service


def test_next_business_dates_skips_weekends() -> None:
    assert forecast_service.next_business_dates("2026-05-15", 3) == ["2026-05-18", "2026-05-19", "2026-05-20"]


def test_predict_drawdown_endpoint_uses_prediction_values(monkeypatch) -> None:
    monkeypatch.setattr(forecast_service, "predict_depths", lambda values, horizon: [(0.1, 0.08, 0.12)] * horizon)
    client = TestClient(forecast_service.create_app())

    response = client.post(
        "/predict/drawdown",
        json={"latest_data_date": "2026-05-15", "drawdown_depths": [0.1, 0.2], "horizon_business_days": 2},
    )

    assert response.status_code == 200
    assert response.json()["points"] == [
        {"date": "2026-05-18", "mean": 0.1, "lower": 0.08, "upper": 0.12},
        {"date": "2026-05-19", "mean": 0.1, "lower": 0.08, "upper": 0.12},
    ]
