# Google Login Public Access Tasks

- [ ] 現在のGoogleログイン実装を確認する。
- [ ] `verify_google_token` を、`ALLOWED_EMAIL` 未設定時は検証済みGoogleアカウント全員を許可する実装に変更する。
- [ ] email claimが空または欠落している場合はHTTP 401を返す。
- [ ] `ALLOWED_EMAIL` 設定時は従来通り単一メール制限を維持する。
- [ ] エラー文言にtoken、claims、個人情報が含まれないことを確認する。
- [ ] 認証モードのunit testを追加または更新する。
- [ ] `APP_AUTH_ENABLED=false` で認証なし利用できる既存挙動を確認する。
- [ ] READMEに本番公開時のGoogleログイン設定を追記する。
- [ ] READMEにGoogleログインで取得しない情報、利用する情報、保存しない情報を追記する。
- [ ] Cloud Run / GitHub Actionsの設定説明から、一般公開時に `ALLOWED_EMAIL` が必須であるかのような記述を修正する。
- [ ] GitHub Actions workflowで `ALLOWED_EMAIL` をoptional secretとして扱う。
- [ ] `ALLOWED_EMAIL` が設定されている場合だけCloud Run環境変数へ渡す。
- [ ] `ALLOWED_EMAIL` が未設定の場合でもdeploy stepのshellが壊れないようにする。
- [ ] `uv run pytest` を実行する。
- [ ] `uv run python -m py_compile stock_drawdown_app.py` を実行する。
- [ ] `node --check static/app.js` を実行する。
- [ ] Geminiは実装後に `implementation.md` へ変更ファイル、確認結果、未対応事項を記録する。
- [ ] Codex検証時に `tasks.md` のチェックを確定更新する。
