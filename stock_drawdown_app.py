from __future__ import annotations

import csv
import os
import time
from datetime import date, datetime, timedelta
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
SUPPORTED_CANDLE_INTERVALS = {"daily", "weekly", "monthly"}
SUPPORTED_TECHNICAL_INDICATORS = {"sma", "ema", "bbands"}
DEFAULT_PERIOD = "1y"
DEFAULT_CANDLE_INTERVAL = "daily"
DEFAULT_TECHNICAL_PERIOD = 20
DEFAULT_JQUANTS_REQUEST_INTERVAL_SECONDS = 1.0
DEFAULT_JQUANTS_FREE_DATA_LAG_WEEKS = 12
MIN_TECHNICAL_PERIOD = 1
MAX_TECHNICAL_PERIOD = 100
MIN_CUSTOM_MONTHS = 1
MAX_CUSTOM_MONTHS = 600
DEFAULT_MARKET_DATA_CACHE_TTL_SECONDS = 15 * 60
STATIC_DIR = Path(__file__).parent / "static"
MARKET_EVENTS_PATH = Path(__file__).parent / "data" / "market_crashes.csv"
JP_SECURITY_NAMES_PATH = Path(__file__).parent / "data" / "jp_security_names.csv"
auth_scheme = HTTPBearer(auto_error=False)


class TechnicalIndicatorSetting(BaseModel):
    enabled: bool = False
    period: int = Field(default=DEFAULT_TECHNICAL_PERIOD, ge=MIN_TECHNICAL_PERIOD, le=MAX_TECHNICAL_PERIOD)


class DrawdownRequest(BaseModel):
    symbols: list[str] = Field(default_factory=list, min_length=1, max_length=20)
    period: str = DEFAULT_PERIOD
    custom_months: int | None = Field(default=None, ge=MIN_CUSTOM_MONTHS, le=MAX_CUSTOM_MONTHS)
    candle_interval: str = DEFAULT_CANDLE_INTERVAL
    technical_indicators: dict[str, TechnicalIndicatorSetting] = Field(default_factory=dict)
    jquants_api_key: str | None = Field(default=None, min_length=1, max_length=256)
    jquants_free_tier: bool = True


class DrawdownPoint(BaseModel):
    date: str
    price: float
    open: float
    high: float
    low: float
    close: float
    drawdown: float
    indicators: dict[str, float | None] = Field(default_factory=dict)


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
    requested_start_date: str
    requested_end_date: str
    candle_interval: str = DEFAULT_CANDLE_INTERVAL
    technical_indicators: dict[str, TechnicalIndicatorSetting] = Field(default_factory=dict)
    results: list[SymbolDrawdownResult]


class MarketEvent(BaseModel):
    date: str
    name: str
    note: str | None = None


class SecurityInfo(BaseModel):
    code: str
    name: str


class AppConfig(BaseModel):
    enabled: bool
    google_client_id: str | None = None
    market_data_provider: str = "yfinance"
    jquants_api_key_available: bool = False
    requires_jquants_api_key_input: bool = False


@dataclass(frozen=True)
class PricePoint:
    date: str
    price: float
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None

    def __post_init__(self) -> None:
        open_price = self.price if self.open is None else self.open
        high_price = self.price if self.high is None else self.high
        low_price = self.price if self.low is None else self.low
        close_price = self.price if self.close is None else self.close
        object.__setattr__(self, "open", open_price)
        object.__setattr__(self, "high", high_price)
        object.__setattr__(self, "low", low_price)
        object.__setattr__(self, "close", close_price)
        object.__setattr__(self, "price", close_price)


@dataclass(frozen=True)
class CachedMarketPrices:
    expires_at: float
    points: list[PricePoint]


@dataclass(frozen=True)
class CachedSecurityName:
    expires_at: float
    name: str | None


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
    def get_adjusted_close(
        self,
        symbol: str,
        period: str,
        custom_months: int | None = None,
        api_key: str | None = None,
        jquants_free_tier: bool = True,
    ) -> list[PricePoint]:
        """Return adjusted daily closes ordered by date."""

    def get_security_name(self, symbol: str, api_key: str | None = None) -> str | None:
        """Return a human-friendly security name when available."""


