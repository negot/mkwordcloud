// スマートフォン向け入力フォームの画面。DOM への出力は textContent のみ(NFR2)。
import {
  LAST_ROOM_KEY,
  backoffDelay,
  buildSubmit,
  buildWsUrl,
  createLocalStore,
  describeServerMessage,
  getOrCreateClientId,
  normalizeRoomCode,
  parseConfig,
  parseServerMessage,
  remainingChars,
  roomFromSearch,
  validateRoomCode,
  type ExtConfig,
} from './join-logic.js';

const $ = <T extends Element = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`要素が見つかりません: ${sel}`);
  return el;
};

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // プライベートモード等
  }
}
const store = createLocalStore(safeStorage());

let config: ExtConfig;
let clientId = '';
let room = '';
let ws: WebSocket | undefined;
let attempt = 0;
let leaving = false;
let ended = false;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
/** 送信して返事を待っているテキスト(自分の送信履歴の表示にだけ使う)。 */
const pending: string[] = [];

function setStatus(text: string): void {
  $('#status').textContent = text;
}

function addHistory(text: string): void {
  const li = document.createElement('li');
  li.textContent = text;
  $('#history').prepend(li);
}

function updateCounter(): void {
  const text = $<HTMLInputElement>('#text-input').value;
  const remain = remainingChars(text);
  const counter = $('#counter');
  counter.textContent = remain >= 0 ? `残り ${remain} 文字` : `${-remain} 文字オーバーです`;
  counter.classList.toggle('over', remain < 0);
  $<HTMLButtonElement>('#send-btn').disabled = ended || remain < 0;
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
      $('#chat-info').textContent = '送信しました。';
    } else if (m.type === 'error') {
      pending.shift();
      $('#chat-info').textContent = '';
      $('#chat-error').textContent = describeServerMessage(m) ?? '';
    } else if (m.type === 'ended') {
      ended = true;
      leaving = true; // 終了後は再接続しない
      $('#chat-info').textContent = '';
      $('#chat-error').textContent = describeServerMessage(m) ?? '';
      setStatus('終了');
      updateCounter();
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
  const invalid = validateRoomCode(code);
  if (invalid) {
    err.textContent = invalid;
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
  ended = false;
  attempt = 0;
  $('#room-label').textContent = code;
  $('#join').hidden = true;
  $('#chat').hidden = false;
  $('#history').replaceChildren();
  $('#chat-error').textContent = '';
  $('#chat-info').textContent = '';
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

function send(): void {
  const input = $<HTMLInputElement>('#text-input');
  const text = input.value.trim();
  const err = $('#chat-error');
  $('#chat-info').textContent = '';
  if (ended) return;
  if (text.length === 0) {
    err.textContent = '送信する文字を入力してください。';
    return;
  }
  if (remainingChars(text) < 0) {
    err.textContent = '100文字以内で入力してください。';
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
  // URL の ?room= を優先し、なければ直前のルームコードを初期値にする(FR1.4、FR3.2)
  const fromUrl = roomFromSearch(location.search);
  const initial = fromUrl || (await store.get(LAST_ROOM_KEY)) || '';
  if (initial) $<HTMLInputElement>('#room-input').value = initial;
}

void main();
