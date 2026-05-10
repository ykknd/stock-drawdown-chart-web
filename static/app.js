const { useEffect, useMemo, useState } = React;
const h = React.createElement;
const STORAGE_KEY = "drawdown-board-symbols";
const PERIOD_STORAGE_KEY = "drawdown-board-period";
const CUSTOM_MONTHS_STORAGE_KEY = "drawdown-board-custom-months";
const CANDLE_INTERVAL_STORAGE_KEY = "drawdown-board-candle-interval";
const DD_RANGE_STORAGE_KEY = "drawdown-board-dd-range";
const X_ZOOM_STORAGE_KEY = "drawdown-board-x-zoom";
const TECHNICAL_INDICATORS_STORAGE_KEY = "drawdown-board-technical-indicators";
const DEFAULT_SYMBOLS = "7203, 6758, 9984";
const BENCHMARK_SYMBOL = "^N225";
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

function formatDays(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value}日`;
}

function parseSymbols(value) {
  return value
    .split(/[\s,、]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

function symbolsWithBenchmark(symbols) {
  const normalized = symbols.map((symbol) => symbol.trim()).filter(Boolean);
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

function zoomResult(result, zoomPercent) {
  if (!result || !Array.isArray(result.data)) return result;
  return { ...result, data: zoomData(result.data, zoomPercent) };
}

function colorForSeries(result, index) {
  return result.symbol === BENCHMARK_SYMBOL ? BENCHMARK_COLOR : SERIES_COLORS[index % SERIES_COLORS.length];
}

function xForIndex(index, count, area) {
  return area.left + (index / Math.max(count - 1, 1)) * (area.right - area.left);
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

function buildFixedRangePath(points, valueOf, min, max, area) {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const rawValue = valueOf(point);
      const value = Math.min(Math.max(rawValue, min), max);
      const x = xForIndex(index, points.length, area);
      const y = yForValue(value, min, max, area);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildFixedRangeTopFillPath(points, valueOf, min, max, area) {
  if (!points.length) return "";
  const topY = yForValue(max, min, max, area);
  const curve = points.map((point, index) => {
    const rawValue = valueOf(point);
    const value = Math.min(Math.max(rawValue, min), max);
    const x = xForIndex(index, points.length, area);
    const y = yForValue(value, min, max, area);
    return `${index === 0 ? "L" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const firstX = xForIndex(0, points.length, area);
  const lastX = xForIndex(points.length - 1, points.length, area);
  return [`M ${firstX.toFixed(2)} ${topY.toFixed(2)}`, ...curve, `L ${lastX.toFixed(2)} ${topY.toFixed(2)}`, "Z"].join(" ");
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

function buildIndicatorPath(points, key, min, max, area) {
  const segments = [];
  points.forEach((point, index) => {
    const value = point.indicators?.[key];
    if (value === null || value === undefined || Number.isNaN(value)) return;
    const x = xForIndex(index, points.length, area);
    const y = yForValue(value, min, max, area);
    segments.push(`${segments.length === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  });
  return segments.join(" ");
}

function successfulResults(results) {
  return results.filter((result) => !result.error && Array.isArray(result.data) && result.data.length > 0);
}

function nearestPointAtRatio(data, ratio) {
  if (!data.length) return null;
  const index = Math.round(Math.min(Math.max(ratio, 0), 1) * Math.max(data.length - 1, 0));
  return data[index];
}

function eventXPosition(eventDate, data, area) {
  if (!data.length) return null;
  const first = data[0].date;
  const last = data[data.length - 1].date;
  if (eventDate < first || eventDate > last) return null;

  let index = data.findIndex((point) => point.date >= eventDate);
  if (index === -1) index = data.length - 1;
  return xForIndex(index, data.length, area);
}

function OverlayDrawdownChart({ results, ddRange, marketEvents }) {
  const width = 920;
  const height = 320;
  const area = { left: 72, right: width - 72, top: 24, bottom: height - 52 };
  const [hoverRatio, setHoverRatio] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const series = successfulResults(results);
  if (!series.length) return null;

  const baseData = series.reduce((longest, result) => (result.data.length > longest.length ? result.data : longest), []);
  const ddTicks = createLinearTicks(-ddRange / 100, 0, 6);
  const xTickIndexes = createLinearTicks(0, baseData.length - 1, Math.min(6, baseData.length)).map((value) => Math.round(value));
  const hoverX = hoverRatio === null ? null : area.left + hoverRatio * (area.right - area.left);
  const hoverRows =
    hoverRatio === null
      ? []
      : series.map((result, index) => ({
          result,
          color: colorForSeries(result, index),
          point: nearestPointAtRatio(result.data, hoverRatio),
        }));
  const hoverDate = hoverRows.find((row) => row.point)?.point?.date || "";
  const visibleEvents = (marketEvents || [])
    .map((event) => ({ ...event, x: eventXPosition(event.date, baseData, area) }))
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
        xTickIndexes.map((tickIndex) => {
          const point = baseData[tickIndex];
          const x = xForIndex(tickIndex, baseData.length, area);
          return h(
            React.Fragment,
            { key: `overlay-x-${tickIndex}` },
            h("line", { x1: x, y1: area.bottom, x2: x, y2: area.bottom + 5, className: "tick-line" }),
            h("text", { x, y: area.bottom + 24, className: "axis-label", textAnchor: "middle" }, formatDateTick(point.date))
          );
        }),
        series.map((result, index) =>
          h("path", {
            key: result.symbol,
            d: buildFixedRangePath(result.data, (point) => point.drawdown, -ddRange / 100, 0, area),
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

function DrawdownChart({ result, ddRange, marketEvents, technicalIndicators }) {
  const width = 920;
  const height = 316;
  const area = { left: 72, right: width - 72, top: 18, bottom: height - 50 };
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const data = result.data || [];
  if (!data.length) {
    return h("div", { className: "empty-chart" }, "データなし");
  }

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
  const xTickIndexes = createLinearTicks(0, data.length - 1, Math.min(6, data.length)).map((value) => Math.round(value));
  const drawdownFillPath = buildFixedRangeTopFillPath(data, (point) => point.drawdown, -ddRange / 100, 0, area);
  const bodyWidth = candleWidth(data.length, area);
  const latest = data[data.length - 1];
  const first = data[0];
  const hoverPoint = hoverIndex === null ? null : data[hoverIndex];
  const hoverX =
    hoverIndex === null
      ? null
      : xForIndex(hoverIndex, data.length, area);
  const visibleEvents = (marketEvents || [])
    .map((event) => ({ ...event, x: eventXPosition(event.date, data, area) }))
    .filter((event) => event.x !== null);

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const ratio = relativeX / Math.max(rect.width, 1);
    const nextIndex = Math.round(ratio * Math.max(data.length - 1, 0));
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
      xTickIndexes.map((tickIndex) => {
        const point = data[tickIndex];
        const x = xForIndex(tickIndex, data.length, area);
        return h(
          React.Fragment,
          { key: `x-${tickIndex}` },
          h("line", { x1: x, y1: area.bottom, x2: x, y2: area.bottom + 5, className: "tick-line" }),
          h("text", { x, y: area.bottom + 24, className: "axis-label", textAnchor: "middle" }, formatDateTick(point.date))
        );
      }),
      h("path", { d: drawdownFillPath, className: "drawdown-fill" }),
      data.map((point, index) => {
        const x = xForIndex(index, data.length, area);
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
        const indicatorPath = buildIndicatorPath(data, key, priceMin, priceMax, area);
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

function ResultCard({ result, ddRange, marketEvents, technicalIndicators }) {
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
          h(DrawdownChart, { key: "chart", result, ddRange, marketEvents, technicalIndicators }),
        ]
  );
}

function App() {
  const [symbolsText, setSymbolsText] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_SYMBOLS);
  const [period, setPeriod] = useState(() => localStorage.getItem(PERIOD_STORAGE_KEY) || "1y");
  const [customMonths, setCustomMonths] = useState(() => clampCustomMonths(localStorage.getItem(CUSTOM_MONTHS_STORAGE_KEY) || 53));
  const [candleInterval, setCandleInterval] = useState(() => localStorage.getItem(CANDLE_INTERVAL_STORAGE_KEY) || "daily");
  const [ddRange, setDdRange] = useState(() => Number(localStorage.getItem(DD_RANGE_STORAGE_KEY) || 50));
  const [xZoom, setXZoom] = useState(() => clampZoomPercent(localStorage.getItem(X_ZOOM_STORAGE_KEY) || 100));
  const [technicalIndicators, setTechnicalIndicators] = useState(() =>
    parseStoredIndicators(localStorage.getItem(TECHNICAL_INDICATORS_STORAGE_KEY))
  );
  const [results, setResults] = useState([]);
  const [marketEvents, setMarketEvents] = useState([]);
  const [authConfig, setAuthConfig] = useState({ loaded: false, enabled: false, google_client_id: null });
  const [authToken, setAuthToken] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const symbols = useMemo(() => parseSymbols(symbolsText), [symbolsText]);
  const zoomedResults = useMemo(() => results.map((result) => zoomResult(result, xZoom)), [results, xZoom]);

  async function fetchDrawdowns(
    nextSymbols = symbols,
    nextPeriod = period,
    nextCandleInterval = candleInterval,
    nextTechnicalIndicators = technicalIndicators
  ) {
    if (!nextSymbols.length) return;
    if (authConfig.enabled && !authToken) return;
    const requestSymbols = symbolsWithBenchmark(nextSymbols);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drawdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...makeAuthHeaders(authConfig, authToken) },
        body: JSON.stringify({
          symbols: requestSymbols,
          period: nextPeriod,
          custom_months: nextPeriod === "custom" ? customMonths : null,
          candle_interval: nextCandleInterval,
          technical_indicators: nextTechnicalIndicators,
        }),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const payload = await response.json();
      setResults(payload.results || []);
      localStorage.setItem(STORAGE_KEY, nextSymbols.filter((symbol) => symbol.toUpperCase() !== BENCHMARK_SYMBOL).join(", "));
      localStorage.setItem(PERIOD_STORAGE_KEY, nextPeriod);
      localStorage.setItem(CUSTOM_MONTHS_STORAGE_KEY, String(customMonths));
      localStorage.setItem(CANDLE_INTERVAL_STORAGE_KEY, nextCandleInterval);
      storeTechnicalIndicators(nextTechnicalIndicators);
    } catch (err) {
      setError(err.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then((payload) => setAuthConfig({ loaded: true, enabled: Boolean(payload.enabled), google_client_id: payload.google_client_id || null }))
      .catch(() => setAuthConfig({ loaded: true, enabled: false, google_client_id: null }));
  }, []);

  useEffect(() => {
    if (!authConfig.loaded || !authConfig.enabled || !authConfig.google_client_id || authToken) return;
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
        client_id: authConfig.google_client_id,
        callback: (response) => {
          setAuthToken(response.credential || "");
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
  }, [authConfig.loaded, authConfig.enabled, authConfig.google_client_id, authToken]);

  useEffect(() => {
    if (!authConfig.loaded) return;
    if (authConfig.enabled && !authToken) return;

    fetchDrawdowns(parseSymbols(symbolsText), period);
    fetch("/api/market-events", { headers: makeAuthHeaders(authConfig, authToken) })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setMarketEvents(Array.isArray(payload) ? payload : []))
      .catch(() => setMarketEvents([]));
  }, [authConfig.loaded, authConfig.enabled, authToken]);

  function onPeriodChange(event) {
    const nextPeriod = event.target.value;
    setPeriod(nextPeriod);
    fetchDrawdowns(symbols, nextPeriod);
  }

  function onCustomYearsChange(event) {
    const years = Math.min(Math.max(Number(event.target.value) || 0, 0), 50);
    const months = customMonths % 12;
    const nextMonths = clampCustomMonths(years * 12 + months);
    setCustomMonths(nextMonths);
    localStorage.setItem(CUSTOM_MONTHS_STORAGE_KEY, String(nextMonths));
  }

  function onCustomRemainderMonthsChange(event) {
    const years = Math.floor(customMonths / 12);
    const months = Math.min(Math.max(Number(event.target.value) || 0, 0), 11);
    const nextMonths = clampCustomMonths(years * 12 + months);
    setCustomMonths(nextMonths);
    localStorage.setItem(CUSTOM_MONTHS_STORAGE_KEY, String(nextMonths));
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
    localStorage.setItem(CANDLE_INTERVAL_STORAGE_KEY, nextInterval);
    fetchDrawdowns(symbols, period, nextInterval);
  }

  function updateTechnicalIndicators(nextIndicators) {
    setTechnicalIndicators(nextIndicators);
    storeTechnicalIndicators(nextIndicators);
    fetchDrawdowns(symbols, period, candleInterval, nextIndicators);
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

  function onSubmit(event) {
    event.preventDefault();
    fetchDrawdowns(symbols, period);
  }

  if (!authConfig.loaded) {
    return h("main", { className: "app-shell" }, h("div", { className: "auth-panel" }, "読み込み中"));
  }

  if (authConfig.enabled && !authToken) {
    return h(
      "main",
      { className: "app-shell" },
      h(
        "section",
        { className: "auth-panel" },
        h("h1", null, "Drawdown Board"),
        h("p", null, "このページを開くにはGoogleログインが必要です。"),
        h("div", { id: "google-signin", className: "google-signin" }),
        authError ? h("div", { className: "notice" }, authError) : null
      )
    );
  }

  return h(
    "main",
    { className: "app-shell" },
    h(
      "section",
      { className: "settings-panel" },
      h(
        "header",
        { className: "topbar" },
        h("div", null, h("h1", null, "Drawdown Board"), h("p", null, "日本株 / 調整後終値")),
        h(
          "form",
          { className: "symbol-form", onSubmit },
          h("input", {
            value: symbolsText,
            onChange: (event) => setSymbolsText(event.target.value),
            placeholder: "7203, 6758, 9984",
            "aria-label": "銘柄コード",
          }),
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
          h("button", { type: "submit", disabled: loading || symbols.length === 0 }, loading ? "取得中" : "更新")
        )
      ),
      error ? h("div", { className: "notice" }, error) : null,
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
            })
          )
        ),
        h(
          "div",
          { className: "legend" },
          h("span", { className: "legend-price" }, "価格"),
          h("span", { className: "legend-drawdown" }, "Drawdown")
        )
      )
    ),
    h(
      "section",
      { className: "chart-scroll" },
      h(
        "div",
        { className: "results-grid" },
        h(OverlayDrawdownChart, { results: zoomedResults, ddRange, marketEvents }),
        zoomedResults.map((result) => h(ResultCard, { key: result.symbol, result, ddRange, marketEvents, technicalIndicators }))
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