class YFinanceMarketDataProvider:
    def get_adjusted_close(
        self,
        symbol: str,
        period: str,
        custom_months: int | None = None,
        api_key: str | None = None,
        jquants_free_tier: bool = True,
    ) -> list[PricePoint]:
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

        points: list[PricePoint] = []
        for index, row in history.iterrows():
            open_price = row.get("Open")
            high = row.get("High")
            low = row.get("Low")
            close = row.get("Close")
            adj_close = row.get("Adj Close") if "Adj Close" in history.columns else None
            if any(value is None or value != value for value in (open_price, high, low, close)):
                continue
            if close <= 0 or open_price <= 0 or high <= 0 or low <= 0:
                continue
            points.append(
                adjusted_price_point(
                    date_value=index.date().isoformat(),
                    open_price=float(open_price),
                    high=float(high),
                    low=float(low),
                    close=float(close),
                    adj_close=float(adj_close) if adj_close is not None and adj_close == adj_close else None,
                )
            )
        if not points:
            raise ValueError("有効なOHLCデータが見つかりませんでした")
        return points

    def get_security_name(self, symbol: str, api_key: str | None = None) -> str | None:
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


class JQuantsMarketDataProvider:
    def _to_jquants_base_code(self, symbol: str) -> str:
        code = symbol.strip().upper()
        if code.endswith(".T"):
            code = code[:-2]
        if code.isdigit() and len(code) == 4:
            return code
        if code.isdigit() and len(code) == 5 and code.endswith("0"):
            return code[:4]
        if code.isdigit() and len(code) == 5:
            return code
        raise ValueError(f"J-Quantsでは対応していない銘柄形式です: {symbol}")

    def _to_jquants_code(self, symbol: str) -> str:
        # 7203 or 7203.T -> 72030
        code = self._to_jquants_base_code(symbol)
        if len(code) == 4:
            return f"{code}0"
        if code.isdigit() and len(code) == 5:
            return code
        raise ValueError(f"J-Quantsでは対応していない銘柄形式です: {symbol}")

    def _jquants_code_candidates(self, symbol: str) -> list[str]:
        primary_code = self._to_jquants_code(symbol)
        base_code = self._to_jquants_base_code(symbol)
        return list(dict.fromkeys([primary_code, base_code]))

    def _get_end_date(self, free_tier: bool) -> date:
        if free_tier:
            return date.today() - timedelta(weeks=jquants_free_data_lag_weeks())
        return date.today()

    def _get_start_date(self, period: str, custom_months: int | None) -> date:
        if period == "custom":
            return subtract_months(date.today(), custom_months or 12)
        if period == "1mo":
            return subtract_months(date.today(), 1)
        if period == "3mo":
            return subtract_months(date.today(), 3)
        if period == "6mo":
            return subtract_months(date.today(), 6)
        if period == "1y":
            return subtract_months(date.today(), 12)
        if period == "2y":
            return subtract_months(date.today(), 24)
        if period == "5y":
            return subtract_months(date.today(), 60)
        # J-Quants 'max' is restricted to 2008-01-01 for now
        return date(2008, 1, 1)

    def _extract_security_name(self, row: object) -> str | None:
        for key in ("CoName", "CoNameEn", "CompanyName", "CompanyNameEnglish", "Name"):
            value = row.get(key)
            if value is not None and value == value and str(value).strip():
                return str(value).strip()
        return None

    def get_adjusted_close(
        self,
        symbol: str,
        period: str,
        custom_months: int | None = None,
        api_key: str | None = None,
        jquants_free_tier: bool = True,
    ) -> list[PricePoint]:
        import jquantsapi
        import requests
        from tenacity import RetryError

        end_date = self._get_end_date(jquants_free_tier)
        start_date = self._get_start_date(period, custom_months)
        if start_date >= end_date:
            raise ValueError("J-Quants無料枠ではこの期間に取得可能なデータがありません")
        
        cli = jquantsapi.ClientV2(api_key=api_key) if api_key else jquantsapi.ClientV2()
        code = self._to_jquants_code(symbol)

        try:
            df = cli.get_eq_bars_daily(
                code=code,
                from_yyyymmdd=start_date.strftime("%Y%m%d"),
                to_yyyymmdd=end_date.strftime("%Y%m%d"),
            )
        except (requests.exceptions.HTTPError, RetryError, Exception) as e:
            msg = str(e).lower()
            is_429 = False
            is_subscription = False

            if isinstance(e, RetryError):
                is_429 = True
            elif isinstance(e, requests.exceptions.HTTPError) and e.response is not None:
                if e.response.status_code == 429:
                    is_429 = True
                elif e.response.status_code == 400:
                    is_subscription = True
                elif e.response.status_code == 403:
                    raise ValueError("J-Quants APIの契約プランで制限されているか、無効なAPIキーです。") from None

            if "too many 429 error responses" in msg or "429" in msg or "rate limit" in msg:
                is_429 = True
            if "subscription" in msg or "covers the following dates" in msg:
                is_subscription = True

            if is_429:
                raise ValueError("J-Quants APIのレート制限に達しました。時間を置いて再試行してください。") from None
            if is_subscription:
                raise ValueError("J-Quantsの契約範囲外の期間です。期間または無料枠設定を確認してください。") from None
            
            raise ValueError("J-Quantsからのデータ取得に失敗しました") from None

        if df.empty:
            raise ValueError("株価データが見つかりませんでした")

        points: list[PricePoint] = []
        for _, row in df.iterrows():
            # AdjO, AdjH, AdjL, AdjC
            open_p = row.get("AdjO")
            high_p = row.get("AdjH")
            low_p = row.get("AdjL")
            close_p = row.get("AdjC")
            dt = row.get("Date")
            
            if any(v is None or v != v for v in (open_p, high_p, low_p, close_p, dt)):
                continue
            if close_p <= 0 or open_p <= 0 or high_p <= 0 or low_p <= 0:
                continue
            
            points.append(
                PricePoint(
                    date=normalize_date_value(dt),
                    price=float(close_p),
                    open=float(open_p),
                    high=float(high_p),
                    low=float(low_p),
                    close=float(close_p),
                )
            )
        
        if not points:
            raise ValueError("有効なOHLCデータが見つかりませんでした")
        return sorted(points, key=lambda p: p.date)

    def get_security_name(self, symbol: str, api_key: str | None = None) -> str | None:
        import jquantsapi

        try:
            local_name = get_local_security_name(symbol)
            if local_name:
                return local_name

            cli = jquantsapi.ClientV2(api_key=api_key) if api_key else jquantsapi.ClientV2()
            for candidate in self._jquants_code_candidates(symbol):
                df = cli.get_eq_master(code=candidate)
                if not df.empty:
                    name = self._extract_security_name(df.iloc[0])
                    if name:
                        return name
            for candidate in self._jquants_code_candidates(symbol):
                df = cli.get_list(code=candidate)
                if not df.empty:
                    name = self._extract_security_name(df.iloc[0])
                    if name:
                        return name
        except Exception:
            pass
        return None


