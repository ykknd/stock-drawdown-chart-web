# Cloud Run Deployment Tasks

- [x] Dockerfileを追加する。
- [x] `.dockerignore` を追加する。
- [x] Cloud Run向け環境変数を設計する。
- [x] Googleログイン制御を追加する。
- [x] GitHub Actions deploy workflowを追加する。
- [x] タグcommitが `main` 履歴上にあることを検証する。
- [x] READMEへCloud Run手順とSecretsを追記する。
- [x] GitHub Repository VariablesからJ-Quants providerとGCS cache設定をCloud Runへ渡す。
- [x] READMEへGitHub Repository Variablesを追記する。
- [ ] GCP側でcache用Cloud Storage bucketを作成する。
- [ ] cache用Cloud Storage bucketに1日削除のlifecycle ruleを設定する。
- [ ] Cloud Run runtime service accountへcache bucketのobject read/write権限を付与する。
- [ ] GitHub Repository Variablesを設定する。
- [ ] 実際のGCP環境で初回デプロイを確認する。
