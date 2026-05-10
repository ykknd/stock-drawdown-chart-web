# Spec Management

このディレクトリでは、機能ごとに要件・設計・実施順・実績を分けて管理します。

## Directory Rule

機能ディレクトリ名は英語slug形式を使います。

例:

- `mvp-drawdown-board`
- `recovery-analysis`
- `cloud-run-deployment`

## File Roles

各機能ディレクトリには以下の4ファイルを置きます。

- `requirements.md`: ユーザー価値、要件、非対象、受け入れ条件
- `design.md`: 実装方針、API/UI/データ構造、主要判断
- `tasks.md`: 実施順、チェックリスト、検証手順
- `implementation.md`: 実装実績、変更点、テスト結果、残課題

## Initial Specs

- [MVP Drawdown Board](./mvp-drawdown-board/requirements.md)
- [Recovery Analysis](./recovery-analysis/requirements.md)
- [Cloud Run Deployment](./cloud-run-deployment/requirements.md)
- [Candlestick Technical Indicators](./candlestick-technical-indicators/requirements.md)
- [Workspace Layout](./workspace-layout/requirements.md)

## Workflow

1. 実装前に `requirements.md` と `design.md` を更新する。
2. 実装順を `tasks.md` にチェックリストとして書く。
3. 実装後に `implementation.md` へ実績、検証結果、残課題を記録する。
4. 実装で仕様から外れた場合は、該当specを更新してからPRを出す。