def hash_api_key(api_key: str) -> str:
    import hashlib
    return hashlib.sha256(api_key.encode()).hexdigest()


def normalize_date_value(value: object) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "date"):
        return value.date().isoformat()

    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        return date(int(text[:4]), int(text[4:6]), int(text[6:8])).isoformat()
    if " " in text:
        text = text.split(" ", 1)[0]
    if "T" in text:
        text = text.split("T", 1)[0]
    return date.fromisoformat(text).isoformat()


def normalize_market_data_provider(provider_raw: str | None) -> str:
    if not provider_raw:
        return "yfinance"
    provider = provider_raw.strip().lower()
    if provider not in {"yfinance", "jquants"}:
        raise ValueError(f"サポートされていない MARKET_DATA_PROVIDER です: {provider_raw}")
    return provider


def get_jquants_api_key_from_env() -> str | None:
    return os.getenv("JQUANTS_API_KEY", "").strip() or None


def load_local_securities() -> list[SecurityInfo]:
    if not JP_SECURITY_NAMES_PATH.exists():
        return []

    securities: list[SecurityInfo] = []
    try:
        with JP_SECURITY_NAMES_PATH.open(newline="", encoding="utf-8-sig") as csv_file:
            reader = csv.DictReader(csv_file)
            for row in reader:
                code = (row.get("code") or "").strip()
                name = (row.get("name") or "").strip()
                if code and name:
                    securities.append(SecurityInfo(code=code, name=name))
    except OSError:
        return []
    return securities


