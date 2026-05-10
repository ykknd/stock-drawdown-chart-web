# Candlestick Technical Indicators Requirements

## User Value

個別銘柄カードでローソク足とテクニカル指標を確認し、drawdownだけでなく価格トレンドやボラティリティも見ながら分析できる。

## Requirements

- 個別銘柄の価格表示はローソク足にする。
- ローソク足は調整後OHLCを使う。
- 日足、週足、月足を全体設定で切り替えられる。
- DD比較チャートはdrawdown線比較のまま維持する。
- DD率は個別チャート上で赤い上側塗りつぶしとして表示する。
- SMA、EMA、BBandsを個別にON/OFFできる。
- 各テクニカル指標は期間 `1〜100` を個別指定できる。
- テクニカル指標変更時にYahoo/yfinanceへ毎回取得しに行かない。

## Out of Scope

- 出来高表示。
- RSI、MACDなど追加指標。
- テクニカル指標の売買シグナル判定。

## Acceptance Criteria

- 日足、週足、月足を切り替えると個別カードのローソク足粒度が変わる。
- SMA、EMA、BBandsの期間を変えるとチャート線とホバー表示が更新される。
- 指標変更時はキャッシュ済み価格データから再計算される。
