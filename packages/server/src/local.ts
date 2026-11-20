import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTokenizer, type ServerMessage, type Tokenize } from '@wordcloud/core';
import { WebSocket, WebSocketServer } from 'ws';
import { MemoryRepository } from './memory-repository.js';
import {
  handleRest,
  handleWsConnect,
  handleWsDisconnect,
  handleWsMessage,
  type Deps,
  type Pusher,
} from './service.js';

export interface LocalServerOptions {
  /** 0 を渡すと空いているポートを使う。 */
  port?: number;
  /** 静的ファイルの配信元(packages/web/dist)。 */
  webDir?: string;
  /** kuromoji 辞書。未指定なら node_modules の辞書。 */
  dicPath?: string;
  /** 語分割の差し替え(テスト用)。 */
  tokenize?: Tokenize;
  /** 追加で許可する Origin。 */
  extraOrigins?: string[];
}

export interface LocalServer {
  port: number;
  httpUrl: string;
  wsUrl: string;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/** ws の接続へ送信する Pusher。 */
class WsPusher implements Pusher {
  readonly sockets = new Map<string, WebSocket>();
  async push(connId: string, message: ServerMessage): Promise<boolean> {
    const ws = this.sockets.get(connId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }
}

function defaultDicPath(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('kuromoji/package.json')), 'dict');
}

function defaultWebDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
}

async function readBody(req: IncomingMessage, limit = 4096): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) return null;
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function startLocalServer(options: LocalServerOptions = {}): Promise<LocalServer> {
  const webDir = resolve(options.webDir ?? defaultWebDir());
  const tokenize = options.tokenize ?? createTokenizer({ dicPath: options.dicPath ?? defaultDicPath() });
  const pusher = new WsPusher();
  const repo = new MemoryRepository();
  let port = options.port ?? 3000;
  const deps: Deps = {
    repo,
    pusher,
    tokenize,
    now: Date.now,
    allowedOrigins: [],
    allowAnyExtension: true, // ローカルのみ: 任意の chrome-extension:// を許可する
  };
  const setOrigins = () => {
    deps.allowedOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`, ...(options.extraOrigins ?? [])];
  };
  setOrigins();

  const server: Server = createServer((req, res) => {
    handleHttp(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const path = decodeURIComponentSafe(url.pathname);

    if (path === '/config.json') {
      res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify({ apiUrl: `http://localhost:${port}`, wsUrl: `ws://localhost:${port}/ws` }));
      return;
    }
    if (path === '/rooms' || path.startsWith('/rooms/')) {
      const body = await readBody(req);
      if (body === null) {
        res.writeHead(413, { 'content-type': MIME['.json'] });
        res.end(JSON.stringify({ error: 'body_too_large' }));
        return;
      }
      const out = await handleRest(
        { method: req.method ?? 'GET', path, headers: flattenHeaders(req), body },
        deps,
      );
      res.writeHead(out.status, out.headers);
      res.end(out.body);
      return;
    }
    await serveStatic(path, res);
  }

  async function serveStatic(path: string, res: ServerResponse): Promise<void> {
    const rel = path === '/' ? '/index.html' : path;
    const file = normalize(join(webDir, rel));
    if (file !== webDir && !file.startsWith(webDir + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('見つかりません');
    }
  }

  const wss = new WebSocketServer({ noServer: true });
  let nextId = 0;
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const connId = `local-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
    handleWsConnect(
      {
        connId,
        query: {
          room: url.searchParams.get('room') ?? undefined,
          role: url.searchParams.get('role') ?? undefined,
          clientId: url.searchParams.get('clientId') ?? undefined,
        },
        headers: flattenHeaders(req),
      },
      deps,
    )
      .then((r) => {
        if (!r.ok) {
          socket.write(`HTTP/1.1 ${r.status} Rejected\r\nConnection: close\r\n\r\n`);
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          pusher.sockets.set(connId, ws);
          ws.on('message', (data) => {
            handleWsMessage({ connId, body: data.toString() }, deps).catch(() => undefined);
          });
          ws.on('close', () => {
            pusher.sockets.delete(connId);
            handleWsDisconnect({ connId }, deps).catch(() => undefined);
          });
          ws.on('error', () => ws.close());
        });
      })
      .catch(() => socket.destroy());
  });

  await new Promise<void>((ok, ng) => {
    server.once('error', ng);
    server.listen(port, () => ok());
  });
  const addr = server.address();
  if (addr && typeof addr === 'object') port = addr.port;
  setOrigins();

  return {
    port,
    httpUrl: `http://localhost:${port}`,
    wsUrl: `ws://localhost:${port}/ws`,
    close: () =>
      new Promise<void>((ok) => {
        for (const ws of pusher.sockets.values()) ws.terminate();
        wss.close();
        server.close(() => ok());
        server.closeAllConnections?.();
      }),
  };
}

function flattenHeaders(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) out[k] = Array.isArray(v) ? v.join(',') : v;
  return out;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// `npm run dev` で直接起動された場合
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  startLocalServer({ port })
    .then((s) => {
      console.log(`ローカルサーバーを起動しました: ${s.httpUrl}`);
      console.log(`WebSocket: ${s.wsUrl}`);
    })
    .catch((e) => {
      console.error('起動に失敗しました:', (e as Error).message);
      process.exit(1);
    });
}