def get_local_security_name(symbol: str) -> str | None:
    if not JP_SECURITY_NAMES_PATH.exists():
        return None

    try:
        code = JQuantsMarketDataProvider()._to_jquants_base_code(symbol)
    except ValueError:
        return None

    with JP_SECURITY_NAMES_PATH.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            if (row.get("code") or "").strip() == code:
                name = (row.get("name") or "").strip()
                return name or None
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


def requested_date_range(period: str, custom_months: int | None) -> tuple[str, str]:
    end_date = date.today()
    if period == "custom":
        months = custom_months or 12
        start_date = subtract_months(end_date, months)
    elif period == "1mo":
        start_date = subtract_months(end_date, 1)
    elif period == "3mo":
        start_date = subtract_months(end_date, 3)
    elif period == "6mo":
        start_date = subtract_months(end_date, 6)
    elif period == "1y":
        start_date = subtract_months(end_date, 12)
    elif period == "2y":
        start_date = subtract_months(end_date, 24)
    elif period == "5y":
        start_date = subtract_months(end_date, 60)
    else:
        start_date = date(2008, 1, 1)
    return start_date.isoformat(), end_date.isoformat()


def normalize_candle_interval(candle_interval: str) -> str:
    normalized = candle_interval.strip().lower()
    if normalized not in SUPPORTED_CANDLE_INTERVALS:
        return DEFAULT_CANDLE_INTERVAL
    return normalized


def clamp_technical_period(value: int | None) -> int:
    if value is None:
        return DEFAULT_TECHNICAL_PERIOD
    return max(MIN_TECHNICAL_PERIOD, min(int(value), MAX_TECHNICAL_PERIOD))


def normalize_technical_indicators(
    indicators: dict[str, TechnicalIndicatorSetting] | None,
) -> dict[str, TechnicalIndicatorSetting]:
    normalized: dict[str, TechnicalIndicatorSetting] = {}
    for indicator, setting in (indicators or {}).items():
        key = indicator.strip().lower()
        if key not in SUPPORTED_TECHNICAL_INDICATORS or not setting.enabled:
            continue
        normalized[key] = TechnicalIndicatorSetting(enabled=True, period=clamp_technical_period(setting.period))
    return normalized


def indicator_key(indicator: str, period: int, suffix: str | None = None) -> str:
    base = f"{indicator}{period}"
    return f"{base}_{suffix}" if suffix else base


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


def adjusted_price_point(date_value: str, open_price: float, high: float, low: float, close: float, adj_close: float | None) -> PricePoint:
    ratio = 1.0
    if adj_close is not None and close > 0:
        ratio = adj_close / close
    adjusted_open = open_price * ratio
    adjusted_high = high * ratio
    adjusted_low = low * ratio
    adjusted_close = close * ratio
    return PricePoint(
        date=date_value,
        price=adjusted_close,
        open=adjusted_open,
        high=adjusted_high,
        low=adjusted_low,
        close=adjusted_close,
    )


