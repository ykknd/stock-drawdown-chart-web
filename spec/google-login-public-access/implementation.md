# Google Login Public Access Implementation

## Implemented

- `APP_AUTH_ENABLED=true` かつ `ALLOWED_EMAIL` 未設定時に、有効なGoogle ID tokenを持つ全Googleアカウントを許可するようにした。
- `ALLOWED_EMAIL` 設定時は従来通り単一メール制限を維持するようにした。
- email claimが空または欠落している場合はHTTP 401にするようにした。
- GitHub Actions workflowで `ALLOWED_EMAIL` をoptional secretとして扱い、設定されている場合だけCloud Run環境変数へ渡すようにした。
- READMEにGoogleログインの本番公開/限定公開設定と、取得しない情報・保存しない情報の説明を追記した。

## Changed Files

- `stock_drawdown_app.py`
- `.github/workflows/deploy-cloud-run.yml`
- `tests/test_drawdown.py`
- `README.md`
- `spec/google-login-public-access/implementation.md`

## Checks Reported

- `uv run pytest`: 60 passed
- `uv run python -m py_compile stock_drawdown_app.py`: passed
- `node --check static/app.js`: passed

## Unresolved Items

- なし
