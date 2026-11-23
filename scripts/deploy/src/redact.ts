// 出力の伏せ字(NFR2.3、security-design.md「ログと出力」)。
// アクセスキー、シークレット、セッショントークンの形式を [REDACTED] に置き換える。通常の文字列は変えない。

const PLACEHOLDER = '[REDACTED]';

/** AKIA / ASIA で始まるアクセスキー ID。 */
const ACCESS_KEY_ID = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;

/** aws_secret_access_key、aws_session_token などの「名前と値」の組。値だけを伏せる。 */
const NAMED_SECRET =
  /(aws_secret_access_key|aws_session_token|aws_access_key_id|secretaccesskey|sessiontoken)(["'\s:=]+)([^\s"',}]+)/gi;

export function redact(text: string): string {
  return text
    .replace(ACCESS_KEY_ID, PLACEHOLDER)
    .replace(NAMED_SECRET, (_m, name: string, sep: string) => `${name}${sep}${PLACEHOLDER}`);
}
