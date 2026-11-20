# ログの検索(CloudWatch Logs Insights)

## 前提

- ログは2つの Lambda のロググループに出る(CDK が作成、保持は14日)。名前は `WordcloudStack-WsHandlerLogs...` と `WordcloudStack-HttpHandlerLogs...` で始まる。
- アプリは、入力テキストと主催者キーをログに出さない(要件 NFR3.3)。ログから参加者の発言は分からない。
- 保存済みクエリとしては CDK に定義していない。CloudWatch Logs Insights の画面で、ロググループを選んで次のクエリを貼り付けて使う。

## クエリ

### 1. エラーの一覧(直近)

```
fields @timestamp, @message
| filter @message like /ERROR|Error|Task timed out/
| sort @timestamp desc
| limit 50
```

### 2. 実行時間の分布(5分ごと)

```
filter @type = "REPORT"
| stats count() as invocations, avg(@duration) as avgMs, pct(@duration, 95) as p95Ms, max(@duration) as maxMs by bin(5m)
```

### 3. コールドスタートの回数と初期化時間

```
filter @type = "REPORT" and ispresent(@initDuration)
| stats count() as coldStarts, avg(@initDuration) as avgInitMs, max(@initDuration) as maxInitMs by bin(15m)
```

### 4. タイムアウト

```
filter @message like /Task timed out/
| stats count() by bin(5m)
```

## 使う場面

- アラームが発報したとき: クエリ1でエラーの内容を確認する。
- 反映が遅いと感じたとき: クエリ2と3で、実行時間とコールドスタートを確認する。
- ワークショップの後: クエリ2で、当日の p95 が3秒以内だったかを振り返る(`slo-config.md`)。
