# Manual Refresh Market Cache Tasks

## Spec Handoff

Geminiはこのファイルの順に実装し、完了後に `implementation.md` を更新してください。`tasks.md` のチェックはCodexが検証時に更新します。

## Tasks

- [x] `static/app.js` の自動取得トリガーを洗い出す。
- [x] 初回表示時の `/api/drawdowns` 自動呼び出しを停止する。
- [x] 期間変更時の自動取得を停止し、dirty noticeだけ出す。
- [x] 足種変更時の自動取得を停止し、dirty noticeだけ出す。
- [x] テクニカル指標変更時の自動取得を停止し、dirty noticeだけ出す。
- [x] J-Quants無料枠切替時の自動取得を停止し、dirty noticeだけ出す。
- [x] 更新ボタン押下時だけ現在設定で `/api/drawdowns` を呼ぶ。
- [x] 更新成功時にdirty noticeを解除する。
- [x] `MARKET_DATA_CACHE_BACKEND` の正規化ヘルパーを追加する。
- [x] memory/local/gcs用のキャッシュbackend抽象を追加する。
- [x] local cacheの保存先を `MARKET_DATA_CACHE_DIR` で切り替え可能にする。
- [x] gcs cacheのbucket/prefixを環境変数で切り替え可能にする。
- [x] cache keyにprovider、credential scope、symbol、J-Quants無料枠、JST cache dateを含める。
- [x] cache file/object名にAPIキー生値を含めない。
- [x] cache file/object本文にAPIキー生値を含めない。
- [x] キャッシュ範囲が要求期間を包含する場合はproviderを呼ばずに切り出す。
- [x] キャッシュ範囲が不足する場合はproviderから取得してキャッシュを更新する。
- [x] drawdown、回復力、ローソク足集約、テクニカル指標はキャッシュ後データから再計算する。
- [x] READMEにCloud Storage cache、local cache、Cloud Storage lifecycle 1日削除の運用方針を追記する。
- [x] GEMINI.mdにキャッシュ分離とAPIキー非保存の注意を追記する。
- [x] フロントの手動更新テストを追加する。
- [x] キャッシュkey分離、範囲包含、APIキー非漏洩、backend切替のテストを追加する。
- [x] `uv run pytest` を実行する。
- [x] `uv run python -m py_compile stock_drawdown_app.py` を実行する。
- [x] `node --check static/app.js` を実行する。
- [x] 実装内容、変更ファイル、実行した確認、未対応事項を `implementation.md` に記録する。

## Acceptance Checks for Codex

- [x] 設定変更だけでは `/api/drawdowns` が呼ばれない。
- [x] 更新ボタン押下時のみ、現在の設定で `/api/drawdowns` が呼ばれる。
- [x] DD軸レンジとx軸ズームは即時反映される。
- [x] 同日・同一scope・同一銘柄の取得はキャッシュを利用する。
- [x] APIキーAとAPIキーBのキャッシュは共有されない。
- [x] 2年取得済みなら、同日の6か月取得では外部APIを呼ばず範囲切り出しで応答する。
- [x] Cloud Storage、local、memoryの保存先を環境変数で切り替えられる。
- [x] APIキー生値がキャッシュキー、ファイル名、ファイル内容、レスポンス、ログに含まれない。
