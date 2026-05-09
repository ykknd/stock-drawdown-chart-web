const { useEffect, useMemo, useState } = React;
const h = React.createElement;
const STORAGE_KEY = "drawdown-board-symbols";
const PERIOD_STORAGE_KEY = "drawdown-board-period";
const CUSTOM_MONTHS_STORAGE_KEY = "drawdown-board-custom-months";
const DD_RANGE_STORAGE_KEY = "drawdown-board-dd-range";
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

function DrawdownChart({ result, ddRange, marketEvents }) {
  const width = 920;
  const height = 316;
  const area = { left: 72, right: width - 72, top: 18, bottom: height - 50 };
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const data = result.data || [];
  if (!data.length) {
    return h("div", { className: "empty-chart" }, "データなし");
  }

  const prices = data.map((point) => point.price);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const priceTicks = createLinearTicks(priceMin, priceMax, 4);
  const ddTicks = createLinearTicks(-ddRange / 100, 0, 6);
  const xTickIndexes = createLinearTicks(0, data.length - 1, Math.min(6, data.length)).map((value) => Math.round(value));
  const pricePath = buildPath(data, (point) => point.price, area);
  const drawdownPath = buildFixedRangePath(
    data,
    (point) => point.drawdown,
    -ddRange / 100,
    0,
    area
  );
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
      h("path", { d: pricePath, className: "price-line" }),
      h("path", { d: drawdownPath, className: "drawdown-line" }),
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
        h("strong", null, formatPrice(hoverPoint.price)),
        h("b", null, formatPercent(hoverPoint.drawdown))
      ),
    h(
      "div",
      { className: "chart-footer" },
      h("span", null, first?.date || ""),
      h("span", null, `最新 ${latest?.date || ""} / ${formatPrice(latest?.price)}`)
    )
  );
}

function ResultCard({ result, ddRange, marketEvents }) {
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
          h(DrawdownChart, { key: "chart", result, ddRange, marketEvents }),
        ]
  );
}

function App() {
  const [symbolsText, setSymbolsText] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_SYMBOLS);
  const [period, setPeriod] = useState(() => localStorage.getItem(PERIOD_STORAGE_KEY) || "1y");
  const [customMonths, setCustomMonths] = useState(() => clampCustomMonths(localStorage.getItem(CUSTOM_MONTHS_STORAGE_KEY) || 53));
  const [ddRange, setDdRange] = useState(() => Number(localStorage.getItem(DD_RANGE_STORAGE_KEY) || 50));
  const [results, setResults] = useState([]);
  const [marketEvents, setMarketEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const symbols = useMemo(() => parseSymbols(symbolsText), [symbolsText]);

  async function fetchDrawdowns(nextSymbols = symbols, nextPeriod = period) {
    if (!nextSymbols.length) return;
    const requestSymbols = symbolsWithBenchmark(nextSymbols);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drawdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: requestSymbols,
          period: nextPeriod,
          custom_months: nextPeriod === "custom" ? customMonths : null,
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
    } catch (err) {
      setError(err.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDrawdowns(parseSymbols(symbolsText), period);
    fetch("/api/market-events")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setMarketEvents(Array.isArray(payload) ? payload : []))
      .catch(() => setMarketEvents([]));
  }, []);

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

  function onSubmit(event) {
    event.preventDefault();
    fetchDrawdowns(symbols, period);
  }

  return h(
    "main",
    { className: "app-shell" },
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
        "div",
        { className: "legend" },
        h("span", { className: "legend-price" }, "価格"),
        h("span", { className: "legend-drawdown" }, "Drawdown")
      )
    ),
    h(
      "div",
      { className: "results-grid" },
      h(OverlayDrawdownChart, { results, ddRange, marketEvents }),
      results.map((result) => h(ResultCard, { key: result.symbol, result, ddRange, marketEvents }))
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
