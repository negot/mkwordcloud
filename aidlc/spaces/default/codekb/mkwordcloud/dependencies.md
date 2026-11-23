# Dependencies

## Internal
```
server    -> core
web       -> core (subpath: protocol, constants)
extension -> core (subpath: protocol, constants)
infra     -> (成果物) web/dist, server/src/lambda/*.ts をバンドル
```
循環参照は確認していない(深く読んだ範囲では無し)。

## External(runtime)
- kuromoji ^0.1.2(core、辞書は Lambda 出力の dict/ にコピー)
- @aws-sdk/client-dynamodb, lib-dynamodb, client-apigatewaymanagementapi ^3.600.0(server)
- ws ^8.18.0(server、ローカル用)

## External(dev)
- typescript ^5.5.0、vitest ^2.0.0、esbuild ^0.23.0、tsx ^4.16.0、aws-cdk ^2.150.0、adm-zip ^0.5.16、aws-sdk-client-mock ^4.0.1、@types/*
- 脆弱性/古さの調査は未実施(lockfile は読んでいない)。
