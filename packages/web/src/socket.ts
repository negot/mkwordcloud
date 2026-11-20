import type { ClientMessage, ServerMessage } from '@wordcloud/core/protocol';
import { backoffDelay } from './logic.js';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SocketOptions {
  url: string;
  onMessage(message: ServerMessage): void;
  onStatus(status: ConnectionStatus): void;
}

const PING_INTERVAL_MS = 4 * 60 * 1000; // API Gateway のアイドル切断(10分)より短くする

/** 指数バックオフで自動再接続する WebSocket。再接続のたびに sync を送り、最新の snapshot を受け取る。FR4.6 */
export class ReconnectingSocket {
  private ws?: WebSocket;
  private attempt = 0;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly options: SocketOptions) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.options.onStatus('closed');
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private open(): void {
    this.options.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(this.options.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.options.onStatus('open');
      this.send({ type: 'sync' });
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_INTERVAL_MS);
    };
    ws.onmessage = (ev) => {
      try {
        this.options.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
      } catch {
        // 解釈できないメッセージは無視する
      }
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.stopped) return;
      this.options.onStatus('reconnecting');
      this.timer = setTimeout(() => this.open(), backoffDelay(this.attempt++));
    };
    ws.onerror = () => ws.close();
  }
}
