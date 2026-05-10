# J-Quants User API Provider Implementation

## Implemented

- `jquants-api-client` を依存関係に追加し、J-Quants からのデータ取得を可能にした。
- `MARKET_DATA_PROVIDER` 環境変数による yfinance と J-Quants の切り替えを実装した。
- `DrawdownRequest` に `jquants_api_key` と `jquants_free_tier` を追加した。
- `/api/config` を拡張し、現在の provider と API キーの要求状態を返すようにした。
- APIキーの解決優先順位 (環境変数 > リクエスト) と、キーの SHA-256 ハッシュによるキャッシュスコープ分離を実装した。
- J-Quants 無料枠切り替え UI と取得期間制御を実装した。
  - 無料枠 ON 時は `to_yyyymmdd = today - 12 weeks` とし、データが右端で欠損する場合は既存の薄グレー表示ロジックを活用する。
  - 有料枠 OFF 時は `to_yyyymmdd = today` とする。
  - 取得期間開始日が終了日以降になる場合は、「J-Quants無料枠ではこの期間に取得可能なデータがありません」というエラーを返す。
- J-Quants モードでは日経平均 (`^N225`) を自動追加しないように frontend を修正した。
- サーバーに API キーがない J-Quants モード時に、frontend で API キー入力欄を表示するようにした。
- API キーがログやレスポンス、エラーメッセージに混入しないようセキュリティ対策を施した。
- `tests/test_jquants.py` を追加・更新し、free tier 制御、キャッシュ分離、provider 選択、キー解決のテストを完了した。

## Changed Files

- `pyproject.toml`
- `uv.lock`
- `stock_drawdown_app.py`
- `static/app.js`
- `static/styles.css`
- `README.md`
- `GEMINI.md`
- `tests/test_drawdown.py`
- `tests/test_jquants.py`

## Checks Reported

- `uv run pytest`: 32 tests passed.
- `uv run python -m py_compile stock_drawdown_app.py`: Success.
- `node --check static/app.js`: Success.

## Unresolved Items

- なし。J-Quants の `max` 期間は設計通り 2008-01-01 固定としている。
