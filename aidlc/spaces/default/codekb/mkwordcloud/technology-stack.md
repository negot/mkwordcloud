# Technology Stack

- **言語**: TypeScript(ESM、`"type": "module"`)。ビルドスクリプトは .mjs。
- **実行環境**: Node >=20(engines)。Lambda は NODEJS_24_X / ARM64。
- **バックエンド**: AWS Lambda、API Gateway v2(HTTP と WebSocket)、DynamoDB(PAY_PER_REQUEST、TTL)。
- **配信**: S3(OAC)+ CloudFront(HTTPS 強制、セキュリティヘッダー、CSP)。
- **IaC**: AWS CDK v2。
- **ビルド/テスト**: esbuild ^0.23(web は target es2022、`main.js` と `join.js` の 2 本)、tsc(型検査のみ)、vitest ^2(`@vitest/coverage-v8`、カバレッジ閾値は scripts/deploy だけ)、tsx(`npm run deploy`)。
- **ブラウザ UI**: フレームワークなし(素の DOM、SVG 描画)。d3-cloud ^1.2.7 で語を配置。
- **語分割**: kuromoji ^0.1.2。
- 版数の出典: package.json 群(詳細は dependencies.md)。
