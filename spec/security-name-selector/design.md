# Security Name Selector Design

## Backend

- `SecurityInfo` response modelを追加する。

```json
{
  "code": "7203",
  "name": "トヨタ自動車"
}
```

- `GET /api/securities` を追加し、`data/jp_security_names.csv` の `code,name` を読み込んで返す。
- CSVは `utf-8-sig` で読み込み、BOM付きCSVにも対応する。
- CSVが存在しない、または読み込めない場合は空配列を返し、APIキーや内部パスをレスポンスに含めない。
- 認証有効時は既存APIと同じく `require_user` を通す。
- `/api/drawdowns` は既存のrequest shapeを維持し、`symbols` に銘柄コードを受け取る。
- `provider_type == "jquants"` かつ `request.jquants_free_tier == true` の場合、正規化後のユニーク銘柄数が5件を超えたらHTTP 400を返す。
- yfinanceモードとJ-Quants無料枠OFFでは既存の `DrawdownRequest.symbols` 上限20件に従う。

## Frontend

- 既存の銘柄コード入力欄を、検索欄、候補リスト、選択済みリストに置き換える。
- 起動時に `/api/securities` を取得し、React stateに保持する。
- 検索対象はまず `name` の部分一致を主とし、補助的に `code` も部分一致対象に含めてよい。
- 候補は最大20件程度に制限し、設定パネル内でスクロール可能にする。
- 候補項目は `銘柄名（コード）` 表示にする。
- 選択済み銘柄は `code` 配列として保持する。
- 選択済み表示は `銘柄名（コード）` のチップまたはコンパクトリストにする。
- 銘柄削除ボタンを各選択済み項目に置く。
- 銘柄追加・削除時は手動更新機能の `dirty` flagを立てる。
- 更新ボタン押下時は選択済みコード配列を `fetchDrawdowns()` に渡す。
- 既存の `symbolsWithBenchmark()` は維持し、yfinanceモードの `^N225` 自動追加は内部送信時だけ行う。

## Persistence and Migration

- 新しい保存キーは `drawdown-board-selected-security-codes` とする。
- 保存値はJSON配列のコード文字列とする。
- 既存の `drawdown-board-symbols` がある場合は、初回ロード時にコード文字列を読み取る。
- 銘柄一覧取得後、CSVに存在するコードだけを選択済みリストへ移行する。
- CSVに存在しないコードがある場合は、選択には追加せずnoticeで知らせる。
- 移行後は新しい保存キーへ保存する。古いキーは消しても残してもよいが、以後の主保存は新キーにする。

## J-Quants Free Tier Limit

- `appConfig.market_data_provider === "jquants"` かつ `jquantsFreeTier === true` の場合、選択上限は5件。
- 上記以外は既存API上限に合わせて20件。
- 5件選択済みの状態では、未選択候補の追加操作をdisabledにする。
- 6件以上選択済みの状態で無料枠ONにした場合は自動削除しない。
- 上限超過時は更新ボタンをdisabledにし、「J-Quants無料枠では最大5銘柄まで選択できます」と表示する。

## UI Notes

- UI文言はCSVにETF等も含まれるため、「企業名」だけでなく「銘柄名」または「企業名・銘柄名」を使う。
- 設定パネル上部の密度を保ち、既存の手動更新notice、J-Quants無料枠チェック、APIキー入力との縦方向の流れを崩さない。
- 検索欄・候補リスト・選択済みチップはモバイル幅でもはみ出さないようにする。
