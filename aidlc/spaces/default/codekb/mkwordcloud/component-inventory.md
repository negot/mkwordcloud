# Component Inventory

## core
- 責務: 共有型/定数、ルームコードとホストキー、サニタイズ、レート制限、語分割。
- 依存: kuromoji。node:crypto を使う(ブラウザは subpath のみ利用)。

## server
- 責務: REST/WS ロジック(service.ts)、DynamoDB/メモリ リポジトリ、API Gateway への push、Lambda エントリ、ローカル開発サーバー。
- 依存: core、AWS SDK v3、ws。

## web
- 責務: 主催者の表示画面(ルーム作成、ワードクラウド描画、リセット/終了)。viewer 役で接続する。
- 依存: core(subpath)。

## extension
- 責務: 参加者の送信ポップアップ(Chrome MV3)。participant 役で接続する。clientId と最終ルームを chrome.storage.local に保存。
- 依存: core(subpath)。

## infra
- 責務: CDK スタック(S3/CloudFront、HTTP/WS API、Lambda、DynamoDB、CloudWatch ダッシュボード/アラーム)。
- 依存: aws-cdk-lib、web の dist。

## scripts
- 責務: web/extension のビルド、CDK 出力の適用、負荷試験。
