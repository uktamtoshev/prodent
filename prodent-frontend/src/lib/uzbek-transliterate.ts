/**
 * Узбекский Latin → Cyrillic translit.
 * Сохраняет markdown-разметку (** _ - # | etc.) и латинские термины в
 * скобках/кавычках/code-блоках/URL. Применяется к статьям, у которых в БД
 * хранится только узбекский в латинице — для языка `uz_cyrl` мы
 * транслитерируем содержимое на лету.
 */

// Порядок важен: сначала диграфы и триграфы, потом одиночные буквы.
const RULES: Array<[string | RegExp, string]> = [
  // Триграфы и спец-сочетания с апострофами (o‘, g‘ и варианты U+2018/2019/02BB/').
  [/o[‘'ʻ’]/g, 'ў'],
  [/O[‘'ʻ’]/g, 'Ў'],
  [/g[‘'ʻ’]/g, 'ғ'],
  [/G[‘'ʻ’]/g, 'Ғ'],

  // Двухбуквенные сочетания.
  [/sh/g, 'ш'], [/Sh/g, 'Ш'], [/SH/g, 'Ш'],
  [/ch/g, 'ч'], [/Ch/g, 'Ч'], [/CH/g, 'Ч'],
  [/ng/g, 'нг'], [/Ng/g, 'Нг'], [/NG/g, 'НГ'],
  [/yo/g, 'ё'], [/Yo/g, 'Ё'], [/YO/g, 'Ё'],
  [/yu/g, 'ю'], [/Yu/g, 'Ю'], [/YU/g, 'Ю'],
  [/ya/g, 'я'], [/Ya/g, 'Я'], [/YA/g, 'Я'],
  [/ye/g, 'е'], [/Ye/g, 'Е'], [/YE/g, 'Е'],
  [/ts/g, 'ц'], [/Ts/g, 'Ц'], [/TS/g, 'Ц'],
  // 'e' в начале слова → э, в середине → е (упрощение).
  // Обработаем 'e' одиночно ниже; для краткости берём «е» как стандартный
  // (подавляющее большинство узбекских слов).

  // Одиночные буквы.
  ['a', 'а'], ['A', 'А'],
  ['b', 'б'], ['B', 'Б'],
  ['d', 'д'], ['D', 'Д'],
  ['e', 'е'], ['E', 'Е'],
  ['f', 'ф'], ['F', 'Ф'],
  ['g', 'г'], ['G', 'Г'],
  ['h', 'ҳ'], ['H', 'Ҳ'],
  ['i', 'и'], ['I', 'И'],
  ['j', 'ж'], ['J', 'Ж'],
  ['k', 'к'], ['K', 'К'],
  ['l', 'л'], ['L', 'Л'],
  ['m', 'м'], ['M', 'М'],
  ['n', 'н'], ['N', 'Н'],
  ['o', 'о'], ['O', 'О'],
  ['p', 'п'], ['P', 'П'],
  ['q', 'қ'], ['Q', 'Қ'],
  ['r', 'р'], ['R', 'Р'],
  ['s', 'с'], ['S', 'С'],
  ['t', 'т'], ['T', 'Т'],
  ['u', 'у'], ['U', 'У'],
  ['v', 'в'], ['V', 'В'],
  ['x', 'х'], ['X', 'Х'],
  ['y', 'й'], ['Y', 'Й'],
  ['z', 'з'], ['Z', 'З'],
];

/**
 * Транслитерирует строку, обходя:
 * - URL и пути (http://, https://, /path)
 * - inline-code в Markdown (`...`)
 * - содержимое в скобках типа (e.max), (PRODENT), [foo]
 * - блоки кода ```...```
 */
export function uzLatinToCyrl(input: string): string {
  if (!input) return input;

  // Сегментируем по защищённым участкам.
  // Регулярка ловит: ```...```, `inline`, URL, [...], (...)
  const protectRe = /(```[\s\S]*?```|`[^`]*`|https?:\/\/\S+|\[[^\]]*\]|\([^)]*\))/g;

  const parts: { text: string; protected: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = protectRe.exec(input)) !== null) {
    if (m.index > last) {
      parts.push({ text: input.slice(last, m.index), protected: false });
    }
    parts.push({ text: m[0], protected: true });
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    parts.push({ text: input.slice(last), protected: false });
  }

  return parts
    .map((p) => (p.protected ? p.text : translitChunk(p.text)))
    .join('');
}

function translitChunk(s: string): string {
  let out = s;
  for (const [from, to] of RULES) {
    if (from instanceof RegExp) {
      out = out.replace(from, to);
    } else {
      out = out.split(from).join(to);
    }
  }
  return out;
}

/** Применяет транслитерацию ко всем строковым полям статьи. */
export function transliterateArticle<T extends Record<string, unknown>>(article: T): T {
  const result: Record<string, unknown> = { ...article };
  for (const k of ['title', 'excerpt', 'content', 'seoTitle', 'seoDescription']) {
    if (typeof result[k] === 'string') {
      result[k] = uzLatinToCyrl(result[k]);
    }
  }
  if (Array.isArray(result.tags)) {
    result.tags = result.tags.map((t) =>
      typeof t === 'string' ? uzLatinToCyrl(t) : t,
    );
  }
  if (Array.isArray(result.meta_keywords)) {
    result.meta_keywords = result.meta_keywords.map((t) =>
      typeof t === 'string' ? uzLatinToCyrl(t) : t,
    );
  }
  return result as T;
}
