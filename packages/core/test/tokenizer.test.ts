import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTokenizer, type Tokenize } from '../src/index.js';

const dicPath = fileURLToPath(new URL('../../../node_modules/kuromoji/dict', import.meta.url));

describe('語分割 (FR3.2, FR3.3, FR3.4)', () => {
  let tokenize: Tokenize;
  beforeAll(async () => {
    tokenize = createTokenizer({ dicPath });
    await tokenize('猫'); // 辞書を先に読み込む
  });

  it('日本語は内容語だけを残し、助詞・助動詞を除外する', async () => {
    const words = await tokenize('私は猫が好きです');
    expect(words).toContain('猫');
    expect(words).toContain('好き');
    for (const w of ['は', 'が', 'です', '私']) expect(words).not.toContain(w);
  });

  it('動詞は基本形で採用する', async () => {
    const words = await tokenize('ワークショップを楽しんでいます');
    expect(words).toContain('ワークショップ');
    expect(words).toContain('楽しむ');
  });

  it('英語は小文字にそろえ、ストップワードを除外する', async () => {
    const words = await tokenize('The Cat is cute');
    expect(words).toEqual(['cat', 'cute']);
  });

  it('日本語と英語の混在入力を処理できる', async () => {
    const words = await tokenize('今日はReactと猫について');
    expect(words).toContain('react');
    expect(words).toContain('猫');
    expect(words).not.toContain('は');
  });

  it('1メッセージ内の重複は1回として数え、数字だけの語は除く', async () => {
    const words = await tokenize('cat cat Cat 12345 猫 猫');
    expect(words.filter((w) => w === 'cat')).toHaveLength(1);
    expect(words.filter((w) => w === '猫')).toHaveLength(1);
    expect(words).not.toContain('12345');
  });
});
