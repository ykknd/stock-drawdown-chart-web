# J-Quants User API Provider Implementation

## Implemented

- `jquants-api-client` を依存関係に追加し、J-Quants からのデータ取得を可能にした。
- `MARKET_DATA_PROVIDER` 環境変数による yfinance と J-Quants の切り替えを実装した。
- `DrawdownRequest` に `jquants_api_key` を追加し、リクエスト単位での API キー指定をサポートした。
- `/api/config` を拡張し、現在の provider と API キーの要求状態を返すようにした。
- API キーの解決優先順位 (環境変数 > リクエスト) と、キーの SHA-256 ハッシュによるキャッシュスコープ分離を実装した。
- J-Quants モードでは日経平均 (`^N225`) を自動追加しないように frontend を修正した。
- サーバーに API キーがない J-Quants モード時に、frontend で API キー入力欄を表示するようにした。
- API キーがログやレスポンス、エラーメッセージに混入しないようセキュリティ対策を施した。
- `tests/test_jquants.py` を追加し、provider 選択やキー解決、秘匿性のテストを完了した。

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

- `uv run pytest`: 23 tests passed (including new J-Quants tests).
- `uv run python -m py_compile stock_drawdown_app.py`: Success (no output).
- `node --check static/app.js`: Success (no output).

## Unresolved Items

- なし。J-Quants の `max` 期間は設計通り 2008-01-01 固定としている。
