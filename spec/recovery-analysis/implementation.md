# Recovery Analysis Implementation

## Implemented

- 最大drawdown区間をもとに回復力指標を計算する処理を実装済み。
- `POST /api/drawdowns` の銘柄結果に回復力指標を含める。
- `GET /api/market-events` で暴落イベントCSVを返す。
- 比較チャート、個別チャート、日経平均表示、イベント線表示に対応済み。

## Checks Reported

- 回復済み配列と未回復配列で単体確認済み。
- 市場イベントCSVの読み込みと日付順ソートを確認済み。

## Remaining Notes

- 営業日数ベースの指標は将来改善とする。
- イベントCSVは今後追加・修正しやすいよう、日付、名称、メモの最小構成を維持する。
