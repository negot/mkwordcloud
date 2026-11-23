# Dependencies

## Internal
```
server    -> core
web       -> core (subpath: protocol, constants)
web/join  -> extension/src/protocol.ts (相対 import)
extension -> core (subpath: protocol, constants)
infra     -> (成果物) web/dist, server/src/lambda/*.ts をバンドル
scripts/deploy -> infra(synth)、web/extension のビルド、npm test
```
循環参照は確認していない(深く読んだ範囲では無し)。web が extension の内部ファイルを直接 import している点は package 境界をまたぐ。

## External(runtime)
- kuromoji ^0.1.2(core、辞書は Lambda 出力の dict/ にコピー)
- d3-cloud ^1.2.7(web)
- @aws-sdk/client-dynamodb, lib-dynamodb, client-apigatewaymanagementapi ^3.600.0(server)
- ws ^8.18.0(server、ローカル用)

## External(dev)
- typescript ^5.5.0、vitest ^2.0.0、@vitest/coverage-v8 ^2.1.9、esbuild ^0.23.0、tsx ^4.16.0、aws-cdk ^2.150.0、adm-zip ^0.5.16、aws-sdk-client-mock ^4.0.1、@types/*(chrome、node、ws、adm-zip、d3-cloud)
- 脆弱性/古さの調査は未実施(lockfile は読んでいない)。
