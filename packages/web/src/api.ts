export interface CreatedRoom {
  roomCode: string;
  hostKey: string;
  expiresAt: string;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('サーバーに接続できませんでした。ネットワークを確認してください。');
  }
}

export async function createRoom(apiUrl: string): Promise<CreatedRoom> {
  const r = await request(`${apiUrl}/rooms`, { method: 'POST' });
  if (!r.ok) throw new Error('ルームを作成できませんでした。しばらくしてからもう一度お試しください。');
  return (await r.json()) as CreatedRoom;
}

export async function roomExists(apiUrl: string, code: string): Promise<boolean> {
  const r = await request(`${apiUrl}/rooms/${encodeURIComponent(code)}`, { method: 'GET' });
  if (r.status === 404) return false;
  if (!r.ok) throw new Error('ルームを確認できませんでした。');
  return true;
}

async function hostCall(url: string, method: 'POST' | 'DELETE', hostKey: string): Promise<void> {
  const r = await request(url, { method, headers: { 'x-host-key': hostKey } });
  if (r.status === 403) throw new Error('主催者キーが正しくありません。');
  if (r.status === 404) throw new Error('ルームが存在しません(終了済みの可能性があります)。');
  if (!r.ok) throw new Error('操作に失敗しました。');
}

export const resetRoom = (apiUrl: string, code: string, hostKey: string) =>
  hostCall(`${apiUrl}/rooms/${encodeURIComponent(code)}/reset`, 'POST', hostKey);

export const endRoom = (apiUrl: string, code: string, hostKey: string) =>
  hostCall(`${apiUrl}/rooms/${encodeURIComponent(code)}`, 'DELETE', hostKey);
