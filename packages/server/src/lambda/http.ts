import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayPusher } from '../apigw-pusher.js';
import { DynamoRepository } from '../dynamo-repository.js';
import { handleRest, parseAllowedOrigins, type Deps } from '../service.js';

let cached: Deps | undefined;

function deps(): Deps {
  if (!cached) {
    const tableName = process.env.TABLE_NAME;
    const endpoint = process.env.WS_MANAGEMENT_ENDPOINT;
    if (!tableName || !endpoint) throw new Error('環境変数 TABLE_NAME / WS_MANAGEMENT_ENDPOINT が未設定です');
    cached = {
      repo: new DynamoRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName),
      pusher: new ApiGatewayPusher(endpoint),
      // HTTP API では語分割を使わない
      tokenize: async () => [],
      now: Date.now,
      allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
    };
  }
  return cached;
}

/** HTTP API (payload v2) のハンドラー。本文・主催者キーはログに出さない。 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body
      : '';
    const res = await handleRest(
      { method: event.requestContext.http.method, path: event.rawPath, headers: event.headers, body },
      deps(),
    );
    return { statusCode: res.status, headers: res.headers, body: res.body };
  } catch (e) {
    console.error('http-handler error', (e as Error).name);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'internal_error' }),
    };
  }
}
