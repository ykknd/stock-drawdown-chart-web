# Cloud Run Deployment Implementation

## Implemented

- Cloud Run公開を前提とした単一サービス構成を採用した。
- GitHub Actionsはタグベースの本番デプロイ方針とした。
- GitHub SecretsとしてGCP連携情報、Google Client ID、許可メールを管理する方針をREADMEに記録する。

## Verification

- ローカルではDocker CLIがない環境の場合、Docker起動確認は未実施とする。
- workflowの本番確認はGCP側設定後に実施する。

## Remaining Notes

- 初回デプロイ後にCloud Run URL、OAuthリダイレクト設定、許可メール制御を実機確認する。
- 将来的に複数ユーザーへ公開する場合は認可モデルを再設計する。
