# Drawdown Board

日本株の銘柄リストから、1年分の調整後終値とdrawdownを表示するFastAPI + ReactのMVPです。

## Local Setup

```powershell
uv venv --python 3.13 .venv
uv sync
uv run uvicorn stock_drawdown_app:app --reload
```

ブラウザで `http://127.0.0.1:8000` を開きます。

## API

- `GET /api/health`
- `POST /api/drawdowns`

```json
{
  "symbols": ["7203", "6758", "9984"],
  "period": "1y"
}
```

## Notes

株価データはプロトタイプ用途として `yfinance` 経由で取得します。一般公開・マネタイズ前には、データ利用条件と本番向けデータプロバイダーを再確認してください。
