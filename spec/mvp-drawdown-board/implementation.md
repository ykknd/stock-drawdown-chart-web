# MVP Drawdown Board Implementation

## Implemented

- FastAPI + Reactの単一Webサービスとして実装済み。
- `MarketDataProvider` 抽象とyfinance実装を追加済み。
- `POST /api/drawdowns` で複数銘柄のdrawdownを返す。
- 日本株コードの `.T` 補完、重複除外、失敗銘柄のエラー返却に対応済み。
- ブラウザ側で銘柄リストと表示設定を保存する。

## Verification

- 既知の価格配列でdrawdown計算をテスト済み。
- APIテストで成功銘柄と失敗銘柄の混在を確認済み。
- ローカルでは `uv run pytest` を基本検証とする。

## Remaining Notes

- 一般公開前にデータ取得元の利用条件を再確認する。
- 高頻度アクセスを想定する場合は、永続キャッシュまたは有料データAPIを検討する。
