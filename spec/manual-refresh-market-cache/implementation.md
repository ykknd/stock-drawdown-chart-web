# Manual Refresh Market Cache Implementation

## Implemented

- フロントエンドのデータ取得を手動更新へ変更した。
  - 初回表示、期間変更、足種変更、テクニカル指標変更、J-Quants無料枠切替では `/api/drawdowns` を呼ばない。
  - 更新ボタン押下時だけ現在の設定で `/api/drawdowns` を呼ぶ。
  - データ取得に関係する設定変更後はdirty noticeを表示し、更新成功時に解除する。
  - DD軸レンジとx軸ズームは即時反映のままとした。
- 日次market data cacheを追加した。
  - `memory`、`local`、`gcs` backendを追加した。
  - cache keyはprovider、credential scope、symbol、J-Quants無料枠、JST cache dateを含む。
  - cache本文は `PricePoint` 生データとmetadataを保存し、drawdown、回復力、ローソク足集約、テクニカル指標は毎回再計算する。
  - 要求期間がcache範囲に完全包含される場合はproviderを呼ばず、必要範囲を切り出して利用する。
  - cache範囲が不足する場合はproviderから取得し、既存cacheとmergeしてより広い範囲を保存する。
- J-Quants APIキー生値をcache key、ファイル名、object名、cache本文に保存しない設計とした。
- READMEにlocal cache、Cloud Storage cache、Cloud Storage lifecycle 1日削除の運用方針を追記した。
- GEMINI.mdにcache分離とAPIキー非保存の注意を追記した。
- キャッシュ関連テストを追加し、日付固定とcredential scopeの検証を安定化した。

## Changed Files

- `pyproject.toml`
- `uv.lock`
- `stock_drawdown_app.py`
- `static/app.js`
- `static/styles.css`
- `README.md`
- `GEMINI.md`
- `tests/test_market_cache.py`
- `spec/README.md`
- `spec/manual-refresh-market-cache/requirements.md`
- `spec/manual-refresh-market-cache/design.md`
- `spec/manual-refresh-market-cache/tasks.md`
- `spec/manual-refresh-market-cache/implementation.md`
- `spec/manual-refresh-market-cache/verification.md`

## Checks Reported

- `uv run pytest` -> 53 passed
- `uv run python -m py_compile stock_drawdown_app.py` -> pass
- `node --check static/app.js` -> pass

## Unresolved Items

- なし。
