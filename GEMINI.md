# GEMINI.md

このリポジトリでは、仕様駆動開発を Codex / Gemini の役割分担で進めます。

## Role

Geminiの担当は実装です。

- Codexが作成した `spec/<feature>/requirements.md`、`design.md`、`tasks.md` を読む。
- `tasks.md` に従ってコード、テスト、ドキュメントを変更する。
- 実装後に `spec/<feature>/implementation.md` を記載する。
- Codexが `verification.md` で検証するため、実装内容と確認結果を正確に残す。

## Do Not Own

Geminiは原則として以下を作成・更新しません。

- `requirements.md`
- `design.md`
- `tasks.md` の完了チェック
- `verification.md`

これらはCodexの担当です。実装中に仕様変更が必要だと判断した場合は、勝手に要件を変更せず、`implementation.md` の未対応事項や確認事項に記録してください。

## Spec Workflow

1. Codexが `requirements.md`、`design.md`、`tasks.md` を作成する。
2. Geminiが対象specを読み、`tasks.md` の順に実装する。
3. Geminiが `implementation.md` に実装実績を記録する。
4. Codexが実装差分と `requirements.md` を照合する。
5. Codexが `verification.md` に検証結果を記録し、必要なら `tasks.md` の完了チェックを更新する。

## Technical Stack

### Backend

- Python 3.13
- FastAPI
- uv
- yfinance
- pandas
- pandas-ta

### Frontend

- 静的React
- CDN版React / ReactDOM
- `static/index.html`
- `static/app.js`
- `static/styles.css`

このリポジトリはVite、Next.js、npmビルド前提のReactアプリではありません。フロントエンドはFastAPIから静的ファイルとして配信されます。

### Runtime and Deploy

- FastAPIがAPIと静的ファイル配信を兼ねる単一Webサービスです。
- ローカル起動はuvicornを使います。
- 本番公開はDocker + Google Cloud Runを想定します。
- 本番デプロイはGitHub Actionsの `v*` タグをトリガーにします。

## Common Commands

```powershell
uv sync
uv run pytest
uv run python -m py_compile stock_drawdown_app.py
& 'C:\Program Files\nodejs\node.exe' --check static/app.js
uv run uvicorn stock_drawdown_app:app --reload
```

ローカル確認URL:

```text
http://127.0.0.1:8000
```

## Project Constraints

- Python依存関係は `pyproject.toml` と `uv.lock` で管理します。
- 原則として `requirements.txt` は追加しません。
- npm前提の `package.json`、Vite、Next.js、TypeScriptビルド環境は追加しません。
- 静的フロントエンドの変更は、既存の `static/app.js` と `static/styles.css` の構成に合わせます。
- データ取得は `MarketDataProvider` 抽象を経由します。
- yfinanceはMVP用途です。一般公開前にはデータ利用条件と提供元を再確認します。
- Cloud Run関連の設定は、既存のDockerfile、GitHub Actions、READMEの方針に合わせます。

## Implementation.md Template

Geminiは実装完了時に、対象機能の `implementation.md` を以下の形式で更新してください。

```markdown
# <Feature Name> Implementation

## Implemented

- 実装した内容を箇条書きで記載する。
- 変更した主要な挙動を記載する。

## Changed Files

- `path/to/file`
- `path/to/file`

## Checks Reported

- 実行したテストや構文チェックを書く。
- 実行できなかった確認があれば理由を書く。

## Unresolved Items

- 未対応事項、仕様確認が必要な点、リスクを書く。
- なければ `なし` と書く。
```

## Verification Handoff

Codexが検証できるように、実装完了時には以下を満たしてください。

- `implementation.md` が実際の差分と一致している。
- 実行したコマンドと結果が記録されている。
- 実行できなかった確認が隠されずに記録されている。
- 仕様から外れた判断や代替案が記録されている。

## General Engineering Rules

- 既存の実装パターンを優先する。
- 変更範囲は対象specに必要な範囲へ絞る。
- unrelatedな変更や整形だけの差分を混ぜない。
- ユーザーの未コミット変更を巻き戻さない。
- テストがある場合は、関連テストを実行して結果を `implementation.md` に残す。
