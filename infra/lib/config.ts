/**
 * 拡張機能ID(packages/extension/EXTENSION_ID と同じ値)。
 * manifest の key で固定しているため、CORS・WebSocket の許可 Origin に使える。
 * cdk context `extensionId` で上書きできる。
 */
export const DEFAULT_EXTENSION_ID = 'bdakebdbelanamofgcgnjhdnkifbodpd';

export const TABLE_NAME_PREFIX = 'wordcloud';
export const WS_STAGE_NAME = 'prod';
