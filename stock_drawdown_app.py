from __future__ import annotations

import csv
import os
from datetime import date, timedelta
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


SUPPORTED_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "max", "custom"}
DEFAULT_PERIOD = "1y"
MIN_CUSTOM_MONTHS = 1
MAX_CUSTOM_MONTHS = 600
STATIC_DIR = Path(__file__).parent / "static"
MARKET_EVENTS_PATH = Path(__file__).parent / "data" / "market_crashes.csv"
auth_scheme = HTTPBearer(auto_error=False)


class DrawdownRequest(BaseModel):
    symbols: list[str] = Field(default_factory=list, min_length=1, max_length=20)
    period: str = DEFAULT_PERIOD
    custom_months: int | None = Field(default=None, ge=MIN_CUSTOM_MONTHS, le=MAX_CUSTOM_MONTHS)


class DrawdownPoint(BaseModel):
    date: str
    price: float
    drawdown: float


class SymbolDrawdownResult(BaseModel):
    input_symbol: str
    symbol: str
    display_symbol: str
    name: str | None = None
    data: list[DrawdownPoint] = Field(default_factory=list)
    max_drawdown: float | None = None
    current_drawdown: float | None = None
    peak_date: str | None = None
    trough_date: str | None = None
    recovery_date: str | None = None
    decline_days: int | None = None
    recovery_days: int | None = None
    underwater_days: int | None = None
    is_recovered: bool | None = None
    recovery_progress: float | None = None
    error: str | None = None


class DrawdownResponse(BaseModel):
    period: str
    custom_months: int | None = None
    results: list[SymbolDrawdownResult]


class MarketEvent(BaseModel):
    date: str
    name: str
    note: str | None = None


class AuthConfig(BaseModel):
    enabled: bool
    google_client_id: str | None = None


@dataclass(frozen=True)
class PricePoint:
    date: str
    price: float


@dataclass(frozen=True)
class RecoveryMetrics:
    peak_date: str
    trough_date: str
    recovery_date: str | None
    decline_days: int
    recovery_days: int | None
    underwater_days: int
    is_recovered: bool
    recovery_progress: float


class MarketDataProvider(Protocol):
    def get_adjusted_close(self, symbol: str, period: str, custom_months: int | None = None) -> list[PricePoint]:
        """Return adjusted daily closes ordered by date."""

    def get_security_name(self, symbol: str) -> str | None:
        """Return a human-friendly security name when available."""


class YFinanceMarketDataProvider:
    def get_adjusted_close(self, symbol: str, period: str, custom_months: int | None = None) -> list[PricePoint]:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        if period == "custom":
            months = custom_months or 12
            start = subtract_months(date.today(), months)
            history = ticker.history(start=start.isoformat(), auto_adjust=False)
        else:
            history = ticker.history(period=period, auto_adjust=False)
        if history.empty:
            raise ValueError("株価データが見つかりませんでした")

        column = "Adj Close" if "Adj Close" in history.columns else "Close"
        series = history[column].dropna()
        series = series[series > 0]
        if series.empty:
            raise ValueError("有効な調整後終値が見つかりませんでした")

        points: list[PricePoint] = []
        for index, value in series.items():
            points.append(PricePoint(date=index.date().isoformat(), price=float(value)))
        return points

    def get_security_name(self, symbol: str) -> str | None:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        try:
            info = ticker.get_info()
        except Exception:
            return None

        for key in ("longName", "shortName", "displayName"):
            value = info.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None


def normalize_japanese_symbol(raw_symbol: str) -> str:
    symbol = raw_symbol.strip().upper()
    if not symbol:
        raise ValueError("銘柄コードが空です")
    if symbol.startswith("^"):
        return symbol
    if "." in symbol:
        return symbol
    return f"{symbol}.T"


def to_display_symbol(normalized_symbol: str) -> str:
    return normalized_symbol[:-2] if normalized_symbol.endswith(".T") else normalized_symbol


