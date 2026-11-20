import type { ServerMessage } from '@wordcloud/core';
import { MemoryRepository } from '../src/memory-repository.js';
import type { Deps, Pusher } from '../src/service.js';

export class SpyPusher implements Pusher {
  sent: { connId: string; message: ServerMessage }[] = [];
  gone = new Set<string>();
  async push(connId: string, message: ServerMessage): Promise<boolean> {
    if (this.gone.has(connId)) return false;
    this.sent.push({ connId, message });
    return true;
  }
  to(connId: string): ServerMessage[] {
    return this.sent.filter((s) => s.connId === connId).map((s) => s.message);
  }
}

/** 空白区切りの語を小文字にする、差し替え用の語分割。 */
export const stubTokenize = async (text: string): Promise<string[]> => [
  ...new Set(text.toLowerCase().split(/\s+/).filter(Boolean)),
];

export const ORIGIN = 'https://web.example.com';
export const EXT_ORIGIN = 'chrome-extension://' + 'a'.repeat(32);

export function makeDeps(overrides: Partial<Deps> = {}): { deps: Deps; pusher: SpyPusher; clock: { t: number } } {
  const clock = { t: 1_700_000_000_000 };
  const pusher = new SpyPusher();
  const deps: Deps = {
    repo: new MemoryRepository(() => clock.t),
    pusher,
    tokenize: stubTokenize,
    now: () => clock.t,
    allowedOrigins: [ORIGIN, EXT_ORIGIN],
    ...overrides,
  };
  return { deps, pusher, clock };
}
