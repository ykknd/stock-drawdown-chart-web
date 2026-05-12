# Security Name Selector Tasks

## Spec Handoff

Geminiはこのファイルの順に実装し、完了後に `implementation.md` を更新してください。`tasks.md` のチェックはCodexが検証時に更新します。

## Tasks

- [ ] `SecurityInfo` response modelを追加する。
- [ ] `data/jp_security_names.csv` を `utf-8-sig` で読み込む銘柄一覧ヘルパーを追加する。
- [ ] `GET /api/securities` を追加し、`code,name` 一覧を返す。
- [ ] CSV未存在または読み込み失敗時は安全に空配列を返す。
- [ ] 認証有効時に `/api/securities` も `require_user` を通す。
- [ ] `/api/drawdowns` でJ-Quants無料枠ONかつ5件超のユニーク銘柄をHTTP 400で拒否する。
- [ ] yfinanceモードとJ-Quants無料枠OFFでは既存上限20件を維持する。
- [ ] `static/app.js` で `/api/securities` を読み込むstateを追加する。
- [ ] 既存の銘柄コード入力欄を検索欄 + 候補リスト + 選択済みリストに置き換える。
- [ ] 企業名・銘柄名の部分一致で候補を絞り込む。
- [ ] 候補表示を `銘柄名（コード）` にする。
- [ ] 候補クリックで選択済みコード配列に追加する。
- [ ] 選択済み銘柄を個別削除できるようにする。
- [ ] 銘柄追加・削除時にdirty flagを立てる。
- [ ] 更新ボタン押下時に選択済みコード配列を `symbols` として送信する。
- [ ] `drawdown-board-selected-security-codes` に選択済みコード配列を保存する。
- [ ] 再読み込み時に選択済みコード配列を復元する。
- [ ] 既存 `drawdown-board-symbols` からの初回移行を実装する。
- [ ] CSVに存在しない旧コードは選択に追加せずnoticeを出す。
- [ ] yfinanceモードの `^N225` 自動追加は内部送信時だけ維持する。
- [ ] J-Quants無料枠ON時は5件を超えて追加できないようにする。
- [ ] 6件以上選択済みで無料枠ONの場合、更新ボタンをdisabledにしてnoticeを表示する。
- [ ] 検索UI、候補リスト、選択済みチップのCSSを追加する。
- [ ] `GET /api/securities` のAPIテストを追加する。
- [ ] J-Quants無料枠ONで6件以上を拒否するAPIテストを追加する。
- [ ] J-Quants無料枠OFFまたはyfinanceモードで5件超が許可されるAPIテストを追加する。
- [ ] フロントの構文チェックで新UIに構文エラーがないことを確認する。
- [ ] `uv run pytest` を実行する。
- [ ] `uv run python -m py_compile stock_drawdown_app.py` を実行する。
- [ ] `node --check static/app.js` を実行する。
- [ ] 実装内容、変更ファイル、実行した確認、未対応事項を `implementation.md` に記録する。

## Acceptance Checks for Codex

- [ ] `GET /api/securities` がCSVから `code,name` の一覧を返す。
- [ ] 検索欄に文字を入力すると候補が部分一致で絞り込まれる。
- [ ] 候補から複数銘柄を選択できる。
- [ ] 選択済み銘柄を削除できる。
- [ ] 更新ボタン押下時に選択済みコードだけが `symbols` として送信される。
- [ ] 選択済み銘柄がlocalStorageから復元される。
- [ ] J-Quants無料枠ON時は5件を超えて追加できない。
- [ ] 6件以上選択済みで無料枠ONにした場合、更新できずnoticeが表示される。
- [ ] バックエンドでもJ-Quants無料枠ONの5件超リクエストがHTTP 400になる。