def normalize_period(period: str) -> str:
    normalized = period.strip().lower()
    if normalized not in SUPPORTED_PERIODS:
        return DEFAULT_PERIOD
    return normalized


def normalize_custom_months(period: str, custom_months: int | None) -> int | None:
    if period != "custom":
        return None
    if custom_months is None:
        return 12
    return max(MIN_CUSTOM_MONTHS, min(custom_months, MAX_CUSTOM_MONTHS))


def subtract_months(source_date: date, months: int) -> date:
    month_index = source_date.year * 12 + source_date.month - 1 - months
    year = month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, last_day_of_month(year, month))
    return date(year, month, day)


def last_day_of_month(year: int, month: int) -> int:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    return (next_month - timedelta(days=1)).day


def is_auth_enabled() -> bool:
    return os.getenv("APP_AUTH_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}


def get_google_client_id() -> str | None:
    return os.getenv("GOOGLE_CLIENT_ID", "").strip() or None


def get_allowed_email() -> str | None:
    return os.getenv("ALLOWED_EMAIL", "").strip().lower() or None


def verify_google_token(token: str) -> str:
    client_id = get_google_client_id()
    allowed_email = get_allowed_email()
    if not client_id or not allowed_email:
        raise HTTPException(status_code=500, detail="認証設定が不足しています")

    try:
        from google.auth.transport import requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(token, requests.Request(), client_id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Googleログインの検証に失敗しました") from exc

    email = str(claims.get("email", "")).strip().lower()
    if email != allowed_email:
        raise HTTPException(status_code=403, detail="このアカウントにはアクセス権がありません")
    return email


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme)) -> str | None:
    if not is_auth_enabled():
        return None
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Googleログインが必要です")
    return verify_google_token(credentials.credentials)


def load_market_events(path: Path = MARKET_EVENTS_PATH) -> list[MarketEvent]:
    if not path.exists():
        return []

    events: list[MarketEvent] = []
    with path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            event_date = (row.get("date") or "").strip()
            name = (row.get("name") or "").strip()
            note = (row.get("note") or "").strip() or None
            if not event_date or not name:
                continue
            date.fromisoformat(event_date)
            events.append(MarketEvent(date=event_date, name=name, note=note))
    return sorted(events, key=lambda event: event.date)


def calculate_drawdown(points: list[PricePoint]) -> tuple[list[DrawdownPoint], float, float]:
    if not points:
        raise ValueError("価格データが空です")

    peak = points[0].price
    rows: list[DrawdownPoint] = []
    max_drawdown = 0.0

    for point in points:
        peak = max(peak, point.price)
        drawdown = (point.price / peak) - 1.0
        max_drawdown = min(max_drawdown, drawdown)
        rows.append(
            DrawdownPoint(
                date=point.date,
                price=round(point.price, 6),
                drawdown=round(drawdown, 8),
            )
        )

    return rows, round(max_drawdown, 8), rows[-1].drawdown


