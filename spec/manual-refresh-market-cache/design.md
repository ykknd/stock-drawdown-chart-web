# Manual Refresh Market Cache Design

## Frontend

- `fetchDrawdowns()` は `onSubmit()`、つまり更新ボタン押下からのみ呼ぶ。
- `useEffect` による初回自動取得を廃止し、初回はconfigとmarket eventsのみ読み込む。
- `onPeriodChange`、`onCandleIntervalChange`、`updateTechnicalIndicators`、`onJquantsFreeTierChange` ではstate/localStorage更新とdirty flag設定だけ行う。
- `ddRange` と `xZoom` はdirty扱いにせず即時反映する。
- 更新成功時にdirty flagを解除し、localStorageへ現在設定を保存する。

## Backend API

- 既存の `POST /api/drawdowns` のwire shapeは原則維持する。
- 必要ならレスポンスに `cache_status` などの診断情報を追加してよいが、UI必須表示にはしない。
- `/api/config` に以下を追加する。
  - `market_data_cache_backend`
  - `market_data_cache_daily_enabled`
- APIキー生値は返さない。

## Cache Backend

- `MARKET_DATA_CACHE_BACKEND=memory | local | gcs` で保存先を切り替える。
- 未設定時は既存互換のため `memory` とする。
- local backend:
  - `MARKET_DATA_CACHE_DIR` で保存先を指定する。
  - 未設定時の推奨既定値は `%LOCALAPPDATA%\drawdown-chart\market-data-cache` とする。
- gcs backend:
  - `MARKET_DATA_CACHE_GCS_BUCKET` でbucket名を指定する。
  - `MARKET_DATA_CACHE_GCS_PREFIX` でobject prefixを指定する。
- GCS利用時は `google-cloud-storage` を依存に追加する。
- Cloud Storageのライフサイクル1日削除はREADMEで運用手順として案内する。

## Cache Key

- キャッシュキーは以下を含める。
  - `provider_type`
  - `credential_scope`
  - `symbol`
  - `jquants_free_tier`
  - `cache_date`
- `cache_date` はJST基準の `YYYY-MM-DD` とする。
- `credential_scope` は既存方針を維持する。
  - yfinance: `public`
  - J-Quantsサーバーキー: `server`
  - J-Quantsリクエストキー: `sha256(api_key)`

## Cache Data

- 保存内容は `PricePoint` 配列、`fetched_at`、`data_start_date`、`data_end_date`、`provider_type`、`symbol`、`jquants_free_tier` とする。
- APIキー、Authorization header、request keyは保存しない。
- 要求期間がキャッシュ範囲に完全包含される場合は、providerを呼ばずに必要範囲だけ切り出して利用する。
- 要求期間が不足する場合はproviderから取得し、より広い範囲で同日キャッシュを更新する。
- drawdown、回復力、ローソク足集約、テクニカル指標はキャッシュ後データから毎回再計算する。

## Security Notes

- J-QuantsキャッシュはAPIキーscope単位で分離し、別ユーザーまたは別APIキー間で共有しない。
- APIキー生値はファイル名、object名、JSON本文、ログ、レスポンスに含めない。
- 公開Cloud Runで共有 `JQUANTS_API_KEY` を設定した場合、そのサーバーキーscope内では利用者間でキャッシュが共有される。BYOキー運用では共有サーバーキーを設定しない。
