import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createTokenizer, type Tokenize } from '@wordcloud/core';
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { ApiGatewayPusher } from '../apigw-pusher.js';
import { DynamoRepository } from '../dynamo-repository.js';
import {
  handleWsConnect,
  handleWsDisconnect,
  handleWsMessage,
  parseAllowedOrigins,
  type Deps,
} from '../service.js';

const repo = (() => {
  const tableName = process.env.TABLE_NAME;
  return tableName ? new DynamoRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName) : undefined;
})();

let tokenizer: Tokenize | undefined;
function getTokenizer(): Tokenize {
  tokenizer ??= createTokenizer({
    dicPath: process.env.DICT_PATH ?? `${process.env.LAMBDA_TASK_ROOT ?? '.'}/dict`,
  });
  return tokenizer;
}

/** WebSocket のイベントは $connect で届く追加フィールドを持つため、型を拡張して扱う。 */
type WsEvent = APIGatewayProxyWebsocketEventV2 & {
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
};

function buildDeps(event: WsEvent): Deps {
  if (!repo) throw new Error('環境変数 TABLE_NAME が未設定です');
  const { domainName, stage } = event.requestContext;
  return {
    repo,
    pusher: new ApiGatewayPusher(`https://${domainName}/${stage}`),
    tokenize: (text) => getTokenizer()(text),
    now: Date.now,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  };
}

/**
 * WebSocket API のハンドラー($connect / $disconnect / $default)。
 * 入力テキスト・主催者キーはログに出さない。
 * $connect の応答前は接続へ送信できないため、表示側は接続後に sync を送って snapshot を受け取る。
 */
export async function handler(event: WsEvent): Promise<APIGatewayProxyResult> {
  const connId = event.requestContext.connectionId;
  try {
    const deps = buildDeps(event);
    switch (event.requestContext.routeKey) {
      case '$connect': {
        const r = await handleWsConnect(
          { connId, query: event.queryStringParameters ?? {}, headers: event.headers ?? {} },
          deps,
        );
        return r.ok ? { statusCode: 200, body: '' } : { statusCode: 403, body: r.reason };
      }
      case '$disconnect':
        await handleWsDisconnect({ connId }, deps);
        return { statusCode: 200, body: '' };
      default:
        await handleWsMessage({ connId, body: event.body ?? '' }, deps);
        return { statusCode: 200, body: '' };
    }
  } catch (e) {
    console.error('ws-handler error', event.requestContext.routeKey, (e as Error).name);
    return { statusCode: 500, body: 'internal_error' };
  }
}
