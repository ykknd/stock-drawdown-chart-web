# J-Quants User API Provider Tasks

## Spec Handoff

Geminiはこのファイルの順に実装し、完了後に `implementation.md` を更新してください。`tasks.md` のチェックはCodexが検証時に更新します。

## Tasks

- [ ] `pyproject.toml` と `uv.lock` に `jquants-api-client` を追加する。
- [ ] `DrawdownRequest` に `jquants_api_key` を追加し、レスポンスにはAPIキーを含めない。
- [ ] `/api/config` を拡張し、`market_data_provider`、`jquants_api_key_available`、`requires_jquants_api_key_input` を返す。
- [ ] `MARKET_DATA_PROVIDER` を正規化するヘルパーを追加する。
- [ ] 不正な `MARKET_DATA_PROVIDER` 値は明示的な設定エラーにする。
- [ ] `JQUANTS_API_KEY` の有無だけを判定するヘルパーを追加する。
- [ ] J-Quantsコード変換ヘルパーを追加する。
- [ ] J-Quants用の期間開始日ヘルパーを追加する。
- [ ] `JQuantsMarketDataProvider` を追加する。
- [ ] `ClientV2.get_eq_bars_daily` から単一銘柄の日足OHLCを取得する。
- [ ] `AdjO` / `AdjH` / `AdjL` / `AdjC` から `PricePoint` を作る。
- [ ] `get_eq_master()` から企業名を取得できるようにする。
- [ ] provider選択を `create_app()` に組み込み、テスト時のprovider注入は維持する。
- [ ] J-Quantsキー解決順を `JQUANTS_API_KEY` -> request key -> HTTP 400 の順に実装する。
- [ ] 既存キャッシュキーにproviderとcredential scopeを含める。
- [ ] J-Quantsリクエストキーのcredential scopeはAPIキー生値ではなくSHA-256ハッシュにする。
- [ ] フロントのconfig stateにデータプロバイダー情報を追加する。
- [ ] yfinanceモードでは既存通り `^N225` を自動追加する。
- [ ] J-Quantsモードでは `^N225` を自動追加しない。
- [ ] J-Quantsモードかつサーバーキーなしの場合だけAPIキー入力欄を表示する。
- [ ] APIキー未入力時は取得APIを呼ばず、入力を促すnoticeを表示する。
- [ ] 入力APIキーを `localStorage` / `sessionStorage` に保存しない。
- [ ] READMEに `MARKET_DATA_PROVIDER` と `JQUANTS_API_KEY` の使い分けを追記する。
- [ ] GEMINI.mdにJ-Quants provider実装時の注意を追記する。
- [ ] provider選択、J-Quantsキー解決、APIキー非漏洩、J-Quantsコード変換のテストを追加する。
- [ ] `uv run pytest` を実行する。
- [ ] `uv run python -m py_compile stock_drawdown_app.py` を実行する。
- [ ] `node --check static/app.js` を実行する。
- [ ] 実装内容、変更ファイル、実行した確認、未対応事項を `implementation.md` に記録する。

## Acceptance Checks for Codex

- [ ] `MARKET_DATA_PROVIDER` 未設定時にyfinanceモードになる。
- [ ] `MARKET_DATA_PROVIDER=jquants` でJ-Quantsモードになる。
- [ ] J-Quantsモードでサーバーキーがある場合、画面入力なしで取得できる。
- [ ] J-Quantsモードでサーバーキーがない場合、画面入力欄と環境変数ヒントが表示される。
- [ ] APIキー未入力時に取得APIが呼ばれない。
- [ ] 入力APIキーがブラウザ永続保存されない。
- [ ] APIキーがレスポンスやエラー文言に含まれない。
- [ ] J-Quantsモードでは日経平均が自動追加されない。
