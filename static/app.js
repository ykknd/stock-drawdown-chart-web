const { useEffect, useMemo, useState } = React;
const h = React.createElement;
const STORAGE_KEY = "drawdown-board-symbols";
const PERIOD_STORAGE_KEY = "drawdown-board-period";
const DD_RANGE_STORAGE_KEY = "drawdown-board-dd-range";
const DEFAULT_SYMBOLS = "7203, 6758, 9984";
const PERIOD_OPTIONS = [
  ["1mo", "1ヶ月"],
  ["3mo", "3ヶ月"],
  ["6mo", "6ヶ月"],
  ["1y", "1年"],
  ["2y", "2年"],
  ["5y", "5年"],
  ["max", "最大"],
];

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

function parseSymbols(value) {
  return value
    .split(/[\s,、]+/)
    .map((symbol) => symbol.trim())
    .filter(Boolean);
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

function DrawdownChart({ result, ddRange }) {
  const width = 920;
  const height = 316;
  const area = { left: 72, right: width - 72, top: 18, bottom: height - 50 };
  const [hoverIndex, setHoverIndex] = useState(null);
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

function ResultCard({ result, ddRange }) {
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
      : h(DrawdownChart, { result, ddRange })
  );
}

function App() {
  const [symbolsText, setSymbolsText] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_SYMBOLS);
  const [period, setPeriod] = useState(() => localStorage.getItem(PERIOD_STORAGE_KEY) || "1y");
  const [ddRange, setDdRange] = useState(() => Number(localStorage.getItem(DD_RANGE_STORAGE_KEY) || 50));
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const symbols = useMemo(() => parseSymbols(symbolsText), [symbolsText]);

  async function fetchDrawdowns(nextSymbols = symbols, nextPeriod = period) {
    if (!nextSymbols.length) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/drawdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: nextSymbols, period: nextPeriod }),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const payload = await response.json();
      setResults(payload.results || []);
      localStorage.setItem(STORAGE_KEY, nextSymbols.join(", "));
      localStorage.setItem(PERIOD_STORAGE_KEY, nextPeriod);
    } catch (err) {
      setError(err.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDrawdowns(parseSymbols(symbolsText), period);
  }, []);

  function onPeriodChange(event) {
    const nextPeriod = event.target.value;
    setPeriod(nextPeriod);
    fetchDrawdowns(symbols, nextPeriod);
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
      results.map((result) => h(ResultCard, { key: result.symbol, result, ddRange }))
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
