const { useEffect, useMemo, useState } = React;
const h = React.createElement;
const STORAGE_KEY = "drawdown-board-symbols";
const SELECTED_SECURITIES_STORAGE_KEY = "drawdown-board-selected-security-codes-v2";
const PERIOD_STORAGE_KEY = "drawdown-board-period";
const CUSTOM_MONTHS_STORAGE_KEY = "drawdown-board-custom-months";
const CANDLE_INTERVAL_STORAGE_KEY = "drawdown-board-candle-interval";
const DD_RANGE_STORAGE_KEY = "drawdown-board-dd-range";
const X_ZOOM_STORAGE_KEY = "drawdown-board-x-zoom";
const TECHNICAL_INDICATORS_STORAGE_KEY = "drawdown-board-technical-indicators";
const FORECAST_PREVIEW_STORAGE_KEY = "drawdown-board-forecast-preview";
const TIMESFM_REPOSITORY_URL = "https://github.com/google-research/timesfm";
const AFFILIATE_ADS = [
  {
    label: "広告 / PR",
    title: "5年で1億貯める株式投資",
    description: "給料に手をつけず爆速でお金を増やす4つの投資法 [ kenmo（湘南投資勉強会） ]",
    price: "価格: 1870円",
    note: "(2026/5/16 15:52時点) / 感想(29件)",
    href: "https://rpx.a8.net/svt/ejp?a8mat=4B3RV1+E80T0Y+2HOM+BWGDT&rakuten=y&a8ejpredirect=https%3A%2F%2Fhb.afl.rakuten.co.jp%2Fhgc%2Fg00q0724.2bo11c45.g00q0724.2bo12179%2Fa26051613923_4B3RV1_E80T0Y_2HOM_BWGDT%3Fpc%3Dhttps%253A%252F%252Fitem.rakuten.co.jp%252Fbook%252F18158375%252F%26m%3Dhttp%253A%252F%252Fm.rakuten.co.jp%252Fbook%252Fi%252F21543588%252F%26rafcid%3Dwsc_i_is_a9f492a7-8ef9-40e2-ab89-4bc43a1ee283",
    imageSrc: "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/1184/9784478121184_1_13.jpg?_ex=64x64",
    trackingPixelSrc: "https://www17.a8.net/0.gif?a8mat=4B3RV1+E80T0Y+2HOM+BWGDT",
  },
  {
    label: "広告 / PR",
    variant: "banner",
    href: "https://px.a8.net/svt/ejp?a8mat=4B3RV1+EIQLWY+ONS+TUO9T",
    imageSrc: "https://www29.a8.net/svt/bgt?aid=260516557878&wid=001&eno=01&mid=s00000003196005014000&mc=1",
    imageWidth: 100,
    imageHeight: 60,
    trackingPixelSrc: "https://www14.a8.net/0.gif?a8mat=4B3RV1+EIQLWY+ONS+TUO9T",
  },
  {
    label: "広告 / PR",
    variant: "banner",
    href: "https://px.a8.net/svt/ejp?a8mat=4B3XBB+4CL0VM+4SM6+60OXD",
    imageSrc: "https://www23.a8.net/svt/bgt?aid=260523623263&wid=001&eno=01&mid=s00000022371001011000&mc=1",
    imageWidth: 200,
    imageHeight: 200,
    trackingPixelSrc: "https://www19.a8.net/0.gif?a8mat=4B3XBB+4CL0VM+4SM6+60OXD",
  },
];
const DEFAULT_SYMBOLS = "7203, 6758, 9984";
const DEFAULT_SECURITY_CODES = [];
const BENCHMARK_SYMBOL = "^N225";
const JQUANTS_FREE_TIER_SELECTION_LIMIT = 5;
const DEFAULT_SELECTION_LIMIT = 20;
const PERIOD_OPTIONS = [
  ["1mo", "1ヶ月"],
  ["3mo", "3ヶ月"],
  ["6mo", "6ヶ月"],
  ["1y", "1年"],
  ["2y", "2年"],
  ["5y", "5年"],
  ["max", "最大"],
  ["custom", "カスタム"],
];
const SERIES_COLORS = ["#146c78", "#bf3f37", "#6b5b95", "#2d7d46", "#c47722", "#3f6fb5", "#8a4f7d", "#6f6b2f"];
const BENCHMARK_COLOR = "#111111";
const CANDLE_INTERVAL_OPTIONS = [
  ["daily", "日足"],
  ["weekly", "週足"],
  ["monthly", "月足"],
];
const TECHNICAL_INDICATOR_OPTIONS = [
  ["sma", "SMA"],
  ["ema", "EMA"],
  ["bbands", "BBands"],
];
const DEFAULT_TECHNICAL_INDICATORS = {
  sma: { enabled: false, period: 20 },
  ema: { enabled: false, period: 20 },
  bbands: { enabled: false, period: 20 },
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function formatAxisPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
}

function formatTickPrice(value) {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
}

function formatDateTick(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
  if (!value) return "-";
  return value;
}

function formatDateTimeDisplay(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDays(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value}日`;
}

function isRecoveredPublicAnalysisStatus(status) {
  return status === "recovered" || status === "回復済" || status === "回復済み";
}

function parseSymbols(value) {
  return value
    .split(/[\s,、]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

function normalizeSecurityCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\.T$/, "");
}

function parseStoredSecurityCodes(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeSecurityCode).filter(Boolean);
    }
  } catch {
    // Fall through to legacy comma-separated parsing.
  }
  const parsed = parseSymbols(value).map(normalizeSecurityCode).filter((code) => code !== BENCHMARK_SYMBOL);
  return parsed.length ? parsed : null;
}

function uniqueCodes(codes) {
  const seen = new Set();
  return codes
    .map(normalizeSecurityCode)
    .filter((code) => {
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

function symbolsWithBenchmark(symbols, marketDataProvider) {
  const normalized = symbols.map((symbol) => symbol.trim()).filter(Boolean);
  if (marketDataProvider === "jquants") {
    return normalized;
  }
  const hasBenchmark = normalized.some((symbol) => symbol.toUpperCase() === BENCHMARK_SYMBOL);
  return hasBenchmark ? normalized : [BENCHMARK_SYMBOL, ...normalized];
}

function clampCustomMonths(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(Math.max(Math.round(parsed), 1), 600);
}

function makeAuthHeaders(authConfig, authToken) {
  if (!authConfig?.enabled) return {};
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function clampZoomPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.round(parsed), 5), 100);
}

function clampTechnicalPeriod(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.round(parsed), 1), 100);
}

function technicalIndicatorKey(type, period, suffix = null) {
  const base = `${type}${period}`;
  return suffix ? `${base}_${suffix}` : base;
}

function defaultTechnicalIndicators() {
  return Object.fromEntries(
    Object.entries(DEFAULT_TECHNICAL_INDICATORS).map(([type, setting]) => [type, { ...setting }])
  );
}

function parseLegacyIndicatorList(value) {
  const next = defaultTechnicalIndicators();
  value
    .split(",")
    .map((indicator) => indicator.trim().toLowerCase())
    .filter(Boolean)
    .forEach((indicator) => {
      const match = indicator.match(/^(sma|ema|bbands)(\d{1,3})$/);
      if (!match) return;
      const [, type, period] = match;
      next[type] = { enabled: true, period: clampTechnicalPeriod(period) };
    });
  return next;
}

function parseStoredIndicators(value) {
  if (!value) return defaultTechnicalIndicators();
  try {
    const parsed = JSON.parse(value);
    const next = defaultTechnicalIndicators();
    for (const [type] of TECHNICAL_INDICATOR_OPTIONS) {
      if (!parsed[type]) continue;
      next[type] = {
        enabled: Boolean(parsed[type].enabled),
        period: clampTechnicalPeriod(parsed[type].period),
      };
    }
    return next;
  } catch {
    return parseLegacyIndicatorList(value);
  }
}

function storeTechnicalIndicators(indicators) {
  localStorage.setItem(TECHNICAL_INDICATORS_STORAGE_KEY, JSON.stringify(indicators));
}

function zoomData(data, zoomPercent) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const visibleCount = Math.max(2, Math.ceil(data.length * (zoomPercent / 100)));
  return data.slice(Math.max(0, data.length - visibleCount));
}

function parseDateMs(value) {
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatIsoDateFromMs(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function visibleDateRange(dateRange, zoomPercent) {
  if (!dateRange?.start || !dateRange?.end) return null;
  const startMs = parseDateMs(dateRange.start);
  const endMs = parseDateMs(dateRange.end);
  if (startMs === null || endMs === null || endMs <= startMs) return dateRange;

  const ratio = Math.min(Math.max(zoomPercent, 1), 100) / 100;
  const span = endMs - startMs;
  const visibleStartMs = endMs - span * ratio;
  return { start: formatIsoDateFromMs(visibleStartMs), end: dateRange.end };
}

function zoomDataByDate(data, dateRange) {
  if (!Array.isArray(data) || data.length === 0 || !dateRange?.start || !dateRange?.end) return data || [];
  return data.filter((point) => point.date >= dateRange.start && point.date <= dateRange.end);
}

function zoomResult(result, zoomPercent, dateRange) {
  if (!result || !Array.isArray(result.data)) return result;
  const visibleRange = visibleDateRange(dateRange, zoomPercent);
  return { ...result, data: visibleRange ? zoomDataByDate(result.data, visibleRange) : zoomData(result.data, zoomPercent) };
}

function colorForSeries(result, index) {
  return result.symbol === BENCHMARK_SYMBOL ? BENCHMARK_COLOR : SERIES_COLORS[index % SERIES_COLORS.length];
}

function xForIndex(index, count, area) {
  return area.left + (index / Math.max(count - 1, 1)) * (area.right - area.left);
}

function xForDate(dateValue, domain, area) {
  const startMs = parseDateMs(domain.start);
  const endMs = parseDateMs(domain.end);
  const valueMs = parseDateMs(dateValue);
  if (startMs === null || endMs === null || valueMs === null || endMs <= startMs) return null;
  return area.left + ((valueMs - startMs) / (endMs - startMs)) * (area.right - area.left);
}

function yForValue(value, min, max, area) {
  const span = max - min || 1;
  return area.bottom - ((value - min) / span) * (area.bottom - area.top);
}

function createLinearTicks(min, max, count) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2) return [];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

function buildPath(points, valueOf, area) {
  if (!points.length) return "";
  const values = points.map(valueOf);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return points
    .map((point, index) => {
      const x = xForIndex(index, points.length, area);
      const y = yForValue(valueOf(point), min, max, area);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildFixedRangePath(points, valueOf, min, max, area, xDomain = null) {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const rawValue = valueOf(point);
      const value = Math.min(Math.max(rawValue, min), max);
      const x = xDomain ? xForDate(point.date, xDomain, area) : xForIndex(index, points.length, area);
      if (x === null) return "";
      const y = yForValue(value, min, max, area);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function buildFixedRangeTopFillPath(points, valueOf, min, max, area, xDomain = null) {
  if (!points.length) return "";
  const topY = yForValue(max, min, max, area);
  const curve = points.map((point, index) => {
    const rawValue = valueOf(point);
    const value = Math.min(Math.max(rawValue, min), max);
    const x = xDomain ? xForDate(point.date, xDomain, area) : xForIndex(index, points.length, area);
    if (x === null) return "";
    const y = yForValue(value, min, max, area);
    return `${index === 0 ? "L" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).filter(Boolean);
  const firstX = xDomain ? xForDate(points[0].date, xDomain, area) : xForIndex(0, points.length, area);
  const lastX = xDomain ? xForDate(points[points.length - 1].date, xDomain, area) : xForIndex(points.length - 1, points.length, area);
  if (firstX === null || lastX === null) return "";
  return [`M ${firstX.toFixed(2)} ${topY.toFixed(2)}`, ...curve, `L ${lastX.toFixed(2)} ${topY.toFixed(2)}`, "Z"].join(" ");
}

