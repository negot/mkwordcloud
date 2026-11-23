## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T11:51:15Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | scripts/deploy/src/risk-detector.ts > detectRisks, RESOURCE_LINE と「requires replacement」の判定 | 検出の対象は、見出し行の `replace` を含む語(`replace`、`may be replaced`)、`[-]` の行、プロパティ行の `(requires replacement)` である。プロパティ行の `(may cause replacement)` だけでは検出しない。`[-] ... orphan`(保持されるリソース)は削除として警告する(過検出で、安全側)。フィクスチャ(`diff-replace.txt` など)は手書きで、実際の cdk diff の出力ではない。実際の CDK の版の出力で、見出しの形が違った場合は取りこぼす可能性がある | 実デプロイのステージの最初の `cdk diff` の出力を保存し、フィクスチャに加えて検出を確かめる。あわせて `may cause replacement` の行も置換として扱い、テストを足す | New |
| R-02 | Minor | scripts/deploy/src/main.ts > runMain の手順 4 と 8(runSynthDiff、deps.verify の呼び出し) | `runSynthDiff`(`rmSync`、ハッシュ計算)や `verify` が例外を投げると、`runMain` は捕まえずに最上位の `予期しないエラー` で終了する。デプロイはされないので安全側だが、`start` 行の後で止まったのに `approval` 行と `end` 行が残らない。設計の「start 行の後に止まった試行は approval 行と end 行」に合わない | 手順 4 と 8 の例外を捕まえ、手順 4 は abort 行、手順 8 は不一致と同じ拒否の記録(approval 行と end 行)にする。例外のテストを足す | New |
| R-03 | Minor | scripts/deploy/src/main.ts > createDefaultDeps の `onOutput`、scripts/deploy/src/deployer.ts > runDeploy の onOutput、scripts/deploy/src/prompter.ts > createReadlineIo の print | 伏せ字は到着した断片ごとに適用する。アクセスキーが 2 つの断片にまたがると伏せ字を通らない。確認プロンプトの `print` は伏せ字を通さない(出すのはアカウント ID、ARN、ハッシュ、リソース名だけで、秘密情報は含まない見込み) | 子プロセスの出力を行単位でまとめてから伏せ字を通す。または、断片またぎの限界を docs/deploy.md に書く | New |
| R-04 | Minor | scripts/deploy/src/assembly-hash.ts > listFiles | `Dirent.isFile()` が偽になるシンボリックリンクは、ファイルもディレクトリも数えない。アセット内にシンボリックリンクがあると、リンク先の内容がハッシュに入らず、承認後に差し替えられても不一致にならない。CDK のステージングは既定でリンクを保つ。現在のアセット(esbuild でまとめた Lambda、web の dist)にリンクがあるかは確認していない | リンクを見つけたら、リンク先のパスをハッシュに含める。またはリンクを見つけたら失敗として扱う。実アセットに無いことを最初の実行で確かめる | New |
| R-05 | Minor | scripts/deploy/src/deployer.ts > runDeploy と scripts/deploy/src/exec.ts > run('inherit') | `cdk deploy` は標準入力を引き継ぎ、標準出力と標準エラーをパイプにする。この組み合わせで CDK の確認の文言が見え、`Aborted by user` が出るか、環境変数 `CI` が設定されていると CDK が確認なしで中止しないか、は実機で確認していない(code-summary.md にも書いてある)。判定できなければ `rejectedByCdk` は偽になり、失敗の報告に流れる(deploy 行の記録だけが違う。デプロイの安全性には影響しない) | 最初の実デプロイで、権限が広がる変更の確認の表示と拒否の記録を確かめる。違えば判定を直す | New |
| R-06 | Minor | scripts/deploy/test/synth-risk.test.ts > 「色つきの出力でも検出し…」 | `.replace(/replace$/gm, 'replace')` は同じ文字列に置き換えるだけの何もしない処理で、テストの意図(色の制御文字)に関係しない。テスト自体は ESC の除去が壊れれば失敗するので、無意味に通るわけではない | 何もしない `replace` を消す | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npx vitest run scripts/deploy` | PASS: 9 ファイル、132 件すべて成功 | code-summary.md の件数と内訳(19+8+19+5+17+21+11+11+21=132)に一致する |
| `npx vitest run scripts/deploy --coverage` | PASS: 終了コード 0。行 97.94%、分岐 92.55%、関数 78.04%。しきい値は `thresholds: { lines: 80 }` | 行のしきい値を通過。`vitest.config.ts` の差分は追加だけで、しきい値を下げた形跡はない。未カバー行は code-summary.md の記載と一致する(main.ts 253-255 などの既定の配線、post-deploy.ts 40-41、preflight.ts 127-128、prompter.ts 81-82) |
| `npm run typecheck` | PASS: エラーなし | scripts/deploy の src と test が tsconfig の対象に入っている |
| `npm test`(全体、追加の確認) | PASS: 19 ファイル、224 件 | code-summary.md の記載に一致する |

**依頼された確認項目の結果**

1. `cdk deploy` の前: `main.ts` の流れで、`deps.deploy` の呼び出しは `row('start')` の成功、データ消失の確認、承認プロンプト、`deps.verify`(ハッシュを画面に表示して照合)、`row('approval')` の成功の後だけにある。これより前に `runDeploy` を呼ぶ経路はない。結合テスト(経路 1、3、4 と、start 行・approval 行を書けない場合)がこの順序を確かめている。
2. `--require-approval never` は `scripts/deploy/src` と `package.json` のどこにもない(grep で確認)。`deployArgs` は `cdk deploy --app <dir> --outputs-file cdk-outputs.json` だけである。docs/deploy.md の 35 行目に「なし」と書いてあるだけである。
3. 子プロセスは `spawn(..., { shell: false })` の 1 か所だけで、`exec`、`execSync`、`spawnSync` は使っていない。メタ文字を含む引数が配列のまま渡ることは、実プロセスのテストで確かめている。画面とログ、失敗の理由は `redact` を通す。限界は上の Minor の 3 行目。
4. 承認ログの規則は、`logical-components.md` と `observability-design.md` に一致する。start 行より前は abort 行だけ。start 行の後の拒否とハッシュの不一致は approval 行と end 行。start 行と approval 行を書けないときは、画面に表示して非ゼロで終了し、デプロイしない。例外が出た場合だけ合わない(上の Minor の 2 行目)。
5. 自動確認は `method: 'GET'` だけで、本文もヘッダーも送らない。確認先は `GET /rooms/AAAAAAAA`(サーバーが 404 を返す経路)と Web の URL。POST や書き込みの経路はない。
6. DynamoDB と S3 の置換と削除の検出は、想定した形式(`[~] ... replace`、`(requires replacement)`、`[-] ... destroy`)には働く。実際の出力で取りこぼす可能性は上の Minor の 1 行目。
7. テストは実装を差し替えて呼び出しの順序、記録の行、引数を検証していて、常に通る形ではない。しきい値は下げていない。
8. code-summary.md の記載は、実測できる範囲(件数、カバレッジ、未カバー行、変更したファイル、設定の差分)がすべて事実と一致した。実測できない記載(`traceability.json` の `upstream_ids` の突き合わせ未実施、`cdk` の実機での動作未確認)は、同じ文書に未実施と明記されている。

### Summary

承認前にデプロイする経路はなく、承認ログの規則、`--require-approval never` の不在、シェルを使わない実行、GET だけの自動確認はコードとテストで確かめられた。残る指摘はすべて Minor で、実際の `cdk diff` と `cdk deploy` の出力で確かめる項目と、例外時の記録の漏れである。開発者はこの文書とコードから実装を引き継げる。
