import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildSubmit,
  buildWsUrl,
  describeServerMessage,
  errorMessage,
  getOrCreateClientId,
  normalizeRoomCode,
  parseConfig,
  parseServerMessage,
  remainingChars,
  type KeyValueStore,
} from '../src/protocol.js';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(k) {
      return data.get(k);
    },
    async set(k, v) {
      data.set(k, v);
    },
  };
}

describe('プロトコルの組み立て (FR2.2, FR2.3)', () => {
  it('WebSocket URL に役割・ルーム・clientId を載せる', () => {
    expect(buildWsUrl('wss://x.example/prod/', 'ABCD2345', 'id-12345678')).toBe(
      'wss://x.example/prod?room=ABCD2345&role=participant&clientId=id-12345678',
    );
  });

  it('送信メッセージは type と text を持つJSONで、日本語もそのまま入る', () => {
    expect(JSON.parse(buildSubmit('こんにちは'))).toEqual({ type: 'submit', text: 'こんにちは' });
  });

  it('ルームコードの入力を正規化する', () => {
    expect(normalizeRoomCode(' abcd 2345 ')).toBe('ABCD2345');
  });

  it('残り文字数は100から入力のコードポイント数を引く', () => {
    expect(remainingChars('')).toBe(100);
    expect(remainingChars('😀あ')).toBe(98);
  });
});

describe('エラー表示の対応 (FR2.4)', () => {
  it('サーバーのエラーコードを日本語のメッセージに対応づける', () => {
    expect(errorMessage('too_long')).toMatch(/100文字/);
    expect(errorMessage('too_fast')).toMatch(/早すぎ/);
    expect(errorMessage('too_many')).toMatch(/上限/);
    expect(errorMessage('no_room')).toMatch(/終了/);
    expect(errorMessage('unknown-code')).toMatch(/送信できませんでした/);
  });

  it('受信メッセージを解釈し、表示用の文言を選ぶ', () => {
    const err = parseServerMessage(JSON.stringify({ type: 'error', code: 'too_fast', message: 'x' }));
    expect(err && describeServerMessage(err)).toBe(errorMessage('too_fast'));
    expect(parseServerMessage('{"type":"ack"}')).toEqual({ type: 'ack' });
    expect(parseServerMessage('{"type":"ended"}')).toEqual({ type: 'ended' });
    expect(parseServerMessage('not json')).toBeNull();
    expect(parseServerMessage(123)).toBeNull();
  });
});

describe('clientId (FR2.6, NFR3.1)', () => {
  it('初回は生成して保存し、2回目以降は同じ値を再利用する', async () => {
    const store = memoryStore();
    let n = 0;
    const gen = () => `generated-id-${++n}`;
    const first = await getOrCreateClientId(store, gen);
    const second = await getOrCreateClientId(store, gen);
    expect(first).toBe('generated-id-1');
    expect(second).toBe(first);
    expect(n).toBe(1);
  });

  it('保存された値が不正なら作り直す', async () => {
    const store = memoryStore();
    store.data.set('clientId', '<bad>');
    expect(await getOrCreateClientId(store, () => 'fresh-id-0001')).toBe('fresh-id-0001');
  });
});

describe('設定と manifest (FR2.1)', () => {
  it('config.json を検証する', () => {
    expect(parseConfig({ apiUrl: 'https://a/', wsUrl: 'wss://b/prod/' })).toEqual({ apiUrl: 'https://a', wsUrl: 'wss://b/prod' });
    expect(() => parseConfig({})).toThrow();
  });

  it('manifest は Manifest V3 で、拡張機能IDを固定する key を持つ', () => {
    const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    expect(m.manifest_version).toBe(3);
    expect(m.action.default_popup).toBe('popup.html');
    expect(m.permissions).toEqual(['storage']);
    expect(m.key).toMatch(/^[A-Za-z0-9+/=]{300,}$/);
    expect(readFileSync(new URL('../EXTENSION_ID', import.meta.url), 'utf8').trim()).toMatch(/^[a-p]{32}$/);
  });
});
