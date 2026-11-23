## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-23T11:13:16Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/observability-design.md > 承認ログの構造 (`start` 行) と logical-components.md > 実行の流れ(ステップ 5 と 6a/6b) | `start` 行の項目に「データ消失の警告への回答、承認結果」が含まれるが、`start` はステップ 5 で、データ消失の確認(6a)と承認プロンプト(6b)より前に書かれる。承認結果はその時点で存在しない。承認の判断がデプロイ前にログへ残る箇所がなく、承認ログ失敗時のフェイルクローズも「承認前に書く行」しか守らない。`deploy` 行は結果だけで承認を持たない | `start` 行から承認結果と回答を外し、承認プロンプトの直後(ステップ 7 の前)に書く `approval` 行を追加する。この行が書けなければデプロイしない。流れ図と security-design.md のフェイルクローズの説明も合わせる | Resolved (reviewer) |
| R-02 | Major | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/security-design.md > 承認した内容と、デプロイされる内容の一致 の手順 4 と 5、および logical-components.md > 実行の流れとコンポーネント表 | 「承認後にハッシュを再確認し、変わっていたらデプロイしない」(手順 5)が、流れ図にもコンポーネント表にもない。Deployer の責務は「保存したテンプレートを渡す」だけで、ハッシュの計算と照合の担当が決まっていない。ハッシュの対象(ディレクトリ内のファイル一覧、順序、`cdk` が作る一時ファイルの扱い)も未定義で、実装者が推測することになる | ハッシュの照合を Deployer(または SynthDiff)の責務として表と流れ図に加える。対象ファイルと順序を決める。`cdk.out` に CDK 自身が置くロック用などの一時ファイルは除外する、と明記する | Resolved (reviewer) |
| R-03 | Minor | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/security-design.md > 未コミットの変更(Q2 A) と logical-components.md > Preflight | 未コミットの確認は事前確認(ステップ 1)でだけ行う。その後のビルド、型検査、テスト(ステップ 2)は、追跡対象のファイルを変えうる(自動生成物、lockfile)。コミットのハッシュと実際の内容が常に一致するという主張は、ステップ 2 の後では保証されない | 合成(synth)の直前にも未コミットの確認を繰り返すか、「ビルド後に追跡対象が変わったら停止する」と書く | Resolved (reviewer) |
| R-04 | Minor | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/logical-components.md > Deployer と security-design.md > 承認後の `cdk deploy` | Deployer が `cdk deploy` に渡すフラグが決まっていない。承認プロンプトを二重にしないために CDK 自身の確認を省くと `--require-approval never` が要るが、NFR1.1 と project.md の Mandated はこれを使わないと定めている。使わなければ CDK の IAM 変更確認が割り込む | CDK 側の確認をどう扱うか(例: 人の承認をスクリプトの承認プロンプトに一本化し、その根拠を NFR1.1 の趣旨に照らして書く、または CDK の確認を残す)を決めて記録する | Resolved (reviewer) |
| R-05 | Minor | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/observability-design.md > 承認ログの構造 と security-design.md > 承認ログ | 事前確認の失敗は `start` を書くステップ 5 より前に起きるが、「停止した試行も `start` と `end` を記録する」としている。`start` に必要なテンプレートのハッシュも、その時点では存在しない。流れ図では失敗の報告が結果の行に直行する | 事前確認やビルドで停止した場合に書く行の種類と、省略される項目(ハッシュなど)を決める | Resolved (reviewer) |
| R-06 | Minor | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/logical-components.md > 実行の流れ(図の AP1 から AB、L0 から AB、AP2 から E)と aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/observability-design.md > 承認ログの構造 | 図と記録の規則が食い違っている。(1) `approval` 行を書けないとき、図は `abort` 行へ進むが、その時点で `start` 行は書き込み済みである。一方 observability-design.md は「`abort` は承認の前に中止したときだけ。`start` と `end` は書かない」とし、中止する段階の一覧(事前確認、ビルドと検証、再確認、ログの書き込み)に承認の記録の失敗がない。(2) ログに書けないことが原因の中止で、同じログへ `abort` 行を書くことになり、書けない。(3) 拒否と不一致の経路は、図では `approval` 行の後すぐ終了(AP2 から E)になるが、observability-design.md は「`start`、`approval`、`end` を記録する」としている。 | `approval` 行または `start` 行を書けない場合は、`abort` 行ではなく画面への警告と非ゼロ終了だけとし、`abort` の段階の一覧と規則に「ログが書けるとき」と明記する。拒否と不一致の経路に `end` 行の書き込みを図に加える。 | New |
| R-07 | Minor | aidlc/spaces/default/intents/261123-aws-deploy/construction/nfr-design/traceability.json > upstream_ids と coverage | 参照先はすべて実在し、記載済みの 18 件の説明は文書の内容と合っている。ただし今回の変更の中心である承認ログ(NFR1.4)、人による確認の記録(NFR1.5)、失敗の表示(NFR5.7)、StepTimer(NFR3.1)が coverage にない。NFR1.4 は「試行ごとに 1 行を追記」だが、設計は同じ `attemptId` の複数の行にしており、その差異をどの文書も明示していない。 | coverage に NFR1.4、NFR1.5、NFR5.7、NFR3.1 を追加し、NFR1.4 には「1 行ではなく `attemptId` で束ねた複数行にする」と書く。 | New |

> R-01 Reviewer note: observability-design.md に `approval` 行が定義され(承認の判断、データ消失の警告への回答、再照合の結果)、logical-components.md の流れ図でステップ 9 としてデプロイの直前に置かれた。書けないときはデプロイしない(security-design.md の承認ログ、図の AP1 から AB)。

> R-02 Reviewer note: AssemblyVerifier が追加され、対象(保存先のディレクトリ全体)、順序(承認プロンプトの後、デプロイの前)、ハッシュの計算方法、結果の提示(一致のときも)、不一致で停止、が security-design.md と logical-components.md で一致している。

> R-03 Reviewer note: ビルド後(ステップ 3)に追跡対象のファイルを再確認する設計が、Preflight の責務、流れ図、security-design.md の三か所に入っている。

> R-04 Reviewer note: `--require-approval never` を付けず、CDK の既定の確認を残すこと、人が拒否したときは中止して `deploy` 行に記録することが、Deployer と security-design.md に書かれている。

> R-05 Reviewer note: `abort` 行が定義され、まだ存在しない項目は省くと書かれた。ただし、中止する段階の範囲に下記の新しい指摘がある。

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| 行の種類の照合(読んで確認) | `abort`、`start`、`approval`、`deploy`、`postcheck`、`humancheck`、`end` はすべて observability-design.md に定義があり、logical-components.md の ApprovalLog の一覧と一致 | 未定義の行の種類はない |
| traceability.json の参照先の確認(読んで確認) | 18 件の ID はすべて nfr-requirements の文書に実在し、target の記述も文書の内容と一致 | 参照は切れていない。網羅の抜けは新しい指摘のとおり |

### Summary

前回の R-01 から R-05 はすべて直っており、承認の判断の記録と、ハッシュの再照合の持ち主、対象、順序は実装できる程度に決まっている。残りは、`abort` 行の適用範囲と流れ図の終了経路の食い違い、traceability の網羅の抜けで、どちらも実装を止める内容ではない。
