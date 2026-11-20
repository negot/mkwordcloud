import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type { ServerMessage } from '@wordcloud/core';
import type { Pusher } from './service.js';

/** API Gateway Management API で接続へ送信する。切断済み(GoneException)なら false。 */
export class ApiGatewayPusher implements Pusher {
  private readonly client: ApiGatewayManagementApiClient;

  constructor(endpoint: string) {
    this.client = new ApiGatewayManagementApiClient({ endpoint });
  }

  async push(connId: string, message: ServerMessage): Promise<boolean> {
    try {
      await this.client.send(
        new PostToConnectionCommand({ ConnectionId: connId, Data: Buffer.from(JSON.stringify(message), 'utf8') }),
      );
      return true;
    } catch (e) {
      if (e instanceof GoneException || (e as { name?: string }).name === 'GoneException') return false;
      throw e;
    }
  }
}