def aggregate_price_points(points: list[PricePoint], candle_interval: str) -> list[PricePoint]:
    interval = normalize_candle_interval(candle_interval)
    if interval == "daily":
        return points

    groups: dict[str, list[PricePoint]] = {}
    for point in points:
        point_date = date.fromisoformat(point.date)
        if interval == "weekly":
            iso_year, iso_week, _ = point_date.isocalendar()
            key = f"{iso_year}-W{iso_week:02d}"
        else:
            key = point_date.strftime("%Y-%m")
        groups.setdefault(key, []).append(point)

    aggregated: list[PricePoint] = []
    for group in groups.values():
        ordered = sorted(group, key=lambda point: point.date)
        aggregated.append(
            PricePoint(
                date=ordered[-1].date,
                price=ordered[-1].close or ordered[-1].price,
                open=ordered[0].open,
                high=max(point.high or point.price for point in ordered),
                low=min(point.low or point.price for point in ordered),
                close=ordered[-1].close,
            )
        )
    return sorted(aggregated, key=lambda point: point.date)


def calculate_technical_indicators(
    points: list[PricePoint],
    indicators: dict[str, TechnicalIndicatorSetting] | None,
) -> dict[str, dict[str, float | None]]:
    selected = normalize_technical_indicators(indicators)
    empty = {point.date: {} for point in points}
    if not points or not selected:
        return empty

    import pandas as pd
    import pandas_ta as ta

    frame = pd.DataFrame(
        {
            "date": [point.date for point in points],
            "open": [point.open for point in points],
            "high": [point.high for point in points],
            "low": [point.low for point in points],
            "close": [point.close for point in points],
        }
    ).set_index("date")

    values: dict[str, object] = {}
    if "sma" in selected:
        period = selected["sma"].period
        values[indicator_key("sma", period)] = ta.sma(frame["close"], length=period)
    if "ema" in selected:
        period = selected["ema"].period
        values[indicator_key("ema", period)] = ta.ema(frame["close"], length=period)
    if "bbands" in selected:
        period = selected["bbands"].period
        bands = ta.bbands(frame["close"], length=period)
        if bands is not None:
            values[indicator_key("bbands", period, "lower")] = bands.get(f"BBL_{period}_2.0")
            values[indicator_key("bbands", period, "middle")] = bands.get(f"BBM_{period}_2.0")
            values[indicator_key("bbands", period, "upper")] = bands.get(f"BBU_{period}_2.0")
            if values[indicator_key("bbands", period, "lower")] is None:
                values[indicator_key("bbands", period, "lower")] = bands.get(f"BBL_{period}_2.0_2.0")
            if values[indicator_key("bbands", period, "middle")] is None:
                values[indicator_key("bbands", period, "middle")] = bands.get(f"BBM_{period}_2.0_2.0")
            if values[indicator_key("bbands", period, "upper")] is None:
                values[indicator_key("bbands", period, "upper")] = bands.get(f"BBU_{period}_2.0_2.0")

    by_date: dict[str, dict[str, float | None]] = {point.date: {} for point in points}
    for name, series in values.items():
        if series is None:
            continue
        for point_date, value in series.items():
            by_date[str(point_date)][name] = None if value != value else round(float(value), 6)
    return by_date


