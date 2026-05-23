# Spec Management

このディレクトリでは、機能ごとに要件・設計・実施順・実装実績・検証結果を分けて管理します。

## Roles

- Codex: 仕様策定と検証を担当する。
- Gemini: `tasks.md` に従った実装と、実装結果の記録を担当する。

## Directory Rule

機能ディレクトリ名は英語slug形式を使います。

例:

- `mvp-drawdown-board`
- `recovery-analysis`
- `cloud-run-deployment`

## File Roles

各機能ディレクトリには以下の5ファイルを置きます。

- `requirements.md`: Codexが作成する。ユーザー価値、要件、非対象、受け入れ条件。
- `design.md`: Codexが作成する。実装方針、API/UI/データ構造、主要判断。
- `tasks.md`: Codexが作成する。Geminiが実施する順序付きタスクと検証観点。
- `implementation.md`: Geminiが記載する。実装内容、変更ファイル、実行した確認、未対応事項。
- `verification.md`: Codexが記載する。要件照合、差分レビュー、テスト結果、合否、追加修正指示。

## Initial Specs

- [MVP Drawdown Board](./mvp-drawdown-board/requirements.md)
- [Recovery Analysis](./recovery-analysis/requirements.md)
- [Cloud Run Deployment](./cloud-run-deployment/requirements.md)
- [Candlestick Technical Indicators](./candlestick-technical-indicators/requirements.md)
- [Workspace Layout](./workspace-layout/requirements.md)
- [J-Quants User API Provider](./jquants-user-api-provider/requirements.md)
- [Manual Refresh Market Cache](./manual-refresh-market-cache/requirements.md)
- [Security Name Selector](./security-name-selector/requirements.md)
- [Google Login Public Access](./google-login-public-access/requirements.md)
- [Drawdown Forecasting](./drawdown-forecasting/requirements.md)

## Workflow

1. Codexが実装前に `requirements.md`、`design.md`、`tasks.md` を作成または更新する。
2. Geminiが `tasks.md` に従って実装する。
3. Geminiが `implementation.md` に実装内容、変更ファイル、実行した確認、未対応事項を記録する。
4. Codexが `requirements.md`、`design.md`、`tasks.md` と実装差分を照合する。
5. Codexが `verification.md` に検証結果を記録し、必要に応じて `tasks.md` の完了チェックを更新する。

## Verification Rule

Codexは検証時に以下を確認します。

- `requirements.md` の受け入れ条件を満たしているか。
- `design.md` の方針から逸脱していないか。
- `tasks.md` の各項目が実装済みか。
- `implementation.md` の記録が実際の差分と一致しているか。
- 必要なテスト、構文チェック、手動確認が実行されているか。

`verification.md` には以下を記録します。

- 判定: `pass` または `needs changes`
- 検証日
- 検証者: Codex
- 確認した要件
- 実行したコマンド
- 指摘事項
- 残課題

`tasks.md` のチェックボックスは、Gemini実装完了時点ではなく、Codex検証時に確定更新します。
