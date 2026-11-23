# スモークテストの結果

デプロイ後の確認。自動のものは読み取りだけで、データは送信していない。(NFR2.6)

## 自動の確認(スクリプト、2026-11-23 12:50 UTC)

| 項目 | 確認の内容 | 結果 | 試行 |
|---|---|---|---|
| HTTP API | 存在しない部屋コードへの `GET /rooms/{code}` が 404 を返す | 成功(HTTP 404) | 1 回 |
| 表示用 Web | `https://d1l71d169uog3u.cloudfront.net` が開ける | 成功(HTTP 200) | 1 回 |

再試行は使わなかった(1 回で成功)。所要時間は 1 秒。

## 人による確認(開発者、13:01 UTC)

| 項目 | 回答 |
|---|---|
| 画面表示 | 確認した |
| WebSocket の接続 | 確認した |
| 送信から表示までの動作 | 確認した |

人が確認した範囲は、承認ログの `humancheck` 行に記録されている。「問題があった」と「確認しなかった」はない。

## 追加の確認(デプロイ後、私が読み取りだけで実行)

| 項目 | 結果 |
|---|---|
| `https://d1l71d169uog3u.cloudfront.net/join.html` | HTTP 200(`text/html`) |
| `https://d1l71d169uog3u.cloudfront.net/join.js` | HTTP 200(`text/javascript`) |
| `https://d1l71d169uog3u.cloudfront.net/config.json` | HTTP 200 |

モバイル入力フォームのページと、その実行に必要なファイルが、本番から配信されている。

## 確認していないこと

- 実際のスマートフォンのブラウザでの動作は、開発者の「送信から表示までの動作」の確認に含まれるかを、この記録では区別していない。スマートフォンで確認した場合は、そう記録してほしい。
- 負荷をかけたときの動作(今回の対象外)。

## Sources

- `deploy-logs/approvals.jsonl`(`postcheck`、`humancheck` の行)
- 開発者が共有した端末の出力

## Assumptions & Open Questions

- Assumptions: 人による確認は、本番の URL に対して行われた。
- Open questions: スマートフォンの実機で確認したか。
