# Candlestick Technical Indicators Design

## OHLC

- yfinanceから `Open`, `High`, `Low`, `Close`, `Adj Close` を取得する。
- `Adj Close / Close` の比率でOHLCを調整後ベースに補正する。
- `price` は互換性維持のため `close` と同じ値として返す。

## Aggregation

- `daily`: 日次OHLCをそのまま使う。
- `weekly`: 週内の最初のOpen、最大High、最小Low、最後のCloseを使う。
- `monthly`: 月内の最初のOpen、最大High、最小Low、最後のCloseを使う。
- drawdownと回復力指標は集約後Closeを基準に計算する。

## Technical Indicators

- APIは `technical_indicators` を構造化設定として受け取る。
- 例: `{"sma": {"enabled": true, "period": 20}}`
- バックエンドはpandas-taでSMA、EMA、BBandsを計算する。
- 指標キーは `sma20`, `ema20`, `bbands20_lower` のように期間を含める。
- 同一銘柄・期間の価格データと企業名はTTL付きインメモリキャッシュで再利用する。

## UI

- 上部設定でローソク足粒度とテクニカル指標を操作する。
- 個別チャートのホバー表示に日付、OHLC、DD率、選択指標値を表示する。
