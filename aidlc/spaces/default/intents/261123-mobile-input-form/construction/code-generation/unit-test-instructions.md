# 単体テスト手順: スマートフォン向け簡易入力フォーム

## フレームワークと設定
- テストフレームワークは既存の vitest(ルートの `vitest.config.ts`)。新しい設定は追加しない。
- テスト対象は、ブラウザなしで動く純粋ロジック `packages/web/src/join-logic.ts`(と再利用する `packages/extension/src/protocol.ts` の関数)。画面(`join.ts`)は、ブラウザのない環境では実行しない。

## 実行コマンド(この Unit のみ)

```
npx vitest run packages/web/test/join-logic.test.ts
```

## テスト内容(約 12 件)
- `roomFromSearch`: `?room=abcd2345` から `ABCD2345` を得る / `room` なしは空文字 / 不正な文字を含む値は空文字(FR1.2、FR1.4)
- `validateRoomCode`: 空はメッセージを返す / 8 文字未満はメッセージを返す / 正しい 8 文字は `null`(FR1.2、FR1.3)
- `createLocalStore`: 保存した値を読み戻せる / `setItem` が例外を投げてもメモリ上に保持して読み戻せる(FR3.2)
- `getOrCreateClientId`(`createLocalStore` と組み合わせ): 初回に正規表現 `^[A-Za-z0-9_-]{8,64}$` を満たす値を作り、2 回目は同じ値を返す(FR3.1)
- 再 export したヘルパーが使えること: `buildSubmit` が契約どおりの JSON を返す / `describeServerMessage` が `too_long` と `ended` に日本語を返す / `remainingChars` が 100 コードポイントを基準に数える / `backoffDelay` が上限 15 秒に収まる(FR2.2、FR2.4〜FR2.6、FR3.3)

## カバレッジ目標
- express は Minimal 戦略で、要件ごとに 1 件のテストと、コンポーネントごとに正常系 1 件を置く。行カバレッジの下限は設けない(express の既定)。
- プロジェクト全体の既存テストを緑に保つことは Build and Test で確認する。

## モック・スタブ
- `localStorage` は、`getItem`、`setItem` を持つ最小のオブジェクトで置き換える。例外を投げる版も用意する。
- `randomUUID` は引数で差し替えられる(`getOrCreateClientId` の既存の引数)。
- 実際のネットワーク、WebSocket、DOM には触れない。

## テストデータ
- ルームコードの例: `ABCD2345`(使用文字 `ABCDEFGHJKMNPQRSTUVWXYZ23456789` に含まれる 8 文字)。
- テストごとに状態を共有しない。
