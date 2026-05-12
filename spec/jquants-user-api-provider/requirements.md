# J-Quants User API Provider Requirements

## User Value

Webサイト公開時に、ホスト設定だけで `yfinance` と `J-Quants` のデータ取得元を切り替えられる。公開サイトではJ-Quantsを選択し、利用者が自身のJ-Quants APIキーで日本株データを取得できる。

## Requirements

- ホスト時の環境変数 `MARKET_DATA_PROVIDER` でデータ取得元を選択できる。
- `MARKET_DATA_PROVIDER=yfinance` では既存のyfinance取得を使う。
- `MARKET_DATA_PROVIDER=jquants` ではJ-Quants APIを使う。
- `MARKET_DATA_PROVIDER` 未設定時は既存互換のため `yfinance` を使う。
- J-Quants利用時、APIキーは以下の優先順で解決する。
  - サーバー環境変数 `JQUANTS_API_KEY`
  - リクエストで渡された一時APIキー
  - どちらもない場合は取得せず、キー入力が必要なエラーを返す。
- 公開Webサイトが利用者PCの環境変数を読むことはできないため、環境変数による入力省略はローカル起動またはセルフホスト時のみの機能とする。
- 画面入力されたJ-Quants APIキーはブラウザの `localStorage` / `sessionStorage` に保存しない。
- `/api/config` は現在のデータ取得元と、サーバー側J-Quantsキーの有無だけを返す。APIキーそのものは返さない。
- J-Quantsモードでは日経平均 `^N225` の自動追加を一旦停止する。
- J-Quantsモードでキー未入力の場合、yfinanceへfallbackしない。

## Out of Scope

- J-Quants指数日足の取得。
- J-Quants APIキーのユーザー別DB保存。
- APIキーのブラウザ永続保存。
- yfinance providerの削除。
- J-Quantsプラン別機能差のUI表示。

## Acceptance Criteria

- 環境変数だけで `yfinance` / `jquants` を切り替えられる。
- J-Quantsモードでサーバー環境変数 `JQUANTS_API_KEY` がある場合、画面入力なしで取得できる。
- J-Quantsモードでサーバーキーがない場合、画面にAPIキー入力欄と `JQUANTS_API_KEY` 設定ヒントが表示される。
- J-Quants APIキー未入力時は取得せず、入力が必要な旨を表示する。
- 入力したAPIキーはレスポンス、エラー文言、`localStorage`、`sessionStorage` に残らない。
- J-Quantsモードでは `^N225` が自動追加されない。
