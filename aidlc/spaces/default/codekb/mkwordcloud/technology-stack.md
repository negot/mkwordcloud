# Technology Stack

- **言語**: TypeScript(ESM、`"type": "module"`)。ビルドスクリプトは .mjs。
- **実行環境**: Node >=20(engines)。Lambda は NODEJS_24_X / ARM64。
- **バックエンド**: AWS Lambda、API Gateway v2(HTTP と WebSocket)、DynamoDB(PAY_PER_REQUEST、TTL)。
- **配信**: S3(OAC)+ CloudFront(HTTPS 強制、セキュリティヘッダー、CSP)。
- **IaC**: AWS CDK v2。
- **ビルド/テスト**: esbuild ^0.23(target es2022 / chrome110)、tsc(型検査のみ)、vitest ^2、tsx。
- **ブラウザ UI**: フレームワークなし(素の DOM、SVG 描画)。
- **語分割**: kuromoji ^0.1.2。
- 版数の出典: package.json 群(詳細は dependencies.md)。
