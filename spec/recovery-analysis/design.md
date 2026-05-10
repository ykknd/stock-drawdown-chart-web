# Recovery Analysis Design

## Metrics

- `peak_date`: 最大drawdownの基準となる高値日。
- `trough_date`: 最大drawdownの底日。
- `recovery_date`: 底日以降にピーク価格以上へ戻った最初の日。
- `decline_days`: ピーク日から底日までの暦日数。
- `recovery_days`: 底日から回復日までの暦日数。
- `underwater_days`: ピーク日から回復日または最終日までの暦日数。
- `is_recovered`: 回復済みかどうか。
- `recovery_progress`: 未回復時の底値からピーク価格までの戻り率。

## UI

- 上部に `Drawdownプロファイル比較` を表示する。
- 比較チャートは銘柄ごとのdrawdown線を重ね描きする。
- 日経平均は黒線で表示する。
- 個別カードには最大DD、現在DD、ピーク日、底日、回復日、回復日数または未回復を表示する。

## Market Events

- 暴落イベントはリポジトリ内CSVで管理する。
- APIはCSVを読み、日付順にイベント一覧を返す。
- イベント名は赤線にカーソルが近い場合のみ表示する。