def date_distance(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def calculate_recovery_metrics(points: list[PricePoint]) -> RecoveryMetrics:
    if not points:
        raise ValueError("価格データが空です")

    peak_price = points[0].price
    peak_date = points[0].date
    max_drawdown = 0.0
    max_peak_price = points[0].price
    max_peak_date = points[0].date
    trough_price = points[0].price
    trough_date = points[0].date
    trough_index = 0

    for index, point in enumerate(points):
        if point.price > peak_price:
            peak_price = point.price
            peak_date = point.date

        drawdown = (point.price / peak_price) - 1.0
        if drawdown < max_drawdown:
            max_drawdown = drawdown
            max_peak_price = peak_price
            max_peak_date = peak_date
            trough_price = point.price
            trough_date = point.date
            trough_index = index

    recovery_date: str | None = None
    for point in points[trough_index:]:
        if point.price >= max_peak_price:
            recovery_date = point.date
            break

    is_recovered = recovery_date is not None
    decline_days = date_distance(max_peak_date, trough_date)
    recovery_days = date_distance(trough_date, recovery_date) if recovery_date else None
    underwater_end_date = recovery_date or points[-1].date
    underwater_days = date_distance(max_peak_date, underwater_end_date)

    recovery_span = max_peak_price - trough_price
    if recovery_span <= 0:
        recovery_progress = 1.0
    elif is_recovered:
        recovery_progress = 1.0
    else:
        recovery_progress = (points[-1].price - trough_price) / recovery_span
        recovery_progress = max(0.0, min(recovery_progress, 1.0))

    return RecoveryMetrics(
        peak_date=max_peak_date,
        trough_date=trough_date,
        recovery_date=recovery_date,
        decline_days=decline_days,
        recovery_days=recovery_days,
        underwater_days=underwater_days,
        is_recovered=is_recovered,
        recovery_progress=round(recovery_progress, 8),
    )


def unique_symbols(symbols: list[str]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for raw_symbol in symbols:
        normalized = normalize_japanese_symbol(raw_symbol)
        if normalized not in seen:
            seen.add(normalized)
            unique.append((raw_symbol, normalized))
    return unique


def create_app(provider: MarketDataProvider | None = None) -> FastAPI:
    app = FastAPI(title="Stock Drawdown API", version="0.1.0")
    market_data_provider = provider or YFinanceMarketDataProvider()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/config", response_model=AuthConfig)
    def config() -> AuthConfig:
        return AuthConfig(enabled=is_auth_enabled(), google_client_id=get_google_client_id())

    @app.get("/api/market-events", response_model=list[MarketEvent])
    def market_events(_: str | None = Depends(require_user)) -> list[MarketEvent]:
        return load_market_events()

    @app.post("/api/drawdowns", response_model=DrawdownResponse)
    def drawdowns(request: DrawdownRequest, _: str | None = Depends(require_user)) -> DrawdownResponse:
        period = normalize_period(request.period)
        custom_months = normalize_custom_months(period, request.custom_months)
        results: list[SymbolDrawdownResult] = []

        seen_symbols: set[str] = set()
        for input_symbol in request.symbols:
            normalized_symbol: str | None = None
            try:
                normalized_symbol = normalize_japanese_symbol(input_symbol)
                if normalized_symbol in seen_symbols:
                    continue
                seen_symbols.add(normalized_symbol)
                prices = market_data_provider.get_adjusted_close(normalized_symbol, period, custom_months)
                name = market_data_provider.get_security_name(normalized_symbol)
                data, max_drawdown, current_drawdown = calculate_drawdown(prices)
                recovery = calculate_recovery_metrics(prices)
                results.append(
                    SymbolDrawdownResult(
                        input_symbol=input_symbol,
                        symbol=normalized_symbol,
                        display_symbol=to_display_symbol(normalized_symbol),
                        name=name,
                        data=data,
                        max_drawdown=max_drawdown,
                        current_drawdown=current_drawdown,
                        peak_date=recovery.peak_date,
                        trough_date=recovery.trough_date,
                        recovery_date=recovery.recovery_date,
                        decline_days=recovery.decline_days,
                        recovery_days=recovery.recovery_days,
                        underwater_days=recovery.underwater_days,
                        is_recovered=recovery.is_recovered,
                        recovery_progress=recovery.recovery_progress,
                    )
                )
            except Exception as exc:
                fallback_symbol = normalized_symbol or input_symbol.strip().upper() or input_symbol
                results.append(
                    SymbolDrawdownResult(
                        input_symbol=input_symbol,
                        symbol=fallback_symbol,
                        display_symbol=to_display_symbol(fallback_symbol),
                        error=str(exc),
                    )
                )

        return DrawdownResponse(period=period, custom_months=custom_months, results=results)

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon() -> FileResponse:
        return FileResponse(STATIC_DIR / "favicon.svg")

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


app = create_app()
