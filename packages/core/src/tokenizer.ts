import kuromoji from 'kuromoji';
import { MAX_WORD_LENGTH } from './constants.js';
import { ENGLISH_STOPWORDS, JAPANESE_STOPWORDS } from './stopwords.js';

export interface TokenizerOptions {
  /** kuromoji の辞書ディレクトリ。呼び出し側が渡す。 */
  dicPath: string;
}

export type Tokenize = (text: string) => Promise<string[]>;

const JP = '\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}ー々〆';
const RUN_RE = new RegExp(`([${JP}]+)|([^${JP}]+)`, 'gu');
const EN_WORD_RE = /[\p{L}\p{N}']+/gu;
const HIRAGANA_ONE_RE = /^\p{Script=Hiragana}$/u;
const DIGITS_ONLY_RE = /^[\p{N}']+$/u;

/** 名詞のうち採用しない細分類。 */
const EXCLUDED_NOUN_DETAIL = new Set(['非自立', '代名詞', '数', '接尾', '特殊']);

type KToken = kuromoji.IpadicFeatures;

function pickJapanese(tokens: KToken[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const unknown = t.word_type === 'UNKNOWN';
    let word: string | undefined;
    if (t.pos === '名詞') {
      if (!EXCLUDED_NOUN_DETAIL.has(t.pos_detail_1)) word = t.surface_form;
    } else if (t.pos === '動詞' || t.pos === '形容詞') {
      if (t.pos_detail_1 === '自立') {
        word = t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form;
      }
    } else if (unknown && t.pos !== '記号') {
      word = t.surface_form;
    }
    if (!word) continue;
    if (HIRAGANA_ONE_RE.test(word)) continue;
    if (/^[ー々〆]+$/u.test(word)) continue;
    if (JAPANESE_STOPWORDS.has(word)) continue;
    out.push(word);
  }
  return out;
}

function pickEnglish(chunk: string): string[] {
  const out: string[] = [];
  const matches = chunk.toLowerCase().match(EN_WORD_RE) ?? [];
  for (const m of matches) {
    const w = m.replace(/^'+|'+$/g, '');
    if (w.length < 2) continue;
    if (DIGITS_ONLY_RE.test(w)) continue;
    if (ENGLISH_STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

/**
 * 語分割器を作る。kuromoji のロードは1回だけ(Promiseをキャッシュ)。
 * 1メッセージ内で重複する語は1回として数える(連投による水増しを防ぐ)。
 */
export function createTokenizer(options: TokenizerOptions): Tokenize {
  let loading: Promise<kuromoji.Tokenizer<KToken>> | undefined;
  const load = (): Promise<kuromoji.Tokenizer<KToken>> => {
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath: options.dicPath }).build((err, tk) => {
          if (err) {
            loading = undefined; // 失敗時は次回に再試行できるようにする
            reject(err);
          } else {
            resolve(tk);
          }
        });
      });
    }
    return loading;
  };

  return async (text: string): Promise<string[]> => {
    const normalized = String(text).normalize('NFKC');
    const words: string[] = [];
    let jp: kuromoji.Tokenizer<KToken> | undefined;
    for (const m of normalized.matchAll(RUN_RE)) {
      if (m[1]) {
        jp ??= await load();
        words.push(...pickJapanese(jp.tokenize(m[1])));
      } else if (m[2]) {
        words.push(...pickEnglish(m[2]));
      }
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const w of words) {
      if (w.length === 0 || Array.from(w).length > MAX_WORD_LENGTH) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      result.push(w);
    }
    return result;
  };
}
