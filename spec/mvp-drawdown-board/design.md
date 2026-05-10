# MVP Drawdown Board Design

## Architecture

- FastAPIがAPIと静的Reactアプリ配信を担当する。
- Reactはビルド工程なしの静的アプリとして `static/` から配信する。
- 株価取得は `MarketDataProvider` 抽象を経由し、現在はyfinance実装を使う。

## API

- `GET /api/health`
- `POST /api/drawdowns`

`/api/drawdowns` は銘柄、期間、足種、テクニカル指標設定を受け取り、銘柄ごとの価格・drawdown・指標値・エラーを返す。

## Data Flow

1. フロントで入力銘柄を分割し、日経平均を追加する。
2. バックエンドで日本株コードをYahoo Finance向けに正規化する。
3. yfinanceからOHLCを取得し、調整後ベースに変換する。
4. 選択された足種へ集約する。
5. closeを基準にdrawdownを計算する。
6. Reactで比較チャートと個別カードを描画する。

## Key Decisions

- `price` は互換性維持のため残し、`close` と同じ値にする。
- yfinanceはMVP用途とし、一般公開前に利用条件とデータ提供元を再確認する。
- データ永続化は行わず、ユーザー設定は `localStorage` のみに保存する。
