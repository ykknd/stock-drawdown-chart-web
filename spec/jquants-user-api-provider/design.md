# J-Quants User API Provider Design

## Provider Selection

- `MARKET_DATA_PROVIDER` を正規化して provider を選択する。
- 許可値は `yfinance` と `jquants`。
- 未設定または空文字は `yfinance` として扱う。
- 許可値以外は起動時または初回利用時に明示的な設定エラーにする。

## API Shape

- `DrawdownRequest` に `jquants_api_key: str | None` を追加する。
- `DrawdownResponse` にはAPIキーを含めない。
- `/api/config` のレスポンスを拡張する。

```json
{
  "enabled": false,
  "google_client_id": null,
  "market_data_provider": "jquants",
  "jquants_api_key_available": false,
  "requires_jquants_api_key_input": true
}
```

- `enabled` と `google_client_id` は既存Googleログイン設定との互換性維持のため残す。
- `jquants_api_key_available` はサーバー環境変数 `JQUANTS_API_KEY` の有無だけを示す。
- APIキーそのものは返さない。

## J-Quants Provider

- 依存関係に `jquants-api-client` を追加する。
- `jquantsapi.ClientV2` を使う。
- `JQUANTS_API_KEY` がある場合は `ClientV2()` または `ClientV2(api_key=server_key)` を使う。
- リクエストキーを使う場合は `ClientV2(api_key=request_key)` を使う。
- 株価日足は単一銘柄取得を使う。
  - `get_eq_bars_daily(code=..., from_yyyymmdd=..., to_yyyymmdd=...)`
  - `get_eq_bars_daily_range` は全銘柄範囲取得になるため、この機能では使わない。
- J-Quantsコード変換は以下とする。
  - `7203` または `7203.T` -> `72030`
  - `^N225` など指数記号はJ-Quants初回対応では未対応エラーにする。
- OHLCは調整後列を使う。
  - `AdjO`, `AdjH`, `AdjL`, `AdjC`
  - 欠損または0以下の行は除外する。
- 企業名は `get_eq_master()` から取得し、J-Quantsコードで照合する。
- `max` 期間はJ-Quantsで広い取得になるため、初回実装では2008-01-01から現在日までとする。

## Key Handling and Cache

- J-Quants APIキーの解決順は以下。
  - サーバー環境変数 `JQUANTS_API_KEY`
  - `DrawdownRequest.jquants_api_key`
  - どちらもなければHTTP 400でキー入力を促す。
- 画面入力されたキーはReact stateにのみ保持し、永続保存しない。
- サーバーログ、レスポンス、例外文言にAPIキーを含めない。
- 既存の価格キャッシュキーはproviderとcredential scopeを含める。
  - yfinance: `("yfinance", "public", symbol, period, custom_months)`
  - J-Quantsサーバーキー: `("jquants", "server", symbol, period, custom_months)`
  - J-Quantsリクエストキー: `("jquants", sha256(api_key), symbol, period, custom_months)`
- APIキーの生値はキャッシュキーやメモに保持しない。

## Frontend Behavior

- `/api/config` から `market_data_provider` とJ-Quantsキー状態を読む。
- yfinanceモードでは既存通り、日経平均 `^N225` を自動追加する。
- J-Quantsモードでは日経平均を自動追加しない。
- J-Quantsモードかつサーバーキーなしの場合だけAPIキー入力欄を表示する。
- APIキー未入力時は `POST /api/drawdowns` を呼ばず、入力を促す。
- 入力欄の補足文に以下を表示する。
  - `ローカル起動やセルフホストでは環境変数 JQUANTS_API_KEY を設定すると毎回入力を省けます。`

## Security Notes

- 公開Cloud Runに `JQUANTS_API_KEY` を設定すると、それは運営者の共有キーになる。
- 公開Webサイトでは共有 `JQUANTS_API_KEY` を設定しない運用を推奨する。
- 利用者入力キーはHTTPS経由でバックエンドに送信されるため、ログ・永続保存・レスポンス混入を禁止する。
- ブラウザから利用者PCの環境変数は読まない。