def calculate_drawdown(
    points: list[PricePoint],
    technical_indicators: dict[str, TechnicalIndicatorSetting] | None = None,
) -> tuple[list[DrawdownPoint], float, float]:
    if not points:
        raise ValueError("価格データが空です")

    peak = points[0].price
    rows: list[DrawdownPoint] = []
    max_drawdown = 0.0
    indicator_values = calculate_technical_indicators(points, technical_indicators or {})

    for point in points:
        peak = max(peak, point.price)
        drawdown = (point.price / peak) - 1.0
        max_drawdown = min(max_drawdown, drawdown)
        rows.append(
            DrawdownPoint(
                date=point.date,
                price=round(point.price, 6),
                open=round(point.open or point.price, 6),
                high=round(point.high or point.price, 6),
                low=round(point.low or point.price, 6),
                close=round(point.close or point.price, 6),
                drawdown=round(drawdown, 8),
                indicators=indicator_values.get(point.date, {}),
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


def count_unique_valid_symbols(symbols: list[str]) -> int:
    seen: set[str] = set()
    for raw_symbol in symbols:
        try:
            normalized = normalize_japanese_symbol(raw_symbol)
        except ValueError:
            continue
        seen.add(normalized)
    return len(seen)


def market_data_cache_ttl_seconds() -> int:
    raw_value = os.getenv("MARKET_DATA_CACHE_TTL_SECONDS")
    if raw_value is None:
        return DEFAULT_MARKET_DATA_CACHE_TTL_SECONDS
    try:
        return max(0, int(raw_value))
    except ValueError:
        return DEFAULT_MARKET_DATA_CACHE_TTL_SECONDS


def jquants_request_interval_seconds() -> float:
    raw_value = os.getenv("JQUANTS_REQUEST_INTERVAL_SECONDS")
    if raw_value is None:
        return DEFAULT_JQUANTS_REQUEST_INTERVAL_SECONDS
    try:
        return max(0.0, float(raw_value))
    except ValueError:
        return DEFAULT_JQUANTS_REQUEST_INTERVAL_SECONDS


def jquants_free_data_lag_weeks() -> int:
    raw_value = os.getenv("JQUANTS_FREE_DATA_LAG_WEEKS")
    if raw_value is None:
        return DEFAULT_JQUANTS_FREE_DATA_LAG_WEEKS
    try:
        return max(0, int(raw_value))
    except ValueError:
        return DEFAULT_JQUANTS_FREE_DATA_LAG_WEEKS


def create_app(provider: MarketDataProvider | None = None) -> FastAPI:
    app = FastAPI(title="Stock Drawdown API", version="0.1.0")
    
    provider_type = normalize_market_data_provider(os.getenv("MARKET_DATA_PROVIDER"))
    if provider:
        market_data_provider = provider
    elif provider_type == "jquants":
        market_data_provider = JQuantsMarketDataProvider()
    else:
        market_data_provider = YFinanceMarketDataProvider()

    cache_ttl_seconds = market_data_cache_ttl_seconds()
    jquants_interval_seconds = jquants_request_interval_seconds() if provider is None else 0.0
    last_jquants_request_at = 0.0
    # Cache key: (provider_type, scope, symbol, period, custom_months, jquants_free_tier)
    price_cache: dict[tuple[str, str, str, str, int | None, bool], CachedMarketPrices] = {}
    # Cache key: (provider_type, scope, symbol)
    security_name_cache: dict[tuple[str, str, str], CachedSecurityName] = {}

    def get_credential_scope(api_key: str | None) -> str:
        if provider_type == "yfinance":
            return "public"
        server_key = get_jquants_api_key_from_env()
        if server_key and (api_key is None or api_key == server_key):
            return "server"
        if api_key:
            return hash_api_key(api_key)
        return "none"

    def wait_for_jquants_rate_limit() -> None:
        nonlocal last_jquants_request_at
        if provider_type != "jquants" or jquants_interval_seconds <= 0:
            return

        now = time.monotonic()
        remaining = jquants_interval_seconds - (now - last_jquants_request_at)
        if remaining > 0:
            time.sleep(remaining)
            now = time.monotonic()
        last_jquants_request_at = now

    def get_cached_prices(
        symbol: str, period: str, custom_months: int | None, api_key: str | None, jquants_free_tier: bool
    ) -> list[PricePoint]:
        scope = get_credential_scope(api_key)
        cache_key = (provider_type, scope, symbol, period, custom_months, jquants_free_tier)
        now = time.time()
        cached = price_cache.get(cache_key)
        if cached and cached.expires_at > now:
            return list(cached.points)

        wait_for_jquants_rate_limit()
        prices = market_data_provider.get_adjusted_close(
            symbol, period, custom_months, api_key=api_key, jquants_free_tier=jquants_free_tier
        )
        if cache_ttl_seconds > 0:
            price_cache[cache_key] = CachedMarketPrices(expires_at=now + cache_ttl_seconds, points=list(prices))
        return prices

    def get_cached_security_name(symbol: str, api_key: str | None) -> str | None:
        scope = get_credential_scope(api_key)
        cache_key = (provider_type, scope, symbol)
        now = time.time()
        cached = security_name_cache.get(cache_key)
        if cached and cached.expires_at > now:
            return cached.name

        wait_for_jquants_rate_limit()
        name = market_data_provider.get_security_name(symbol, api_key=api_key)
        if name is not None and cache_ttl_seconds > 0:
            security_name_cache[cache_key] = CachedSecurityName(expires_at=now + cache_ttl_seconds, name=name)
        return name

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/config", response_model=AppConfig)
    def config() -> AppConfig:
        jquants_key_env = get_jquants_api_key_from_env()
        return AppConfig(
            enabled=is_auth_enabled(),
            google_client_id=get_google_client_id(),
            market_data_provider=provider_type,
            jquants_api_key_available=jquants_key_env is not None,
            requires_jquants_api_key_input=(provider_type == "jquants" and jquants_key_env is None),
        )

    @app.get("/api/market-events", response_model=list[MarketEvent])
    def market_events(_: str | None = Depends(require_user)) -> list[MarketEvent]:
        return load_market_events()

    @app.get("/api/securities", response_model=list[SecurityInfo])
    def securities(_: str | None = Depends(require_user)) -> list[SecurityInfo]:
        return load_local_securities()

    @app.post("/api/drawdowns", response_model=DrawdownResponse)
    def drawdowns(request: DrawdownRequest, _: str | None = Depends(require_user)) -> DrawdownResponse:
        period = normalize_period(request.period)
        custom_months = normalize_custom_months(period, request.custom_months)
        requested_start_date, requested_end_date = requested_date_range(period, custom_months)
        candle_interval = normalize_candle_interval(request.candle_interval)
        technical_indicators = normalize_technical_indicators(request.technical_indicators)
        results: list[SymbolDrawdownResult] = []

        effective_api_key = get_jquants_api_key_from_env() or request.jquants_api_key
        if provider_type == "jquants" and request.jquants_free_tier and count_unique_valid_symbols(request.symbols) > 5:
            raise HTTPException(status_code=400, detail="J-Quants無料枠では最大5銘柄まで選択できます")
        if provider_type == "jquants" and not effective_api_key:
            raise HTTPException(status_code=400, detail="J-Quants APIキーが必要です")

        seen_symbols: set[str] = set()
        for input_symbol in request.symbols:
            normalized_symbol: str | None = None
            try:
                normalized_symbol = normalize_japanese_symbol(input_symbol)
                if normalized_symbol in seen_symbols:
                    continue
                seen_symbols.add(normalized_symbol)
                
                prices = get_cached_prices(
                    normalized_symbol,
                    period,
                    custom_months,
                    api_key=effective_api_key,
                    jquants_free_tier=request.jquants_free_tier,
                )
                prices = aggregate_price_points(prices, candle_interval)
                name = get_cached_security_name(normalized_symbol, api_key=effective_api_key)
                
                data, max_drawdown, current_drawdown = calculate_drawdown(prices, technical_indicators)
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
                # Ensure API key is not in error message
                error_msg = str(exc)
                if effective_api_key and effective_api_key in error_msg:
                    error_msg = "データ取得エラーが発生しました"
                results.append(
                    SymbolDrawdownResult(
                        input_symbol=input_symbol,
                        symbol=fallback_symbol,
                        display_symbol=to_display_symbol(fallback_symbol),
                        error=error_msg,
                    )
                )

        return DrawdownResponse(
            period=period,
            custom_months=custom_months,
            requested_start_date=requested_start_date,
            requested_end_date=requested_end_date,
            candle_interval=candle_interval,
            technical_indicators=technical_indicators,
            results=results,
        )

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon() -> FileResponse:
        return FileResponse(STATIC_DIR / "favicon.svg")

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


app = create_app()
