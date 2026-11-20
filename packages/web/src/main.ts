import type { ServerMessage, WordCount } from '@wordcloud/core/protocol';
import { createRoom, endRoom, resetRoom, roomExists } from './api.js';
import { RENDER_INTERVAL_MS, renderCloud } from './cloud.js';
import {
  HOST_KEY_PREFIX,
  buildViewerWsUrl,
  mergeWords,
  parseConfig,
  parseRoomFromLocation,
  type AppConfig,
} from './logic.js';
import { ReconnectingSocket, type ConnectionStatus } from './socket.js';

const $ = <T extends Element = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`要素が見つかりません: ${sel}`);
  return el;
};

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: '接続中…',
  open: '接続中(リアルタイム)',
  reconnecting: '再接続しています…',
  closed: '切断',
};

let config: AppConfig;
let socket: ReconnectingSocket | undefined;
let words: WordCount[] = [];
let lastRender = 0;
let renderTimer: ReturnType<typeof setTimeout> | undefined;
let currentRoom = '';

function show(id: 'home' | 'created' | 'room'): void {
  for (const x of ['home', 'created', 'room']) $(`#${x}`).hidden = x !== id;
}

function hostKeyOf(code: string): string | null {
  try {
    return localStorage.getItem(HOST_KEY_PREFIX + code);
  } catch {
    return null;
  }
}

function setError(text: string): void {
  $('#home-error').textContent = text;
}

// ---------------------------------------------------------------- 描画

function scheduleRender(): void {
  if (renderTimer) return;
  const wait = Math.max(0, lastRender + RENDER_INTERVAL_MS - Date.now());
  renderTimer = setTimeout(() => {
    renderTimer = undefined;
    lastRender = Date.now();
    const svg = $<SVGSVGElement>('#cloud');
    const rect = svg.getBoundingClientRect();
    renderCloud(svg, words, Math.max(300, Math.floor(rect.width)), Math.max(200, Math.floor(rect.height)));
  }, wait);
}

function showRoomMessage(text: string | null): void {
  const el = $('#room-message');
  el.hidden = text === null;
  el.textContent = text ?? '';
}

// ---------------------------------------------------------------- 画面

function openRoom(code: string): void {
  closeRoom();
  currentRoom = code;
  words = [];
  show('room');
  showRoomMessage(null);
  $('.code').textContent = code;
  const isHost = hostKeyOf(code) !== null;
  $('#reset-btn').hidden = !isHost;
  $('#end-btn').hidden = !isHost;
  location.hash = `#/room/${code}`;

  socket = new ReconnectingSocket({
    url: buildViewerWsUrl(config.wsUrl, code),
    onStatus: (s) => {
      $('.status').textContent = STATUS_TEXT[s];
    },
    onMessage: (m: ServerMessage) => {
      if (m.type === 'snapshot') {
        words = mergeWords([], m.words);
        scheduleRender();
      } else if (m.type === 'update') {
        words = mergeWords(words, m.words);
        scheduleRender();
      } else if (m.type === 'ended' || (m.type === 'error' && m.code === 'no_room')) {
        showRoomMessage('ルームは終了しました');
        socket?.stop();
      }
    },
  });
  socket.start();
}

function closeRoom(): void {
  socket?.stop();
  socket = undefined;
  clearTimeout(renderTimer);
  renderTimer = undefined;
}

async function openFromInput(raw: string): Promise<void> {
  const code = raw.normalize('NFKC').replace(/\s+/g, '').toUpperCase();
  if (code.length < 4) {
    setError('ルームコードを入力してください。');
    return;
  }
  try {
    if (!(await roomExists(config.apiUrl, code))) {
      setError('そのルームコードのルームは見つかりません。');
      return;
    }
    setError('');
    openRoom(code);
  } catch (e) {
    setError((e as Error).message);
  }
}

function bind(): void {
  $('[data-testid="create-room"]').addEventListener('click', async () => {
    try {
      setError('');
      const room = await createRoom(config.apiUrl);
      try {
        localStorage.setItem(HOST_KEY_PREFIX + room.roomCode, room.hostKey);
      } catch {
        // 保存できなくても、画面に表示した主催者キーは使える
      }
      $('#created-code').textContent = room.roomCode;
      $('#created-key').textContent = room.hostKey;
      show('created');
    } catch (e) {
      setError((e as Error).message);
    }
  });

  $('[data-testid="start-display"]').addEventListener('click', () => {
    openRoom($('#created-code').textContent ?? '');
  });

  const input = $<HTMLInputElement>('[data-testid="room-code-input"]');
  $('[data-testid="show-room"]').addEventListener('click', () => void openFromInput(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void openFromInput(input.value);
  });

  $('#reset-btn').addEventListener('click', async () => {
    const key = hostKeyOf(currentRoom);
    if (!key || !confirm('集計をリセットします。よろしいですか?')) return;
    try {
      await resetRoom(config.apiUrl, currentRoom, key);
    } catch (e) {
      alert((e as Error).message);
    }
  });

  $('#end-btn').addEventListener('click', async () => {
    const key = hostKeyOf(currentRoom);
    if (!key || !confirm('ルームを終了し、データをすべて削除します。よろしいですか?')) return;
    try {
      await endRoom(config.apiUrl, currentRoom, key);
      try {
        localStorage.removeItem(HOST_KEY_PREFIX + currentRoom);
      } catch {
        // 無視
      }
      showRoomMessage('ルームは終了しました');
      socket?.stop();
    } catch (e) {
      alert((e as Error).message);
    }
  });

  window.addEventListener('resize', () => {
    if (!$('#room').hidden) scheduleRender();
  });
}

async function main(): Promise<void> {
  bind();
  try {
    const r = await fetch('./config.json', { cache: 'no-store' });
    config = parseConfig(await r.json());
  } catch (e) {
    setError(`設定を読み込めませんでした: ${(e as Error).message}`);
    return;
  }
  const code = parseRoomFromLocation(location.hash);
  if (code) await openFromInput(code);
}

void main();
