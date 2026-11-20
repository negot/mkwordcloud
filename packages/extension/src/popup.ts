import {
  LAST_ROOM_KEY,
  backoffDelay,
  buildSubmit,
  buildWsUrl,
  describeServerMessage,
  getOrCreateClientId,
  normalizeRoomCode,
  parseConfig,
  parseServerMessage,
  remainingChars,
  type ExtConfig,
  type KeyValueStore,
} from './protocol.js';

const $ = <T extends Element = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`要素が見つかりません: ${sel}`);
  return el;
};

const store: KeyValueStore = {
  async get(key) {
    const r = await chrome.storage.local.get(key);
    return typeof r[key] === 'string' ? (r[key] as string) : undefined;
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
};

let config: ExtConfig;
let clientId = '';
let room = '';
let ws: WebSocket | undefined;
let attempt = 0;
let leaving = false;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
/** 送信して返事を待っているテキスト(自分の送信履歴の表示にだけ使う)。 */
const pending: string[] = [];

function setStatus(text: string): void {
  $('#status').textContent = text;
}

function addHistory(text: string): void {
  const li = document.createElement('li');
  li.textContent = text; // textContent のみ使う(HTMLとして解釈しない)
  const ul = $('#history');
  ul.appendChild(li);
  ul.scrollTop = ul.scrollHeight;
}

function connect(): void {
  setStatus(attempt === 0 ? '接続中…' : '再接続しています…');
  const socket = new WebSocket(buildWsUrl(config.wsUrl, room, clientId));
  ws = socket;
  socket.onopen = () => {
    attempt = 0;
    setStatus('接続済み');
  };
  socket.onmessage = (ev) => {
    const m = parseServerMessage(ev.data);
    if (!m) return;
    if (m.type === 'ack') {
      const t = pending.shift();
      if (t !== undefined) addHistory(t);
      $('#chat-error').textContent = '';
    } else if (m.type === 'error') {
      pending.shift();
      $('#chat-error').textContent = describeServerMessage(m) ?? '';
    } else if (m.type === 'ended') {
      $('#chat-error').textContent = describeServerMessage(m) ?? '';
    }
  };
  socket.onclose = () => {
    if (leaving) return;
    setStatus('再接続しています…');
    reconnectTimer = setTimeout(connect, backoffDelay(attempt++));
  };
  socket.onerror = () => socket.close();
}

async function join(): Promise<void> {
  const code = normalizeRoomCode($<HTMLInputElement>('#room-input').value);
  const err = $('#join-error');
  err.textContent = '';
  if (code.length < 4) {
    err.textContent = 'ルームコードを入力してください。';
    return;
  }
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}/rooms/${encodeURIComponent(code)}`);
  } catch {
    err.textContent = 'サーバーに接続できませんでした。ネットワークを確認してください。';
    return;
  }
  if (res.status === 404) {
    err.textContent = 'そのルームコードのルームは見つかりません。コードを確認してください。';
    return;
  }
  if (!res.ok) {
    err.textContent = '参加できませんでした。しばらくしてからもう一度お試しください。';
    return;
  }
  room = code;
  await store.set(LAST_ROOM_KEY, code);
  leaving = false;
  attempt = 0;
  $('#room-label').textContent = code;
  $('#join').hidden = true;
  $('#chat').hidden = false;
  $('#history').replaceChildren();
  $('#chat-error').textContent = '';
  updateCounter();
  connect();
  $<HTMLInputElement>('#text-input').focus();
}

function leave(): void {
  leaving = true;
  clearTimeout(reconnectTimer);
  ws?.close();
  pending.length = 0;
  $('#chat').hidden = true;
  $('#join').hidden = false;
}

function updateCounter(): void {
  const text = $<HTMLInputElement>('#text-input').value;
  $('#counter').textContent = `残り ${remainingChars(text)} 文字`;
}

function send(): void {
  const input = $<HTMLInputElement>('#text-input');
  const text = input.value.trim();
  const err = $('#chat-error');
  if (text.length === 0) {
    err.textContent = '送信する文字を入力してください。';
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    err.textContent = '接続していません。再接続をお待ちください。';
    return;
  }
  err.textContent = '';
  pending.push(text);
  ws.send(buildSubmit(text));
  input.value = '';
  updateCounter();
}

async function main(): Promise<void> {
  $('#join-btn').addEventListener('click', () => void join());
  $<HTMLInputElement>('#room-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void join();
  });
  $('#leave-btn').addEventListener('click', leave);
  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  $('#text-input').addEventListener('input', updateCounter);

  try {
    config = parseConfig(await (await fetch('./config.json')).json());
    clientId = await getOrCreateClientId(store);
  } catch (e) {
    $('#join-error').textContent = `設定を読み込めませんでした: ${(e as Error).message}`;
    $<HTMLButtonElement>('#join-btn').disabled = true;
    return;
  }
  const last = await store.get(LAST_ROOM_KEY);
  if (last) $<HTMLInputElement>('#room-input').value = last;
}

void main();
