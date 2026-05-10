# Workspace Layout Design

## Structure

- Reactのトップレベルを `settings-panel` と `chart-scroll` に分ける。
- `settings-panel` にはヘッダー、銘柄フォーム、チャート操作設定を置く。
- `chart-scroll` には比較チャートと個別カード一覧を置く。

## Desktop CSS

- `body` はページ全体のスクロールを抑制する。
- `.app-shell` は `height: 100dvh` の縦flexにする。
- `.settings-panel` は固定高さの上部領域にする。
- `.chart-scroll` は `overflow-y: auto` のスクロール領域にする。

## Mobile CSS

- `body` の通常スクロールを許可する。
- `.app-shell` は自動高さに戻す。
- `.chart-scroll` は `overflow: visible` にして設定領域が画面を圧迫しないようにする。
