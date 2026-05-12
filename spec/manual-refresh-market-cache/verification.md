# Manual Refresh Market Cache Verification

## Status

- 判定: pass
- 検証日: 2026-05-13
- 検証者: Codex

## Requirements Checked

- `/api/drawdowns` はユーザーが「更新」ボタンを押した時だけ呼ばれること。
- 初回表示、期間変更、足種変更、テクニカル指標変更、J-Quants無料枠切替では自動取得しないこと。
- データ取得に関係する設定変更後にdirty noticeを表示すること。
- DD軸レンジとx軸ズームは即時反映されること。
- 同日・同一scope・同一銘柄の取得はキャッシュを利用すること。
- APIキーAとAPIキーBのキャッシュが共有されないこと。
- 2年取得済みなら同日の6か月取得では外部APIを呼ばず範囲切り出しで応答すること。
- Cloud Storage、local、memoryの保存先を環境変数で切り替えられること。
- APIキー生値がキャッシュキー、ファイル名、ファイル内容、レスポンス、ログに含まれないこと。
- Geminiが `implementation.md` に実装内容、変更ファイル、実行した確認、未対応事項を記録すること。

## Commands

- `git status --short`
- `Select-String -Path README.md,GEMINI.md -Pattern "MARKET_DATA_CACHE|Cloud Storage|lifecycle|APIキー|cache|credential" -Context 1,2`
- `Select-String -Path static\app.js,stock_drawdown_app.py -Pattern "selectedSecurityCodes|/api/securities|SecurityInfo|count_unique_valid_symbols|JQUANTS_FREE_TIER_SELECTION_LIMIT|setSelectedSecurityCodes"`
- `Select-String -Path static\app.js -Pattern "symbolsText|setSymbolsText" -Context 1,1`
- `Get-Content spec\manual-refresh-market-cache\implementation.md`
- `uv run pytest tests\test_market_cache.py` -> 13 passed
- `uv run pytest` -> 53 passed
- `uv run python -m py_compile stock_drawdown_app.py` -> pass
- `node --check static/app.js` -> pass

## Findings

- 確認済み: 初回表示、期間変更、足種変更、テクニカル指標変更、J-Quants無料枠切替で `/api/drawdowns` を自動呼び出ししない設計になっている。
- 確認済み: 更新ボタン押下時だけ現在設定で `fetchDrawdowns()` を呼び、成功時にdirty noticeを解除する。
- 確認済み: DD軸レンジとx軸ズームはdirty扱いせず即時反映される。
- 確認済み: `tests/test_market_cache.py` が追加され、backend切替、cache hit/miss、範囲包含、範囲不足時のmerge、J-Quants APIキーscope分離、free tier分離、yfinance public scopeを検証している。
- 確認済み: J-Quants APIキー生値はcache keyに含まれず、リクエストキーscopeはSHA-256 hashで検証されている。
- 確認済み: READMEにlocal cache、Cloud Storage cache、Cloud Storage lifecycle 1日削除、Cloud RunコンテナFSを永続cacheに使わない方針を追記済み。
- 確認済み: GEMINI.mdにcache分離、APIキー非保存、spec外変更を混ぜない注意を追記済み。
- 確認済み: `implementation.md` は実装内容、変更ファイル、確認結果、未対応事項を記録済み。
- 確認済み: 今回spec外だった `selectedSecurityCodes`、`/api/securities`、`SecurityInfo`、J-Quants無料枠5銘柄制限のtrackedコード断片は残っていない。

## Remaining Issues

- なし。
