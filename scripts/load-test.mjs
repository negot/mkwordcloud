// 100人規模の負荷を模擬し、送信から表示側への反映遅延(p95)を測る。
// 使い方: node scripts/load-test.mjs [--api http://localhost:3000] [--ws ws://localhost:3000/ws]
//                                    [--clients 100] [--duration 20] [--interval 3500] [--origin <Origin>]
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const api = arg('api', 'http://localhost:3000').replace(/\/+$/, '');
const wsBase = arg('ws', 'ws://localhost:3000/ws').replace(/\/+$/, '');
const clients = Number(arg('clients', '100'));
const durationSec = Number(arg('duration', '20'));
const intervalMs = Number(arg('interval', '3500')); // 1分に20回の上限を超えない間隔
const origin = arg('origin', undefined);
const headers = origin ? { Origin: origin } : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : NaN);

function open(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', (_q, res) => reject(new Error(`接続拒否: HTTP ${res.statusCode}`)));
    ws.once('error', reject);
  });
}

const createdRes = await fetch(`${api}/rooms`, { method: 'POST', headers });
if (!createdRes.ok) {
  console.error(`ルームを作成できません: HTTP ${createdRes.status}`);
  process.exit(1);
}
const { roomCode, hostKey } = await createdRes.json();
console.log(`ルーム ${roomCode} で ${clients} クライアント、${durationSec} 秒間、${intervalMs}ms 間隔で送信します`);

// 表示側 1 接続
const sentAt = new Map(); // word -> 送信時刻
const latencies = [];
let updates = 0;
const viewer = await open(`${wsBase}?room=${roomCode}&role=viewer`);
viewer.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.type !== 'update') return;
  updates++;
  const now = Date.now();
  for (const w of m.words) {
    const t = sentAt.get(w.word);
    if (t !== undefined) {
      latencies.push(now - t);
      sentAt.delete(w.word);
    }
  }
});
viewer.send(JSON.stringify({ type: 'sync' }));

// 参加者
let sent = 0;
let acked = 0;
const errors = {};
const participants = [];
let connectFailed = 0;
await Promise.all(
  Array.from({ length: clients }, async (_, i) => {
    try {
      const ws = await open(`${wsBase}?room=${roomCode}&role=participant&clientId=${randomUUID()}`);
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString());
        if (m.type === 'ack') acked++;
        else if (m.type === 'error') errors[m.code] = (errors[m.code] ?? 0) + 1;
      });
      participants.push({ ws, i });
    } catch {
      connectFailed++;
    }
  }),
);
console.log(`接続: 参加者 ${participants.length}/${clients}(失敗 ${connectFailed})、表示側 1`);

const endAt = Date.now() + durationSec * 1000;
await Promise.all(
  participants.map(async ({ ws, i }) => {
    await sleep(Math.random() * intervalMs); // 送信時刻をばらけさせる
    let seq = 0;
    while (Date.now() < endAt && ws.readyState === WebSocket.OPEN) {
      const word = `lt${i}n${seq++}`;
      sentAt.set(word, Date.now());
      ws.send(JSON.stringify({ type: 'submit', text: word }));
      sent++;
      await sleep(intervalMs);
    }
  }),
);
await sleep(3000); // 最後の配信を待つ

latencies.sort((a, b) => a - b);
const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);
console.log('--- 結果 ---');
console.log(`送信 ${sent} 件 / ack ${acked} 件 / 表示側が受けた反映 ${latencies.length} 件(update ${updates} 通)`);
console.log(`エラー: ${JSON.stringify(errors)}`);
console.log(`反映遅延 p50=${p50}ms p95=${p95}ms max=${latencies.at(-1) ?? NaN}ms`);
const lost = sent - latencies.length;
console.log(`取りこぼし: ${lost} 件`);
const ok = p95 <= 3000 && lost === 0;
console.log(ok ? 'NFR1.2/NFR1.3: 合格(p95 3秒以内、取りこぼしなし)' : 'NFR1.2/NFR1.3: 要確認');

for (const { ws } of participants) ws.close();
viewer.close();
await fetch(`${api}/rooms/${roomCode}`, { method: 'DELETE', headers: { ...headers, 'x-host-key': hostKey } }).catch(() => {});
process.exit(ok ? 0 : 2);