function buildForecastBandPath(points, min, max, area, xDomain) {
  if (!points.length) return "";
  const lowerPath = points
    .map((point) => {
      const x = xForDate(point.date, xDomain, area);
      if (x === null) return "";
      return `L ${x.toFixed(2)} ${yForValue(Math.max(point.lower, min), min, max, area).toFixed(2)}`;
    })
    .filter(Boolean);
  const upperPath = [...points]
    .reverse()
    .map((point) => {
      const x = xForDate(point.date, xDomain, area);
      if (x === null) return "";
      return `L ${x.toFixed(2)} ${yForValue(Math.min(point.upper, max), min, max, area).toFixed(2)}`;
    })
    .filter(Boolean);
  const firstX = xForDate(points[0].date, xDomain, area);
  if (firstX === null) return "";
  return [
    `M ${firstX.toFixed(2)} ${yForValue(Math.max(points[0].lower, min), min, max, area).toFixed(2)}`,
    ...lowerPath.slice(1),
    ...upperPath,
    "Z",
  ].join(" ");
}

function candleWidth(count, area) {
  const slot = (area.right - area.left) / Math.max(count, 1);
  return Math.max(2, Math.min(slot * 0.62, 16));
}

function indicatorSeriesKeys(selectedIndicators) {
  const keys = [];
  for (const [type] of TECHNICAL_INDICATOR_OPTIONS) {
    const setting = selectedIndicators[type];
    if (!setting?.enabled) continue;
    const period = clampTechnicalPeriod(setting.period);
    if (type === "bbands") {
      keys.push(
        technicalIndicatorKey(type, period, "lower"),
        technicalIndicatorKey(type, period, "middle"),
        technicalIndicatorKey(type, period, "upper")
      );
    } else {
      keys.push(technicalIndicatorKey(type, period));
    }
  }
  return keys;
}

function colorForIndicatorKey(key) {
  if (key.startsWith("sma")) return "#2d7d46";
  if (key.startsWith("ema")) return "#c47722";
  if (key.endsWith("_middle")) return "#9aa3aa";
  if (key.startsWith("bbands")) return "#7a8790";
  return "#555";
}

function labelForIndicatorKey(key) {
  const bandMatch = key.match(/^bbands(\d+)_(lower|middle|upper)$/);
  if (bandMatch) {
    const suffixLabel = { lower: "下限", middle: "中央", upper: "上限" }[bandMatch[2]];
    return `BBands ${bandMatch[1]} ${suffixLabel}`;
  }
  const match = key.match(/^(sma|ema)(\d+)$/);
  if (match) return `${match[1].toUpperCase()} ${match[2]}`;
  return key.toUpperCase();
}

