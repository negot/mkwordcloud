/** 英語のストップワード(代表的な語)。FR3.3 */
export const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set(
  (
    'a about above after again against all am an and any are aren as at be because been before being below ' +
    'between both but by can cannot could couldn did didn do does doesn doing don down during each few for from ' +
    'further had hadn has hasn have haven having he her here hers herself him himself his how i if in into is isn ' +
    'it its itself just let ll me more most my myself no nor not now of off on once only or other ought our ours ' +
    'ourselves out over own re same shan she should shouldn so some such than that the their theirs them ' +
    'themselves then there these they this those through to too under until up ve very was wasn we were weren ' +
    'what when where which while who whom why will with won would wouldn you your yours yourself yourselves ' +
    'also am s t d m o y ok yes yeah oh um uh etc via per get got going go will may might must shall'
  ).split(/\s+/),
);

/** 日本語で、内容が薄く集計に向かない語(基本形)。 */
export const JAPANESE_STOPWORDS: ReadonlySet<string> = new Set([
  'する',
  'いる',
  'ある',
  'なる',
  'できる',
  'れる',
  'られる',
  'せる',
  'くる',
  'いく',
  'おる',
  'もの',
  'こと',
  'ところ',
  'ため',
  'よう',
  'さん',
]);
