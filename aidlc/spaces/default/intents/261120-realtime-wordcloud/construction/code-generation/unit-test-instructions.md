# 単体テスト手順

## テストフレームワーク

- Vitest(TypeScript)。ルートの `vitest.config.ts` で、`packages/*/test/**/*.test.ts` と `infra/test/**/*.test.ts` を対象にします。
- 前提: Node.js 20以上、リポジトリのルートで `npm install` 済み。AWSの認証情報は不要です。

## 実行コマンド(この作業のテストのみ・正確なコマンド)

```bash
npx vitest run packages/core packages/server packages/web packages/extension infra
```

パッケージごとに実行する場合:

```bash
npx vitest run packages/core
npx vitest run packages/server
npx vitest run packages/web
npx vitest run packages/extension
npx vitest run infra
```

## 期待するテスト(Minimal戦略: 要件ごとに1件以上、コンポーネントごとに正常系1件以上、合計およそ40件)

- core: サニタイズ(制御文字、HTML特殊文字)、100文字の境界(100は受理、101は拒否)、日本語の分割と助詞の除外、英語のストップワード除外と大文字小文字の統一、混在入力、レート制限(1秒に1回、1分に20回)、ルームコード形式、主催者キーのハッシュ照合。
- server(データ層): ルーム作成と取得、語の加算、リセット、削除、TTL属性、DynamoDB実装のコマンド内容。
- server(ビジネスロジック): 存在しないルームの参加拒否、投稿の集計と表示ページへの配信、スナップショット、誤った主催者キーでのリセット拒否、終了で全削除、入力テキストが保存されないこと、許可されないOriginの拒否。
- server(接続単位のレート制限): 同じ接続が別の `clientId` を名乗っても、1秒以内の再送は `too_fast`、1分に20回を超えると `too_many` になる。別の接続は影響を受けない。
- server(API層): HTTPの経路とCORS、ローカルサーバーでのWebSocket往復(参加者の投稿が表示側へ届く)。
- web: 語の統合、サイズ計算、上位N語、設定の解析、XSSの文字列が `textContent` として扱われること。
- extension: プロトコルの組み立て、エラー表示の対応、`clientId` の生成と再利用。
- infra: CDKテンプレートのアサーション(DynamoDBのTTL、HTTPS/WSSのみ、CORS、最小権限、S3の公開ブロック)。

## カバレッジ

- この規模(Minimal)では行カバレッジの床は定めません。各コンポーネントに正常系のテストが1件以上あることを確認します。

## モックの方針

- DynamoDB: `aws-sdk-client-mock` で `DynamoDBDocumentClient` を差し替えます。ビジネスロジックのテストはインメモリの `Repository` を使います。
- API Gateway Management API(接続への送信): `Pusher` インターフェースを差し替えます。
- 形態素解析: coreのテストは実際の kuromoji.js と同梱辞書を使います(辞書の読み込みに数秒かかります)。他のテストは、語分割を差し替えた実装を使います。
- 時刻: 関数に `now` を引数で渡し、固定値を使います。

## テストデータ

- テスト内に直接書きます。個人情報やAWSの認証情報は使いません。
