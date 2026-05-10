# J-Quants User API Provider Verification

## Status

- 判定: pass
- 検証日: 2026-05-10
- 検証者: Codex

## Requirements Checked

- `MARKET_DATA_PROVIDER` による `yfinance` / `jquants` 切り替え。
- J-Quants APIキー解決順。
- `/api/config` のprovider情報とJ-Quantsキー状態。
- J-Quantsモードでの日経平均 `^N225` 自動追加停止。
- APIキーのレスポンス・エラー文言・ブラウザ永続保存への混入防止。

## Commands

- `uv run pytest` -> 23 passed
- `uv run python -m py_compile stock_drawdown_app.py` -> pass
- `node --check static/app.js` -> pass

## Findings

- 確認済み: J-Quants APIキーの優先順位は `JQUANTS_API_KEY` -> リクエストキーの順になっている。
- 確認済み: `tests/test_jquants.py` はサーバーキーがリクエストキーより優先されることを検証している。
- 確認済み: `MARKET_DATA_PROVIDER` 正規化、`/api/config` 拡張、J-Quantsモードでの `^N225` 自動追加停止、APIキー非漏洩テストは実装されている。

## Remaining Issues

- なし。
