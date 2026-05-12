# Security Name Selector Implementation

## Implemented

- `GET /api/securities` を追加し、`data/jp_security_names.csv` の `code,name` 一覧を返すようにした。
- J-Quantsモードかつ無料枠ON時に、バックエンドで6件以上のユニーク銘柄リクエストをHTTP 400で拒否するようにした。
- フロントエンドの銘柄コード入力欄を、銘柄名検索、候補リスト、選択済みチップに置き換えた。
- 選択済み銘柄を `drawdown-board-selected-security-codes` にJSON配列として保存し、既存 `drawdown-board-symbols` からの移行に対応した。
- J-Quants無料枠ON時は5件を超える追加を抑止し、上限超過時は更新ボタンをdisabledにするようにした。
- yfinanceモードの `^N225` 自動追加は内部送信処理として維持した。

## Changed Files

- `stock_drawdown_app.py`
- `static/app.js`
- `static/styles.css`
- `tests/test_drawdown.py`
- `spec/security-name-selector/implementation.md`

## Checks Reported

- `uv run pytest`: 44 passed.
- `uv run python -m py_compile stock_drawdown_app.py`: Success.
- `node --check static/app.js`: Success.

## Unresolved Items

- なし。
