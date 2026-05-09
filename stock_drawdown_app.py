from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


SUPPORTED_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}
DEFAULT_PERIOD = "1y"
STATIC_DIR = Path(__file__).parent / "static"


class DrawdownRequest(BaseModel):
    symbols: list[str] = Field(default_factory=list, min_length=1, max_length=20)
    period: str = DEFAULT_PERIOD


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
    error: str | None = None


class DrawdownResponse(BaseModel):
    period: str
    results: list[SymbolDrawdownResult]


@dataclass(frozen=True)
class PricePoint:
    date: str
    price: float


class MarketDataProvider(Protocol):
    def get_adjusted_close(self, symbol: str, period: str) -> list[PricePoint]:
        """Return adjusted daily closes ordered by date."""

    def get_security_name(self, symbol: str) -> str | None:
        """Return a human-friendly security name when available."""


class YFinanceMarketDataProvider:
    def get_adjusted_close(self, symbol: str, period: str) -> list[PricePoint]:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
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

    @app.post("/api/drawdowns", response_model=DrawdownResponse)
    def drawdowns(request: DrawdownRequest) -> DrawdownResponse:
        period = normalize_period(request.period)
        results: list[SymbolDrawdownResult] = []

        seen_symbols: set[str] = set()
        for input_symbol in request.symbols:
            normalized_symbol: str | None = None
            try:
                normalized_symbol = normalize_japanese_symbol(input_symbol)
                if normalized_symbol in seen_symbols:
                    continue
                seen_symbols.add(normalized_symbol)
                prices = market_data_provider.get_adjusted_close(normalized_symbol, period)
                name = market_data_provider.get_security_name(normalized_symbol)
                data, max_drawdown, current_drawdown = calculate_drawdown(prices)
                results.append(
                    SymbolDrawdownResult(
                        input_symbol=input_symbol,
                        symbol=normalized_symbol,
                        display_symbol=to_display_symbol(normalized_symbol),
                        name=name,
                        data=data,
                        max_drawdown=max_drawdown,
                        current_drawdown=current_drawdown,
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

        return DrawdownResponse(period=period, results=results)

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon() -> FileResponse:
        return FileResponse(STATIC_DIR / "favicon.svg")

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


app = create_app()
