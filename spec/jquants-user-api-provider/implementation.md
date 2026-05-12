# J-Quants User API Provider Implementation

## Implemented

- J-Quants 429 レート制限対策として、価格取得時の 4桁銘柄コードへの fallback とリトライループを廃止した。
- 価格取得は正規化された 5桁銘柄コード (例: 72030) のみで行うように変更した。
- `jquantsapi` からの `requests.exceptions.HTTPError` および `tenacity.RetryError` を捕捉し、ステータスコードや例外メッセージに基づいて以下のエラーメッセージに変換するようにした。
  - レート制限 (429, `too many 429 error responses`, `rate limit` 等): `J-Quants APIのレート制限に達しました。時間を置いて再試行してください。`
  - 契約範囲外/無料枠制限 (400, `subscription`, `covers the following dates` 等): `J-Quantsの契約範囲外の期間です。期間または無料枠設定を確認してください。`
  - プラン制限/無効キー (403): `J-Quants APIの契約プランで制限されているか、無効なAPIキーです。`
- 銘柄名取得において、J-Quants API を叩く前に必ずローカルの `data/jp_security_names.csv` を参照するようにし、API 呼び出しを最小化した。
- 銘柄名取得の API fallback (銘柄マスター/一覧) は価格取得とは独立させ、価格取得失敗時に不要な API コールが発生しないように制御した。
- API キーがエラーメッセージに含まれないよう、引き続きチェックと変換を維持している。
- `tests/test_jquants_optimization.py` を更新し、`RetryError` や特定の例外文字列が正しく日本語メッセージに変換されることを検証した。
- (以前の実装) `jquants-api-client` を導入し、provider 切り替え、APIキー解決、無料枠制御などを実装済み。

## Changed Files

- `stock_drawdown_app.py`
- `tests/test_jquants_optimization.py`
- (以前の変更) `pyproject.toml`, `uv.lock`, `static/app.js`, `README.md`, `GEMINI.md`, `tests/test_jquants.py`

## Checks Reported

- `uv run pytest`: 40 tests passed (including refined error handling tests).
- `uv run python -m py_compile stock_drawdown_app.py`: Success.
- `node --check static/app.js`: Success.

## Unresolved Items

- なし。
