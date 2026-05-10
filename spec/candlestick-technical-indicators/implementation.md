# Candlestick Technical Indicators Implementation

## Implemented

- 個別銘柄チャートをローソク足へ変更済み。
- 調整後OHLC、日足・週足・月足、drawdown再計算に対応済み。
- SMA、EMA、BBandsをpandas-taで計算する。
- UIでは指標のON/OFFと期間 `1〜100` を分離して指定できる。
- yfinance取得結果と企業名を短時間キャッシュし、指標変更時の外部取得を抑制する。

## Checks Reported

- OHLC調整、週足/月足集約、テクニカル指標、キャッシュ再利用を確認済み。
- フロントエンドは `node --check static/app.js` を基本構文チェックとする。
- バックエンドは `uv run pytest` を基本確認コマンドとする。

## Remaining Notes

- 指標が増えた場合は、設定schemaとチャート描画キーの命名規則を維持する。
- 長期的には指標変更時のバックエンド呼び出し自体を減らすため、クライアント側再計算も検討できる。
