from __future__ import annotations

from datetime import date, timedelta
from functools import lru_cache

from fastapi import FastAPI
from pydantic import BaseModel, Field


class DrawdownForecastRequest(BaseModel):
    latest_data_date: str
    drawdown_depths: list[float] = Field(min_length=1)
    horizon_business_days: int = Field(default=14, ge=1, le=60)


class DrawdownForecastPoint(BaseModel):
    date: str
    mean: float
    lower: float
    upper: float


class DrawdownForecastResponse(BaseModel):
    status: str = "ok"
    latest_data_date: str
    points: list[DrawdownForecastPoint]
    message: str | None = None


def next_business_dates(latest_data_date: str, count: int) -> list[str]:
    current = date.fromisoformat(latest_data_date)
    values: list[str] = []
    while len(values) < count:
        current += timedelta(days=1)
        if current.weekday() < 5:
            values.append(current.isoformat())
    return values


@lru_cache(maxsize=1)
def get_model():
    from transformers import TimesFm2_5ModelForPrediction

    model = TimesFm2_5ModelForPrediction.from_pretrained("google/timesfm-2.5-200m-transformers")
    model.eval()
    return model


def predict_depths(drawdown_depths: list[float], horizon_business_days: int) -> list[tuple[float, float, float]]:
    import torch

    model = get_model()
    series = torch.tensor(drawdown_depths, dtype=torch.float32)
    with torch.no_grad():
        output = model(past_values=[series], return_dict=True)

    mean_values = output.mean_predictions[0][:horizon_business_days].detach().cpu().tolist()
    full_predictions = output.full_predictions[0][:horizon_business_days].detach().cpu()
    values: list[tuple[float, float, float]] = []
    for index, mean_value in enumerate(mean_values):
        row = full_predictions[index].tolist()
        lower_value = row[1] if len(row) > 1 else mean_value
        upper_value = row[-1] if row else mean_value
        values.append(
            (
                max(0.0, float(mean_value)),
                max(0.0, float(lower_value)),
                max(0.0, float(upper_value)),
            )
        )
    return values


def create_app() -> FastAPI:
    app = FastAPI(title="Drawdown Forecast API", version="0.1.0")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/predict/drawdown", response_model=DrawdownForecastResponse)
    def predict_drawdown(request: DrawdownForecastRequest) -> DrawdownForecastResponse:
        dates = next_business_dates(request.latest_data_date, request.horizon_business_days)
        values = predict_depths(request.drawdown_depths, request.horizon_business_days)
        return DrawdownForecastResponse(
            latest_data_date=request.latest_data_date,
            points=[
                DrawdownForecastPoint(date=point_date, mean=mean, lower=lower, upper=upper)
                for point_date, (mean, lower, upper) in zip(dates, values, strict=True)
            ],
        )

    return app


app = create_app()