function buildIndicatorPath(points, key, min, max, area, xDomain = null) {
  const segments = [];
  points.forEach((point, index) => {
    const value = point.indicators?.[key];
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const x = xDomain ? xForDate(point.date, xDomain, area) : xForIndex(index, points.length, area);
    if (x === null) return;
    const y = yForValue(value, min, max, area);
    segments.push(`${segments.length === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  return segments.join(" ");
}

function successfulResults(results) {
  return results.filter((result) => !result.error && Array.isArray(result.data) && result.data.length > 0);
}

function dateTicksForDomain(domain, count) {
  const startMs = parseDateMs(domain.start);
  const endMs = parseDateMs(domain.end);
  if (startMs === null || endMs === null || count < 2) return [];
  return createLinearTicks(startMs, endMs, count).map((value) => formatIsoDateFromMs(value));
}

function nearestPointByDateRatio(data, ratio, domain) {
  if (!data.length) return null;
  const startMs = parseDateMs(domain.start);
  const endMs = parseDateMs(domain.end);
  if (startMs === null || endMs === null || endMs <= startMs) return data[0];
  const targetMs = startMs + Math.min(Math.max(ratio, 0), 1) * (endMs - startMs);
  return data.reduce((nearest, point) => {
    const nearestDistance = Math.abs((parseDateMs(nearest.date) || 0) - targetMs);
    const pointDistance = Math.abs((parseDateMs(point.date) || 0) - targetMs);
    return pointDistance < nearestDistance ? point : nearest;
  }, data[0]);
}

function eventXPosition(eventDate, domain, area) {
  if (!domain?.start || !domain?.end || eventDate < domain.start || eventDate > domain.end) return null;
  return xForDate(eventDate, domain, area);
}

function missingDataRects(data, domain, area) {
  if (!data.length || !domain?.start || !domain?.end) return null;
  const startX = xForDate(data[0].date, domain, area);
  const endX = xForDate(data[data.length - 1].date, domain, area);
  if (startX === null || endX === null) return null;
  const clampedStartX = Math.min(Math.max(startX, area.left), area.right);
  const clampedEndX = Math.min(Math.max(endX, area.left), area.right);
  return [
    { x: area.left, width: Math.max(0, clampedStartX - area.left) },
    { x: clampedEndX, width: Math.max(0, area.right - clampedEndX) },
  ].filter((rect) => rect.width > 0.5);
}

function OverlayDrawdownChart({ results, ddRange, marketEvents, dateRange }) {
  const width = 920;
  const height = 320;
  const area = { left: 72, right: width - 72, top: 24, bottom: height - 52 };
  const [hoverRatio, setHoverRatio] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const series = successfulResults(results);
  if (!series.length) return null;

  const baseData = series.reduce((longest, result) => (result.data.length > longest.length ? result.data : longest), []);
  const xDomain = visibleDateRange(dateRange, 100) || { start: baseData[0]?.date, end: baseData[baseData.length - 1]?.date };
  const ddTicks = createLinearTicks(-ddRange / 100, 0, 6);
  const xTickDates = dateTicksForDomain(xDomain, 6);
  const missingDataWindows = missingDataRects(baseData, xDomain, area);
  const hoverX = hoverRatio === null ? null : area.left + hoverRatio * (area.right - area.left);
  const hoverRows =
    hoverRatio === null
      ? []
      : series.map((result, index) => ({
          result,
          color: colorForSeries(result, index),
          point: nearestPointByDateRatio(result.data, hoverRatio, xDomain),
        }));
  const hoverDate = hoverRows.find((row) => row.point)?.point?.date || "";
  const visibleEvents = (marketEvents || [])
    .map((event) => ({ ...event, x: eventXPosition(event.date, xDomain, area) }))
    .filter((event) => event.x !== null);

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    setHoverRatio(relativeX / Math.max(rect.width, 1));
  }

  return h(
    "section",
    { className: "comparison-panel" },
    h(
      "div",
      { className: "comparison-head" },
      h("div", null, h("h2", null, "Drawdownプロファイル比較"), h("p", null, "選択期間内のdrawdownを重ね描き")),
      h("span", null, `DD軸 0〜-${ddRange}%`)
    ),
    h(
      "div",
      { className: "chart-wrap comparison-chart" },
      h(
        "svg",
        {
          viewBox: `0 0 ${width} ${height}`,
          role: "img",
          "aria-label": "drawdown comparison chart",
          onPointerMove,
          onPointerLeave: () => setHoverRatio(null),
        },
        missingDataWindows.map((rect, index) =>
          h("rect", { key: `overlay-missing-${index}`, x: rect.x, y: area.top, width: rect.width, height: area.bottom - area.top, className: "missing-data-window" })
        ),
        h("line", { x1: area.left, y1: area.bottom, x2: area.right, y2: area.bottom, className: "axis" }),
        h("line", { x1: area.left, y1: area.top, x2: area.left, y2: area.bottom, className: "axis" }),
        ddTicks.map((tick) => {
          const y = yForValue(tick, -ddRange / 100, 0, area);
          return h(
            React.Fragment,
            { key: `overlay-dd-${tick}` },
            h("line", { x1: area.left - 5, y1: y, x2: area.right, y2: y, className: "grid-line" }),
            h("text", { x: area.left - 10, y: y + 4, className: "axis-label dd-label", textAnchor: "end" }, formatAxisPercent(tick))
          );
        }),
        xTickDates.map((tickDate) => {
          const x = xForDate(tickDate, xDomain, area);
          return h(
            React.Fragment,
            { key: `overlay-x-${tickDate}` },
            h("line", { x1: x, y1: area.bottom, x2: x, y2: area.bottom + 5, className: "tick-line" }),
            h("text", { x, y: area.bottom + 24, className: "axis-label", textAnchor: "middle" }, formatDateTick(tickDate))
          );
        }),
        series.map((result, index) =>
          h("path", {
            key: result.symbol,
            d: buildFixedRangePath(result.data, (point) => point.drawdown, -ddRange / 100, 0, area, xDomain),
            className: "overlay-line",
            style: { stroke: colorForSeries(result, index) },
          })
        ),
        visibleEvents.map((event) =>
          h(
            React.Fragment,
            { key: `${event.date}-${event.name}` },
            h("line", { x1: event.x, y1: area.top, x2: event.x, y2: area.bottom, className: "event-line" }),
            h("line", {
              x1: event.x,
              y1: area.top,
              x2: event.x,
              y2: area.bottom,
              className: "event-hit-line",
              onPointerEnter: () => setHoveredEvent(event),
              onPointerLeave: () => setHoveredEvent(null),
            })
          )
        ),
        hoveredEvent &&
          h(
            "text",
            {
              x: Math.min(hoveredEvent.x + 7, area.right - 180),
              y: area.top + 18,
              className: "event-label",
            },
            `${hoveredEvent.name} ${formatDateTick(hoveredEvent.date)}`
          ),
        hoverRatio !== null && h("line", { x1: hoverX, y1: area.top, x2: hoverX, y2: area.bottom, className: "hover-line" })
      ),
      hoverRatio !== null &&
        h(
          "div",
          { className: "overlay-tooltip" },
          h("strong", null, hoverDate),
          hoverRows.map(({ result, color, point }) =>
            h(
              "div",
              { key: result.symbol, className: "tooltip-row" },
              h("span", { className: "series-dot", style: { backgroundColor: color } }),
              h("span", null, result.name ? `${result.display_symbol} ${result.name}` : result.display_symbol),
              h("b", null, formatPercent(point?.drawdown))
            )
          )
        )
    ),
    h(
      "div",
      { className: "series-legend" },
      series.map((result, index) =>
        h(
          "span",
          { key: result.symbol },
          h("i", { style: { backgroundColor: colorForSeries(result, index) } }),
          h("b", null, result.display_symbol),
          result.name ? h("em", null, result.name) : null
        )
      )
    )
  );
}

function DrawdownChart({ result, ddRange, marketEvents, technicalIndicators, dateRange }) {
  const width = 920;
  const height = 316;
  const area = { left: 72, right: width - 72, top: 18, bottom: height - 50 };
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const data = result.data || [];
  const forecastPoints = result.forecast?.status === "ok" ? result.forecast.points || [] : [];
  if (!data.length) {
    return h("div", { className: "empty-chart" }, "データなし");
  }
  const baseDomain = visibleDateRange(dateRange, 100) || { start: data[0].date, end: data[data.length - 1].date };
  const xDomain = forecastPoints.length
    ? { start: baseDomain.start, end: forecastPoints[forecastPoints.length - 1].date }
    : baseDomain;

  const indicatorKeys = indicatorSeriesKeys(technicalIndicators);
  const indicatorValues = data.flatMap((point) =>
    indicatorKeys.map((key) => point.indicators?.[key]).filter((value) => value !== null && value !== undefined && !Number.isNaN(value))
  );
  const prices = data
    .flatMap((point) => [point.high ?? point.price, point.low ?? point.price])
    .concat(indicatorValues);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const priceTicks = createLinearTicks(priceMin, priceMax, 4);
  const ddTicks = createLinearTicks(-ddRange / 100, 0, 6);
  const xTickDates = dateTicksForDomain(xDomain, 6);
  const missingDataWindows = missingDataRects(data, xDomain, area);
  const drawdownFillPath = buildFixedRangeTopFillPath(data, (point) => point.drawdown, -ddRange / 100, 0, area, xDomain);
  const forecastFillPath = buildFixedRangeTopFillPath(forecastPoints, (point) => point.mean, -ddRange / 100, 0, area, xDomain);
  const forecastLowerPath = buildFixedRangePath(forecastPoints, (point) => point.lower, -ddRange / 100, 0, area, xDomain);
  const forecastUpperPath = buildFixedRangePath(forecastPoints, (point) => point.upper, -ddRange / 100, 0, area, xDomain);
  const bodyWidth = candleWidth(data.length, area);
  const latest = data[data.length - 1];
  const first = data[0];
  const hoverPoint = hoverIndex === null ? null : data[hoverIndex];
  const hoverX =
    hoverIndex === null
      ? null
      : xForDate(data[hoverIndex].date, xDomain, area);
  const visibleEvents = (marketEvents || [])
    .map((event) => ({ ...event, x: eventXPosition(event.date, xDomain, area) }))
    .filter((event) => event.x !== null);

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const ratio = relativeX / Math.max(rect.width, 1);
    const targetPoint = nearestPointByDateRatio(data, ratio, xDomain);
    const nextIndex = targetPoint ? data.findIndex((point) => point.date === targetPoint.date) : 0;
    setHoverIndex(Math.min(Math.max(nextIndex, 0), data.length - 1));
  }

  return h(
    "div",
    { className: "chart-wrap" },
    h(
      "svg",
      {
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": `${result.display_symbol} drawdown chart`,
        onPointerMove,
        onPointerLeave: () => setHoverIndex(null),
      },
      missingDataWindows.map((rect, index) =>
        h("rect", {
          key: `missing-${index}`,
          x: rect.x,
          y: area.top,
          width: rect.width,
          height: area.bottom - area.top,
          className: "missing-data-window",
        })
      ),
      h("line", { x1: area.left, y1: area.bottom, x2: area.right, y2: area.bottom, className: "axis" }),
      h("line", { x1: area.left, y1: area.top, x2: area.left, y2: area.bottom, className: "axis" }),
      h("line", { x1: area.right, y1: area.top, x2: area.right, y2: area.bottom, className: "axis" }),
      priceTicks.map((tick) => {
        const y = yForValue(tick, priceMin, priceMax, area);
        return h(
          React.Fragment,
          { key: `price-${tick}` },
          h("line", { x1: area.left - 5, y1: y, x2: area.right, y2: y, className: "grid-line" }),
          h("text", { x: area.left - 10, y: y + 4, className: "axis-label", textAnchor: "end" }, formatTickPrice(tick))
        );
      }),
      ddTicks.map((tick) => {
        const y = yForValue(tick, -ddRange / 100, 0, area);
        return h(
          React.Fragment,
          { key: `dd-${tick}` },
          h("line", { x1: area.right, y1: y, x2: area.right + 5, y2: y, className: "tick-line" }),
          h("text", { x: area.right + 10, y: y + 4, className: "axis-label dd-label" }, formatAxisPercent(tick))
        );
      }),
      xTickDates.map((tickDate) => {
        const x = xForDate(tickDate, xDomain, area);
        return h(
          React.Fragment,
          { key: `x-${tickDate}` },
          h("line", { x1: x, y1: area.bottom, x2: x, y2: area.bottom + 5, className: "tick-line" }),
          h("text", { x, y: area.bottom + 24, className: "axis-label", textAnchor: "middle" }, formatDateTick(tickDate))
        );
      }),
      h("path", { d: drawdownFillPath, className: "drawdown-fill" }),
      forecastFillPath ? h("path", { d: forecastFillPath, className: "forecast-fill" }) : null,
      forecastLowerPath ? h("path", { d: forecastLowerPath, className: "forecast-interval-line" }) : null,
      forecastUpperPath ? h("path", { d: forecastUpperPath, className: "forecast-interval-line" }) : null,
      data.map((point, index) => {
        const x = xForDate(point.date, xDomain, area);
        if (x === null) return null;
        const open = point.open ?? point.price;
        const high = point.high ?? point.price;
        const low = point.low ?? point.price;
        const close = point.close ?? point.price;
        const highY = yForValue(high, priceMin, priceMax, area);
        const lowY = yForValue(low, priceMin, priceMax, area);
        const openY = yForValue(open, priceMin, priceMax, area);
        const closeY = yForValue(close, priceMin, priceMax, area);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
        const isUp = close >= open;
        return h(
          React.Fragment,
          { key: `candle-${point.date}` },
          h("line", { x1: x, y1: highY, x2: x, y2: lowY, className: isUp ? "candle-wick is-up" : "candle-wick is-down" }),
          h("rect", {
            x: x - bodyWidth / 2,
            y: bodyTop,
            width: bodyWidth,
            height: bodyHeight,
            className: isUp ? "candle-body is-up" : "candle-body is-down",
          })
        );
      }),
      indicatorKeys.map((key) => {
        const indicatorPath = buildIndicatorPath(data, key, priceMin, priceMax, area, xDomain);
        return indicatorPath
          ? h("path", {
              key: `indicator-${key}`,
              d: indicatorPath,
              className: "indicator-line",
              style: { stroke: colorForIndicatorKey(key) },
            })
          : null;
      }),
      visibleEvents.map((event) =>
        h(
          React.Fragment,
          { key: `${result.symbol}-${event.date}-${event.name}` },
          h("line", { x1: event.x, y1: area.top, x2: event.x, y2: area.bottom, className: "event-line" }),
          h("line", {
            x1: event.x,
            y1: area.top,
            x2: event.x,
            y2: area.bottom,
            className: "event-hit-line",
            onPointerEnter: () => setHoveredEvent(event),
            onPointerLeave: () => setHoveredEvent(null),
          })
        )
      ),
      hoveredEvent &&
        h(
          "text",
          {
            x: Math.min(hoveredEvent.x + 7, area.right - 180),
            y: area.top + 18,
            className: "event-label",
          },
          `${hoveredEvent.name} ${formatDateTick(hoveredEvent.date)}`
        ),
      hoverPoint && h("line", { x1: hoverX, y1: area.top, x2: hoverX, y2: area.bottom, className: "hover-line" })
    ),
    hoverPoint &&
      h(
        "div",
        { className: "chart-tooltip" },
        h("span", null, hoverPoint.date),
        h(
          "strong",
          null,
          `O ${formatPrice(hoverPoint.open)} / H ${formatPrice(hoverPoint.high)} / L ${formatPrice(hoverPoint.low)} / C ${formatPrice(hoverPoint.close)}`
        ),
        h("b", null, formatPercent(hoverPoint.drawdown))
        ,
        indicatorKeys.length
          ? h(
              "span",
              { className: "tooltip-indicators" },
              indicatorKeys
                .filter((key) => hoverPoint.indicators?.[key] !== null && hoverPoint.indicators?.[key] !== undefined)
                .map((key) => `${labelForIndicatorKey(key)}: ${formatPrice(hoverPoint.indicators[key])}`)
                .join(" / ")
            )
          : null
      ),
    h(
      "div",
      { className: "chart-footer" },
      h("span", null, first?.date || ""),
      h("span", null, `最新 ${latest?.date || ""} / ${formatPrice(latest?.price)}`)
    )
  );
}

function ResultCard({ result, ddRange, marketEvents, technicalIndicators, dateRange }) {
  const hasError = Boolean(result.error);
  const title = result.name || result.display_symbol || result.input_symbol;
  const subtitleParts = [result.display_symbol, result.symbol].filter(Boolean);
  return h(
    "section",
    { className: `result-card${hasError ? " is-error" : ""}` },
    h(
      "div",
      { className: "card-head" },
      h("div", null, h("h2", null, title), h("p", null, subtitleParts.join(" / "))),
      h(
        "div",
        { className: "metrics" },
        h("div", { className: "metric" }, h("span", null, "最大DD"), h("strong", null, formatPercent(result.max_drawdown))),
        h("div", { className: "metric" }, h("span", null, "現在DD"), h("strong", null, formatPercent(result.current_drawdown)))
      )
    ),
    hasError
      ? h("div", { className: "error-box" }, result.error)
      : [
          h(
            "div",
            { key: "recovery", className: "recovery-strip" },
            h("div", null, h("span", null, "ピーク"), h("strong", null, formatDateDisplay(result.peak_date))),
            h("div", null, h("span", null, "底日"), h("strong", null, formatDateDisplay(result.trough_date))),
            h(
              "div",
              null,
              h("span", null, "回復"),
              h("strong", null, result.is_recovered ? formatDateDisplay(result.recovery_date) : "未回復")
            ),
            h("div", null, h("span", null, "水面下"), h("strong", null, formatDays(result.underwater_days))),
            h(
              "div",
              null,
              h("span", null, result.is_recovered ? "回復日数" : "回復進捗"),
              h("strong", null, result.is_recovered ? formatDays(result.recovery_days) : formatPercent(result.recovery_progress))
            )
          ),
          h(DrawdownChart, { key: "chart", result, ddRange, marketEvents, technicalIndicators, dateRange }),
          result.forecast
            ? h(
                "div",
                { key: "forecast", className: `forecast-note is-${result.forecast.status}` },
                result.forecast.status === "ok"
                  ? "時系列予測はpreviewです。投資判断を推奨するものではありません。"
                  : result.forecast.message || "時系列予測を表示できません。"
              )
            : null,
        ]
  );
}

function HelpPage() {
  return h(
    "section",
    { className: "help-page" },
    h("h2", null, "ヘルプ / FAQ"),
    h(
      "article",
      { className: "faq-card" },
      h("h3", null, "Q1. Googleログイン情報はなぜ必要なのですか？"),
      h(
        "p",
        null,
        "公開サイトとしての不正利用を抑えるため、本人確認にGoogleログインを使っています。確認するのはGoogleが検証したID tokenとメールアドレスで、Googleパスワード、Google APIアクセストークン、refresh token、GmailやDriveへの権限は取得しません。メールアドレスはアクセス判定にのみ使い、永続保存しません。"
      )
    ),
    h(
      "article",
      { className: "faq-card" },
      h("h3", null, "Q2. J-Quants APIキーはなぜ必要なのですか？安全に利用されるのですか？"),
      h(
        "p",
        null,
        "株価データをJ-Quantsから取得するために必要です。このサイトは利用者自身のAPIキーで価格取得を行う方針です。入力されたキーは価格取得リクエスト時だけサーバーへ送信され、ブラウザやサーバーに永続保存しません。キャッシュ分離が必要な場合も、キーの生値ではなくハッシュを使います。APIキーはJ-Quants公式サイトでユーザー登録とAPI利用手続きを行って取得してください。"
      ),
      h(
        "div",
        { className: "help-links" },
        h(
          "a",
          { href: "https://jpx-jquants.com/ja", target: "_blank", rel: "noreferrer" },
          "J-Quants公式サイトを開く"
        )
      )
    ),
    h(
      "article",
      { className: "faq-card" },
      h("h3", null, "Q3. 分析ツールの開発をしたい"),
      h(
        "p",
        null,
        "このサイトの実装はGitHubで公開しています。構成や実装を参考にしたい場合は、リポジトリをご覧ください。"
      ),
      h(
        "div",
        { className: "help-links" },
        h(
          "a",
          { href: "https://github.com/ykknd/stock-drawdown-chart-web", target: "_blank", rel: "noreferrer" },
          "GitHubリポジトリを開く"
        )
      )
    ),
    h(
      "article",
      { className: "faq-card" },
      h("h3", null, "問い合わせ"),
      h("p", null, "問い合わせフォームは準備中です。")
    )
  );
}

function DrawdownPreviewFigure() {
  return h(
    "figure",
    { className: "public-preview" },
    h(
      "svg",
      {
        viewBox: "0 0 560 320",
        role: "img",
        "aria-labelledby": "preview-title preview-desc",
      },
      h("title", { id: "preview-title" }, "株価とdrawdownの見方"),
      h("desc", { id: "preview-desc" }, "株価の高値、下落、回復とdrawdown率の関係を示した図"),
      h("rect", { x: 0, y: 0, width: 560, height: 320, rx: 8, className: "preview-surface" }),
      h("line", { x1: 44, y1: 54, x2: 516, y2: 54, className: "preview-grid" }),
      h("line", { x1: 44, y1: 118, x2: 516, y2: 118, className: "preview-grid" }),
      h("line", { x1: 44, y1: 182, x2: 516, y2: 182, className: "preview-grid" }),
      h("line", { x1: 44, y1: 246, x2: 516, y2: 246, className: "preview-grid" }),
      h("line", { x1: 44, y1: 266, x2: 516, y2: 266, className: "preview-axis" }),
      h("line", { x1: 44, y1: 34, x2: 44, y2: 266, className: "preview-axis" }),
      h("path", {
        d: "M44 170 C84 150 108 96 148 104 C182 110 206 70 248 82 C288 92 312 176 350 206 C386 234 420 170 450 132 C474 102 492 112 516 92",
        className: "preview-price-line",
      }),
      h("path", {
        d: "M44 58 L100 58 L148 58 L206 58 L248 58 C286 58 308 122 350 178 C386 226 420 168 450 124 C474 88 492 88 516 88",
        className: "preview-peak-line",
      }),
      h("path", {
        d: "M44 266 L44 58 L100 58 L148 58 L206 58 L248 58 C286 58 308 122 350 178 C386 226 420 168 450 124 C474 88 492 88 516 88 L516 266 Z",
        className: "preview-dd-fill",
      }),
      h("line", { x1: 350, y1: 34, x2: 350, y2: 266, className: "preview-event-line" }),
      h("circle", { cx: 248, cy: 82, r: 6, className: "preview-peak-dot" }),
      h("circle", { cx: 350, cy: 206, r: 6, className: "preview-trough-dot" }),
      h("circle", { cx: 516, cy: 92, r: 6, className: "preview-recovery-dot" }),
      h("text", { x: 256, y: 70, className: "preview-label" }, "高値"),
      h("text", { x: 362, y: 220, className: "preview-label" }, "底値"),
      h("text", { x: 430, y: 78, className: "preview-label" }, "回復"),
      h("text", { x: 360, y: 48, className: "preview-event-label" }, "暴落日"),
      h("text", { x: 48, y: 302, className: "preview-caption" }, "株価推移とdrawdownの関係")
    )
  );
}

function PublicAnalysisSection({ publicAnalysis, loading }) {
  const snapshot = publicAnalysis?.snapshot || null;
  const [sortKey, setSortKey] = useState("current_drawdown_pct");
  const [sortDirection, setSortDirection] = useState("desc");
  const rows = snapshot?.items || [];
  const sortedRows = useMemo(() => {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const leftValue = left?.[sortKey] ?? 0;
      const rightValue = right?.[sortKey] ?? 0;
      if (leftValue === rightValue) {
        return String(left.code || "").localeCompare(String(right.code || ""), "ja");
      }
      return leftValue > rightValue ? multiplier : -multiplier;
    });
  }, [rows, sortDirection, sortKey]);

  function onSort(nextKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  }

  return h(
    "section",
    { className: "public-analysis-section" },
    h(
      "div",
      { className: "public-analysis-head" },
      h(
        "div",
        null,
        h("p", { className: "eyebrow" }, "公開ランキング"),
        h("h2", null, "日経225採用銘柄の公開暴落ランキング"),
        h(
          "p",
          { className: "public-analysis-lead" },
          "先月末の日経225構成銘柄と月次の時価総額上位リストをもとに、直近5年の現在進行中の下落と戻りを毎営業日集計します。"
        )
      ),
      h(
        "div",
        { className: "public-analysis-meta" },
        h("span", null, snapshot ? `更新: ${formatDateTimeDisplay(snapshot.published_at)}` : "更新: 未集計"),
        h("span", null, snapshot ? `対象: ${snapshot.item_count}銘柄` : "対象: -"),
        h("span", null, snapshot?.universe_month ? `母集団月: ${snapshot.universe_month}` : "母集団月: -")
      )
    ),
    h(
      "div",
      { className: "public-analysis-notes" },
      h("p", null, "指標の見方: 暴落率は直近5年高値からの下落率、暴落期間はその高値を更新できていない日数、回復度合いは底値から高値までに対する戻り率です。")
    ),
    publicAnalysis?.message ? h("div", { className: `notice${publicAnalysis?.stale ? " public-analysis-stale" : ""}` }, publicAnalysis.message) : null,
    loading && !snapshot
      ? h("div", { className: "public-analysis-empty" }, "公開ランキングを読み込み中です")
      : !snapshot
        ? h("div", { className: "public-analysis-empty" }, "公開ランキングはまだ集計されていません")
        : h(
            "div",
            { className: "public-analysis-results" },
            h(
              "div",
              { className: "public-analysis-table-wrap" },
              h(
                "table",
                { className: "public-analysis-table" },
                h(
                  "thead",
                  null,
                  h(
                    "tr",
                    null,
                    h("th", null, "銘柄コード"),
                    h("th", null, "銘柄名"),
                    h(
                      "th",
                      null,
                      h(
                        "button",
                        { type: "button", className: "sort-button", onClick: () => onSort("current_drawdown_pct") },
                        `暴落率${sortKey === "current_drawdown_pct" ? ` ${sortDirection === "desc" ? "▼" : "▲"}` : ""}`
                      )
                    ),
                    h(
                      "th",
                      null,
                      h(
                        "button",
                        { type: "button", className: "sort-button", onClick: () => onSort("current_drawdown_days") },
                        `暴落期間${sortKey === "current_drawdown_days" ? ` ${sortDirection === "desc" ? "▼" : "▲"}` : ""}`
                      )
                    ),
                    h(
                      "th",
                      null,
                      h(
                        "button",
                        { type: "button", className: "sort-button", onClick: () => onSort("recovery_progress_pct") },
                        `回復度合い${sortKey === "recovery_progress_pct" ? ` ${sortDirection === "desc" ? "▼" : "▲"}` : ""}`
                      )
                    ),
                    h("th", null, "状態")
                  )
                ),
                h(
                  "tbody",
                  null,
                  sortedRows.map((row) =>
                    {
                      const recovered = isRecoveredPublicAnalysisStatus(row.status);
                      return h(
                        "tr",
                        { key: row.code },
                        h("td", null, row.code),
                        h("td", { className: "public-analysis-name" }, row.name),
                        h("td", null, formatPercent(row.current_drawdown_pct)),
                        h("td", null, formatDays(row.current_drawdown_days)),
                        h("td", null, formatPercent(row.recovery_progress_pct)),
                        h(
                          "td",
                          null,
                          h(
                            "span",
                            {
                              className: `public-analysis-status ${recovered ? "is-recovered" : "is-progress"}`,
                            },
                            recovered ? "回復済" : "未回復"
                          )
                        )
                      );
                    }
                  )
                )
              )
            ),
            h(
              "p",
              { className: "public-analysis-footnote" },
              "備考: 暴落率 = 1 - 現在値 / 直近5年高値、回復度合い = (現在値 - 底値) / (直近5年高値 - 底値) で計算し、表示上は百分率に換算しています。状態は、暴落率が0%で直近5年高値を回復している銘柄を「回復済」、それ以外を「未回復」としています。暴落期間が5年の観測期間に達している銘柄は、基準となる高値が観測開始時点に近く、暴落率の解釈に注意が必要です。分析結果には誤りが含まれる可能性があり、投資の最終判断は投資家本人が行ってください。"
            )
          )
  );
}

function PublicLandingPage({ authError, onEnterApp, publicAnalysis, publicAnalysisLoading }) {
  return h(
    "main",
    { className: "app-shell public-shell" },
    h(
      "div",
      { className: "public-workspace" },
      h(
        "div",
        { className: "public-main" },
        h(
          "section",
          { className: "public-hero" },
          h(
            "div",
            { className: "public-copy" },
            h("p", { className: "eyebrow" }, "日本株の下落耐性を可視化"),
            h("h1", null, "Drawdown Board"),
            h(
              "p",
              { className: "public-lead" },
              "選んだ銘柄の株価、drawdown、回復までの日数を並べて比較できる分析ツールです。銘柄名で検索し、期間を選び、下落の深さと戻り方を一画面で確認できます。"
            )
          ),
          h(DrawdownPreviewFigure)
        ),
        h(PublicAnalysisSection, { publicAnalysis, loading: publicAnalysisLoading }),
        h(
          "section",
          { className: "public-access-section" },
          h(
            "div",
            { className: "public-access-card" },
            h("div", { id: "google-signin", className: "google-signin" }),
            h(
              "div",
              { className: "public-access-inline" },
              onEnterApp
                ? h(
                    "button",
                    { type: "button", className: "public-enter-button", onClick: onEnterApp },
                    "分析画面へ戻る"
                  )
                : null,
              h(
                "div",
                { className: "public-key-note" },
                h("p", null, "分析機能の利用にはGoogleログインが必要です。利用にはJ-Quants APIキーが必要です。ログイン後に入力して株価データを取得します。")
              )
            ),
            authError ? h("div", { className: "notice" }, authError) : null
          ),
          h(
            "div",
            { className: "public-feature-strip" },
            h("div", null, h("strong", null, "Drawdown比較"), h("span", null, "複数銘柄を同じ軸で比較")),
            h("div", null, h("strong", null, "回復力"), h("span", null, "高値から底値、回復日まで表示")),
            h("div", null, h("strong", null, "ローソク足"), h("span", null, "日足・週足・月足を切替")),
            h("div", null, h("strong", null, "時系列予測 preview"), h("span", null, "日足のみ / TimesFMで14営業日先のDDを試算"))
          )
        ),
        h(HelpPage),
        h(PrivacyFooter, { publicFooter: true })
      ),
      h(AffiliateAdPanel)
    )
  );
}

function PrivacyFooter({ publicFooter = false }) {
  return h(
    "footer",
    { className: `privacy-footer${publicFooter ? " public-privacy-footer" : ""}` },
    h("p", null, "Googleログインは本人確認のみに使用します。Googleパスワード、Google APIアクセストークン、refresh tokenは取得・保存しません。J-Quants APIキーは価格取得リクエスト時のみ送信され、ブラウザやサーバーに永続保存しません。"),
    h(
      "p",
      null,
      "時系列予測 preview の予測モデルには ",
      h("a", { href: TIMESFM_REPOSITORY_URL, target: "_blank", rel: "noreferrer" }, "TimesFM"),
      " を使用しています。予測は将来の値動きを保証するものではなく、投資判断およびその結果については利用者ご自身の責任で行ってください。"
    ),
    h("p", null, "本サイトの情報は投資判断の参考情報であり、投資判断を推奨するものではありません。")
  );
}

function AffiliateAdPanel() {
  return h(
    "aside",
    { className: "affiliate-ad-panel", "aria-label": "広告" },
    AFFILIATE_ADS.map((ad) => {
      if (ad.variant === "banner") {
        return h(
          "article",
          { className: "affiliate-ad-item affiliate-ad-banner", key: ad.href },
          h("span", { className: "affiliate-ad-label" }, ad.label),
          h(
            "a",
            { className: "affiliate-ad-banner-link", href: ad.href, target: "_blank", rel: "nofollow sponsored noreferrer" },
            h("img", {
              className: "affiliate-ad-banner-image",
              src: ad.imageSrc,
              alt: "",
              width: ad.imageWidth || 100,
              height: ad.imageHeight || 60,
            })
          ),
          h("img", { className: "affiliate-tracking-pixel", src: ad.trackingPixelSrc, alt: "", width: 1, height: 1 })
        );
      }
      return (
      h(
        "article",
        { className: "affiliate-ad-item", key: ad.href },
        h("span", { className: "affiliate-ad-label" }, ad.label),
        h(
          "a",
          { className: "affiliate-ad-body", href: ad.href, target: "_blank", rel: "nofollow sponsored noreferrer" },
          h("img", { className: "affiliate-ad-image", src: ad.imageSrc, alt: "", width: 64, height: 64 }),
          h(
            "span",
            { className: "affiliate-ad-copy" },
            h("strong", null, ad.title),
            h("span", null, ad.description),
            h("b", null, ad.price),
            h("small", null, ad.note)
          )
        ),
        h("img", { className: "affiliate-tracking-pixel", src: ad.trackingPixelSrc, alt: "", width: 1, height: 1 })
      )
      );
    })
  );
}

function App() {
  const [selectedSecurityCodes, setSelectedSecurityCodes] = useState(() =>
    uniqueCodes(
      parseStoredSecurityCodes(localStorage.getItem(SELECTED_SECURITIES_STORAGE_KEY)) || DEFAULT_SECURITY_CODES
    )
  );
  const [securitySearch, setSecuritySearch] = useState("");
  const [securityNotice, setSecurityNotice] = useState("");
  const [securities, setSecurities] = useState([]);
  const [period, setPeriod] = useState(() => localStorage.getItem(PERIOD_STORAGE_KEY) || "1y");
  const [customMonths, setCustomMonths] = useState(() => clampCustomMonths(localStorage.getItem(CUSTOM_MONTHS_STORAGE_KEY) || 53));
  const [candleInterval, setCandleInterval] = useState(() => localStorage.getItem(CANDLE_INTERVAL_STORAGE_KEY) || "daily");
  const [ddRange, setDdRange] = useState(() => Number(localStorage.getItem(DD_RANGE_STORAGE_KEY) || 50));
  const [xZoom, setXZoom] = useState(() => clampZoomPercent(localStorage.getItem(X_ZOOM_STORAGE_KEY) || 100));
  const [technicalIndicators, setTechnicalIndicators] = useState(() =>
    parseStoredIndicators(localStorage.getItem(TECHNICAL_INDICATORS_STORAGE_KEY))
  );
  const [forecastPreview, setForecastPreview] = useState(() => localStorage.getItem(FORECAST_PREVIEW_STORAGE_KEY) === "true");
  const [results, setResults] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [marketEvents, setMarketEvents] = useState([]);
  const [appConfig, setAppConfig] = useState({
    loaded: false,
    enabled: false,
    google_client_id: null,
    market_data_provider: "yfinance",
    jquants_api_key_available: false,
    requires_jquants_api_key_input: false,
    market_data_cache_backend: "memory",
    market_data_cache_daily_enabled: true,
    forecast_preview_enabled: false,
  });
  const [jquantsApiKey, setJquantsApiKey] = useState("");
  const [jquantsFreeTier, setJquantsFreeTier] = useState(() => {
    const stored = localStorage.getItem("drawdown-board-jquants-free-tier");
    return stored === null ? true : stored === "true";
  });
  const [authToken, setAuthToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPublicLanding, setShowPublicLanding] = useState(false);
  const [publicAnalysis, setPublicAnalysis] = useState({ snapshot: null, stale: true, message: "" });
  const [publicAnalysisLoading, setPublicAnalysisLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const securitiesByCode = useMemo(
    () => new Map(securities.map((security) => [normalizeSecurityCode(security.code), security])),
    [securities]
  );
  const symbols = selectedSecurityCodes;
  const isFreeTierLimited = appConfig.market_data_provider === "jquants" && jquantsFreeTier;
  const selectionLimit = isFreeTierLimited ? JQUANTS_FREE_TIER_SELECTION_LIMIT : DEFAULT_SELECTION_LIMIT;
  const overSelectionLimit = selectedSecurityCodes.length > selectionLimit;
  const normalizedSecuritySearch = securitySearch.trim().toLowerCase();
  const filteredSecurities = useMemo(() => {
    if (!normalizedSecuritySearch) return [];
    return securities
      .filter((security) => {
        const code = normalizeSecurityCode(security.code);
        const name = String(security.name || "").toLowerCase();
        return name.includes(normalizedSecuritySearch) || code.toLowerCase().includes(normalizedSecuritySearch);
      })
      .slice(0, 20);
  }, [securities, normalizedSecuritySearch]);
  const visibleRange = useMemo(() => visibleDateRange(dateRange, xZoom), [dateRange, xZoom]);
  const zoomedResults = useMemo(() => results.map((result) => zoomResult(result, xZoom, dateRange)), [results, xZoom, dateRange]);

  async function fetchDrawdowns(
    nextSymbols = symbols,
    nextPeriod = period,
    nextCandleInterval = candleInterval,
    nextTechnicalIndicators = technicalIndicators,
    nextJQuantsFreeTier = jquantsFreeTier,
    nextCustomMonths = customMonths,
    nextForecastPreview = forecastPreview
  ) {
    if (!nextSymbols.length) return;
    if (appConfig.enabled && !authToken) return;
    if (appConfig.market_data_provider === "jquants" && nextJQuantsFreeTier && nextSymbols.length > JQUANTS_FREE_TIER_SELECTION_LIMIT) {
      setError("J-Quants無料枠では最大5銘柄まで選択できます");
      return;
    }
    if (appConfig.requires_jquants_api_key_input && !jquantsApiKey) {
      setError("J-Quants APIキーを入力してください");
      return;
    }
    const requestSymbols = symbolsWithBenchmark(nextSymbols, appConfig.market_data_provider);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drawdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...makeAuthHeaders(appConfig, authToken) },
        body: JSON.stringify({
          symbols: requestSymbols,
          period: nextPeriod,
          custom_months: nextPeriod === "custom" ? nextCustomMonths : null,
          candle_interval: nextCandleInterval,
          technical_indicators: nextTechnicalIndicators,
          forecast_preview: nextForecastPreview && nextCandleInterval === "daily" && appConfig.forecast_preview_enabled,
          jquants_api_key: jquantsApiKey || null,
          jquants_free_tier: nextJQuantsFreeTier,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `API error: ${response.status}`);
      }
      const payload = await response.json();
      setResults(payload.results || []);
      setDateRange(
        payload.requested_start_date && payload.requested_end_date
          ? { start: payload.requested_start_date, end: payload.requested_end_date }
          : null
      );
      const storedCodes = uniqueCodes(nextSymbols.filter((symbol) => symbol.toUpperCase() !== BENCHMARK_SYMBOL));
      localStorage.setItem(SELECTED_SECURITIES_STORAGE_KEY, JSON.stringify(storedCodes));
      localStorage.setItem(STORAGE_KEY, storedCodes.join(", "));
      localStorage.setItem(PERIOD_STORAGE_KEY, nextPeriod);
      localStorage.setItem(CUSTOM_MONTHS_STORAGE_KEY, String(nextCustomMonths));
      localStorage.setItem(CANDLE_INTERVAL_STORAGE_KEY, nextCandleInterval);
      storeTechnicalIndicators(nextTechnicalIndicators);
      setDirty(false);
    } catch (err) {
      setError(err.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPublicAnalysisLoading(true);
    fetch("/api/public-analysis")
      .then((response) => (response.ok ? response.json() : { snapshot: null, stale: true, message: "公開ランキングの取得に失敗しました。" }))
      .then((payload) =>
        setPublicAnalysis({
          snapshot: payload?.snapshot || null,
          stale: Boolean(payload?.stale),
          message: payload?.message || "",
        })
      )
      .catch(() => setPublicAnalysis({ snapshot: null, stale: true, message: "公開ランキングの取得に失敗しました。" }))
      .finally(() => setPublicAnalysisLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((payload) =>
        setAppConfig({
          loaded: true,
          enabled: Boolean(payload.enabled),
          google_client_id: payload.google_client_id || null,
          market_data_provider: payload.market_data_provider || "yfinance",
          jquants_api_key_available: Boolean(payload.jquants_api_key_available),
          requires_jquants_api_key_input: Boolean(payload.requires_jquants_api_key_input),
          market_data_cache_backend: payload.market_data_cache_backend || "memory",
          market_data_cache_daily_enabled: payload.market_data_cache_daily_enabled !== false,
          forecast_preview_enabled: Boolean(payload.forecast_preview_enabled),
        })
      )
      .catch(() =>
        setAppConfig({
          loaded: true,
          enabled: false,
          google_client_id: null,
          market_data_provider: "yfinance",
          jquants_api_key_available: false,
          requires_jquants_api_key_input: false,
          market_data_cache_backend: "memory",
          market_data_cache_daily_enabled: true,
          forecast_preview_enabled: false,
        })
      );
  }, []);

  useEffect(() => {
    if (!appConfig.loaded || !appConfig.enabled || !appConfig.google_client_id || authToken) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (!window.google?.accounts?.id) {
        if (attempts > 40) {
          clearInterval(timer);
          setAuthError("Googleログインの読み込みに失敗しました");
        }
        return;
      }
      clearInterval(timer);
      window.google.accounts.id.initialize({
        client_id: appConfig.google_client_id,
        callback: (response) => {
          setAuthToken(response.credential || "");
          setShowPublicLanding(false);
          setAuthError("");
        },
      });
      window.google.accounts.id.renderButton(document.getElementById("google-signin"), {
        theme: "outline",
        size: "large",
        text: "signin_with",
      });
    }, 250);
    return () => clearInterval(timer);
  }, [appConfig.loaded, appConfig.enabled, appConfig.google_client_id, authToken]);

  useEffect(() => {
    if (!appConfig.loaded) return;
    if (appConfig.enabled && !authToken) return;
    fetch("/api/market-events", { headers: makeAuthHeaders(appConfig, authToken) })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setMarketEvents(Array.isArray(payload) ? payload : []))
      .catch(() => setMarketEvents([]));
    fetch("/api/securities", { headers: makeAuthHeaders(appConfig, authToken) })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => {
        const nextSecurities = Array.isArray(payload) ? payload : [];
        setSecurities(nextSecurities);
        if (!nextSecurities.length) return;
        const validCodes = new Set(nextSecurities.map((security) => normalizeSecurityCode(security.code)));
        setSelectedSecurityCodes((currentCodes) => {
          const validSelected = uniqueCodes(currentCodes).filter((code) => validCodes.has(code));
          const missingCodes = uniqueCodes(currentCodes).filter((code) => !validCodes.has(code));
          if (missingCodes.length) {
            setSecurityNotice(`銘柄一覧にないコードを除外しました: ${missingCodes.join(", ")}`);
          }
          localStorage.setItem(SELECTED_SECURITIES_STORAGE_KEY, JSON.stringify(validSelected));
          return validSelected;
        });
      })
      .catch(() => {
        setSecurities([]);
        setSecurityNotice("銘柄一覧の読み込みに失敗しました");
      });
  }, [appConfig.loaded, appConfig.enabled, authToken]);

  function addSecurity(code) {
    const normalizedCode = normalizeSecurityCode(code);
    if (!normalizedCode || selectedSecurityCodes.includes(normalizedCode)) return;
    if (selectedSecurityCodes.length >= selectionLimit) {
      setSecurityNotice(
        isFreeTierLimited
          ? "J-Quants無料枠では最大5銘柄まで選択できます"
          : `最大${DEFAULT_SELECTION_LIMIT}銘柄まで選択できます`
      );
      return;
    }
    const nextCodes = [...selectedSecurityCodes, normalizedCode];
    setSelectedSecurityCodes(nextCodes);
    localStorage.setItem(SELECTED_SECURITIES_STORAGE_KEY, JSON.stringify(nextCodes));
    setSecuritySearch("");
    setSecurityNotice("");
    setDirty(true);
  }

  function removeSecurity(code) {
    const normalizedCode = normalizeSecurityCode(code);
    const nextCodes = selectedSecurityCodes.filter((selectedCode) => selectedCode !== normalizedCode);
    setSelectedSecurityCodes(nextCodes);
    localStorage.setItem(SELECTED_SECURITIES_STORAGE_KEY, JSON.stringify(nextCodes));
    setSecurityNotice("");
    setDirty(true);
  }

  function onPeriodChange(event) {
    const nextPeriod = event.target.value;
    setPeriod(nextPeriod);
    setDirty(true);
  }

  function onCustomYearsChange(event) {
    const years = Math.min(Math.max(Number(event.target.value) || 0, 0), 50);
    const months = customMonths % 12;
    const nextMonths = clampCustomMonths(years * 12 + months);
    setCustomMonths(nextMonths);
    setDirty(true);
  }

  function onCustomRemainderMonthsChange(event) {
    const years = Math.floor(customMonths / 12);
    const months = Math.min(Math.max(Number(event.target.value) || 0, 0), 11);
    const nextMonths = clampCustomMonths(years * 12 + months);
    setCustomMonths(nextMonths);
    setDirty(true);
  }

  function onDdRangeChange(event) {
    const nextRange = Number(event.target.value);
    setDdRange(nextRange);
    localStorage.setItem(DD_RANGE_STORAGE_KEY, String(nextRange));
  }

  function onXZoomChange(event) {
    const nextZoom = clampZoomPercent(event.target.value);
    setXZoom(nextZoom);
    localStorage.setItem(X_ZOOM_STORAGE_KEY, String(nextZoom));
  }

  function onCandleIntervalChange(event) {
    const nextInterval = event.target.value;
    setCandleInterval(nextInterval);
    setDirty(true);
  }

  function updateTechnicalIndicators(nextIndicators) {
    setTechnicalIndicators(nextIndicators);
    setDirty(true);
  }

  function onTechnicalIndicatorEnabledChange(event) {
    const value = event.target.value;
    const checked = event.target.checked;
    updateTechnicalIndicators({
      ...technicalIndicators,
      [value]: {
        ...(technicalIndicators[value] || DEFAULT_TECHNICAL_INDICATORS[value]),
        enabled: checked,
      },
    });
  }

  function onTechnicalIndicatorPeriodChange(type, value) {
    updateTechnicalIndicators({
      ...technicalIndicators,
      [type]: {
        ...(technicalIndicators[type] || DEFAULT_TECHNICAL_INDICATORS[type]),
        period: clampTechnicalPeriod(value),
      },
    });
  }

  function onForecastPreviewChange(event) {
    const checked = event.target.checked;
    setForecastPreview(checked);
    localStorage.setItem(FORECAST_PREVIEW_STORAGE_KEY, String(checked));
    setDirty(true);
  }

  function onJQuantsFreeTierChange(event) {
    const nextFreeTier = event.target.checked;
    setJquantsFreeTier(nextFreeTier);
    localStorage.setItem("drawdown-board-jquants-free-tier", String(nextFreeTier));
    if (appConfig.market_data_provider === "jquants" && nextFreeTier && selectedSecurityCodes.length > JQUANTS_FREE_TIER_SELECTION_LIMIT) {
      setSecurityNotice("J-Quants無料枠では最大5銘柄まで選択できます。選択数を減らしてください。");
    } else {
      setSecurityNotice("");
    }
    setDirty(true);
  }

  function onSubmit(event) {
    event.preventDefault();
    fetchDrawdowns(symbols, period, candleInterval, technicalIndicators, jquantsFreeTier, customMonths, forecastPreview);
  }

  function onUpdateClick() {
    fetchDrawdowns(symbols, period, candleInterval, technicalIndicators, jquantsFreeTier, customMonths, forecastPreview);
  }

  function returnToPublicLanding() {
    window.google?.accounts?.id?.disableAutoSelect?.();
    setShowPublicLanding(true);
    setAuthToken("");
    setAuthError("");
    setShowHelp(false);
    setError("");
  }

  function enterAppFromPublicLanding() {
    setShowPublicLanding(false);
    setAuthError("");
  }

  if (!appConfig.loaded) {
    return h("main", { className: "app-shell" }, h("div", { className: "auth-panel" }, "読み込み中"));
  }

  if (showPublicLanding || (appConfig.enabled && !authToken)) {
    return h(PublicLandingPage, {
      authError,
      onEnterApp: !appConfig.enabled ? enterAppFromPublicLanding : null,
      publicAnalysis,
      publicAnalysisLoading,
    });
  }

  return h(
    "main",
    { className: "app-shell" },
    h(
      "div",
      { className: "workspace-shell" },
      h(
        "div",
        { className: "workspace-main" },
        h(
          "section",
          { className: "settings-panel" },
          h(
            "header",
            { className: "topbar" },
            h(
              "div",
              { className: "title-row" },
              h("div", null, h("h1", null, "Drawdown Board"), h("p", null, "日本株 / 調整後終値")),
              h(
                "div",
                { className: "title-actions" },
                h(
                  "button",
                  { type: "button", className: "help-toggle", onClick: returnToPublicLanding },
                  "ログイン前画面"
                ),
                h(
                  "button",
                  { type: "button", className: "help-toggle", onClick: () => setShowHelp(!showHelp) },
                  showHelp ? "チャートに戻る" : "ヘルプ / FAQ"
                )
              )
            ),
            h(
              "form",
              { className: "symbol-form", onSubmit },
              h(
                "div",
                { className: "security-selector" },
                h("input", {
                  value: securitySearch,
                  onChange: (event) => setSecuritySearch(event.target.value),
                  placeholder: "企業名・銘柄名で検索",
                  "aria-label": "銘柄名検索",
                  disabled: loading,
                }),
                normalizedSecuritySearch
                  ? h(
                      "div",
                      { className: "security-candidates" },
                      filteredSecurities.length
                        ? filteredSecurities.map((security) => {
                            const code = normalizeSecurityCode(security.code);
                            const selected = selectedSecurityCodes.includes(code);
                            const disabled = selected || selectedSecurityCodes.length >= selectionLimit;
                            return h(
                              "button",
                              {
                                key: code,
                                type: "button",
                                className: "security-candidate",
                                disabled,
                                onClick: () => addSecurity(code),
                              },
                              h("span", null, security.name),
                              h("small", null, code)
                            );
                          })
                        : h("div", { className: "security-empty" }, "候補がありません")
                    )
                  : null,
                h(
                  "div",
                  { className: "selected-securities" },
                  selectedSecurityCodes.length
                    ? selectedSecurityCodes.map((code) => {
                        const security = securitiesByCode.get(code);
                        const label = security ? `${security.name}（${code}）` : code;
                        return h(
                          "span",
                          { key: code, className: "security-chip" },
                          h("span", null, label),
                          h("button", { type: "button", onClick: () => removeSecurity(code), "aria-label": `${label}を削除` }, "×")
                        );
                      })
                    : h("span", { className: "security-empty" }, "銘柄を選択してください")
                )
              ),
              h(
                "select",
                { value: period, onChange: onPeriodChange, "aria-label": "表示期間", disabled: loading },
                PERIOD_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label))
              ),
              period === "custom"
                ? h(
                    "div",
                    { className: "custom-period" },
                    h("input", {
                      type: "number",
                      min: "0",
                      max: "50",
                      value: Math.floor(customMonths / 12),
                      onChange: onCustomYearsChange,
                      "aria-label": "カスタム期間 年",
                    }),
                    h("span", null, "年"),
                    h("input", {
                      type: "number",
                      min: "0",
                      max: "11",
                      value: customMonths % 12,
                      onChange: onCustomRemainderMonthsChange,
                      "aria-label": "カスタム期間 月",
                    }),
                    h("span", null, "か月")
                  )
                : null,
              h("button", { type: "submit", disabled: loading || symbols.length === 0 || overSelectionLimit }, loading ? "取得中" : "更新")
            )
          ),
          dirty ? h("div", { className: "notice dirty-notice" }, "設定変更は未反映です。更新を押してください") : null,
          securityNotice ? h("div", { className: "notice" }, securityNotice) : null,
          overSelectionLimit
            ? h("div", { className: "notice" }, "J-Quants無料枠では最大5銘柄まで選択できます。選択数を減らしてください。")
            : null,
          appConfig.market_data_provider === "jquants"
            ? h(
                "details",
                { className: "jquants-settings-panel", open: true },
                h("summary", null, "J-Quants設定"),
                h(
                  "div",
                  { className: "jquants-settings-body" },
                  h(
                    "div",
                    { className: "jquants-tier-panel" },
                    h(
                      "label",
                      { className: "jquants-tier-control" },
                      h("input", {
                        type: "checkbox",
                        checked: jquantsFreeTier,
                        onChange: onJQuantsFreeTierChange,
                      }),
                      h("span", null, "J-Quants無料枠"),
                      h("small", null, "無料枠では直近12週を除いた範囲を取得します。レート制限を避けるため、無料枠ON時は最大5銘柄まで選択できます。有料枠の場合はチェックを外してください。")
                    )
                  ),
                  appConfig.requires_jquants_api_key_input
                    ? h(
                        "div",
                        { className: "jquants-key-panel" },
                        h(
                          "div",
                          { className: "jquants-key-input" },
                          h("span", null, "J-Quants APIキー:"),
                          h("input", {
                            type: "password",
                            value: jquantsApiKey,
                            onChange: (event) => setJquantsApiKey(event.target.value),
                            placeholder: "J-Quants APIキーを入力",
                            "aria-label": "J-Quants APIキー",
                          }),
                          h("small", null, "環境変数 JQUANTS_API_KEY を設定すると入力を省けます。")
                        )
                      )
                    : null
                )
              )
            : null,
          error ? h("div", { className: "notice" }, error) : null,
          h(
            "details",
            { className: "analysis-options-panel", open: true },
            h("summary", null, "分析オプション"),
            h(
              "div",
              { className: "analysis-options-body" },
              h(
                "div",
                { className: "analysis-update-row" },
                h(
                  "button",
                  { type: "button", className: "analysis-update-button", onClick: onUpdateClick, disabled: loading || symbols.length === 0 || overSelectionLimit },
                  loading ? "取得中" : "更新"
                )
              ),
              h(
                "div",
                { className: "chart-controls" },
                h(
                  "label",
                  { className: "range-control" },
                  h("span", null, `DD軸レンジ 0〜-${ddRange}%`),
                  h("input", {
                    type: "range",
                    min: "1",
                    max: "100",
                    step: "1",
                    value: ddRange,
                    onChange: onDdRangeChange,
                    "aria-label": "DD軸レンジ",
                  })
                ),
                h(
                  "label",
                  { className: "range-control" },
                  h("span", null, `表示期間 ${xZoom}%`),
                  h("input", {
                    type: "range",
                    min: "5",
                    max: "100",
                    step: "1",
                    value: xZoom,
                    onChange: onXZoomChange,
                    "aria-label": "x軸表示期間",
                  })
                ),
                h(
                  "label",
                  { className: "candle-control" },
                  h("span", null, "ローソク足"),
                  h(
                    "select",
                    { value: candleInterval, onChange: onCandleIntervalChange, "aria-label": "ローソク足の粒度", disabled: loading },
                    CANDLE_INTERVAL_OPTIONS.map(([value, label]) => h("option", { key: value, value }, label))
                  )
                ),
                h(
                  "div",
                  { className: "indicator-control" },
                  h("span", null, "テクニカル"),
                  h(
                    "div",
                    { className: "indicator-options" },
                    TECHNICAL_INDICATOR_OPTIONS.map(([value, label]) => {
                      const setting = technicalIndicators[value] || DEFAULT_TECHNICAL_INDICATORS[value];
                      return h(
                        "div",
                        { key: value, className: "indicator-option" },
                        h(
                          "label",
                          null,
                          h("input", {
                            type: "checkbox",
                            value,
                            checked: Boolean(setting.enabled),
                            onChange: onTechnicalIndicatorEnabledChange,
                          }),
                          h("span", null, label)
                        ),
                        h("span", { className: "indicator-separator" }, ":"),
                        h("input", {
                          type: "number",
                          min: "1",
                          max: "100",
                          step: "1",
                          value: setting.period,
                          disabled: !setting.enabled,
                          onChange: (event) => onTechnicalIndicatorPeriodChange(value, event.target.value),
                          "aria-label": `${label} 集約期間`,
                        })
                      );
                    }),
                    appConfig.forecast_preview_enabled
                      ? h(
                          "div",
                          { className: "indicator-option forecast-preview-option" },
                          h(
                            "label",
                            null,
                            h("input", {
                              type: "checkbox",
                              checked: forecastPreview,
                              disabled: candleInterval !== "daily",
                              onChange: onForecastPreviewChange,
                            }),
                            h("span", null, "時系列予測(preview)")
                          ),
                          candleInterval !== "daily" ? h("small", null, "日足のみ") : null
                        )
                      : null
                  )
                )
              )
            )
          )
        ),
        h(
          "section",
          { className: "chart-scroll" },
          showHelp
            ? h(HelpPage)
            : h(
                "div",
                { className: "results-grid" },
                h(OverlayDrawdownChart, { results: zoomedResults, ddRange, marketEvents, dateRange: visibleRange }),
                zoomedResults.map((result) =>
                  h(ResultCard, { key: result.symbol, result, ddRange, marketEvents, technicalIndicators, dateRange: visibleRange })
                )
              ),
          h(PrivacyFooter)
        )
      ),
      h(AffiliateAdPanel)
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
