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
- J-Quants無料枠チェックボックスによる `jquants_free_tier` の送信。
- 無料枠ON時の `to_yyyymmdd = today - 12 weeks`、無料枠OFF時の `to_yyyymmdd = today` 方針。
- 無料枠ON/OFFによる価格キャッシュ分離。
- x軸表示期間と実データ欠損期間の薄グレー表示維持。

## Commands

- `uv run pytest` -> 32 passed
- `uv run python -m py_compile stock_drawdown_app.py` -> pass
- `node --check static/app.js` -> pass

## Findings

- 確認済み: J-Quants APIキーの優先順位は `JQUANTS_API_KEY` -> リクエストキーの順になっている。
- 確認済み: `tests/test_jquants.py` はサーバーキーがリクエストキーより優先されることを検証している。
- 確認済み: `MARKET_DATA_PROVIDER` 正規化、`/api/config` 拡張、J-Quantsモードでの `^N225` 自動追加停止、APIキー非漏洩テストは実装されている。
- 確認済み: `DrawdownRequest.jquants_free_tier`、frontendの `J-Quants無料枠` チェックボックス、`localStorage` 保存、request body送信が実装されている。
- 確認済み: J-Quants providerは無料枠ON/OFFで取得終点を切り替え、`to_yyyymmdd` を明示している。
- 確認済み: 価格キャッシュキーに `jquants_free_tier` が含まれ、無料枠ON/OFFでキャッシュが分離されている。
- 確認済み: `static/app.js` でAPIキーはReact stateとしてのみ扱われ、`localStorage` / `sessionStorage` には保存されていない。

## Remaining Issues

- なし。
