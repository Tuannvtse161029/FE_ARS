export type Locale = 'vi' | 'en';

export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en'] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  vi: '🇻🇳',
  en: '🇬🇧',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' &&
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

// The Dictionary type lives in `./dictionaries/types.ts`. Importers
// should use `import type { Dictionary } from './dictionaries/types'`
// (or just use `Record<string, string>` inline). Re-exporting here
// preserves the pre-splitting API for any caller that still imports it
// from this module.
import type { Dictionary } from './dictionaries/types';
export type { Dictionary };
/**
 * Resolve a translation for the given locale. If the requested locale has
 * no explicit value for the key, we fall back to English. If English also
 * has nothing, we return the key itself so the UI never silently renders
 * `undefined`.
 *
 * `params` optionally interpolates `{key}` placeholders in the resolved
 * string — useful for count-bearing messages such as
 * `"Used by: {topics} topic(s), {phases} phase(s)"`. Missing keys are
 * left untouched so a malformed template never throws.
 *
 * Pluralization: this implementation supports TWO conventions:
 *
 *   1. The simple `{s}` shorthand — e.g. `{count} group{s}` collapses
 *      to `1 group` when count is exactly 1 and `2 groups` otherwise.
 *      This is the cheap path used by the bulk of the dictionary.
 *
 *   2. i18next-style ICU MessageFormat plurals — e.g.
 *      `View ({count, plural, =1 {1 answer} other {# answers}})`.
 *      The `{var, plural, =N {text} other {text}}` form is parsed,
 *      the matching case is selected (preferring `=N` exact matches
 *      over the `other` fallback), and `#` inside the chosen case
 *      is substituted with the numeric value. Any `{var}` placeholders
 *      inside the case text are then re-substituted with their params.
 *      When the variable is non-numeric we fall back to the `other`
 *      case so untranslated surfaces still render.
 */
export const translate = (
  locale: Locale,
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
  // `dictionaries` is the in-memory cache the I18nContext loaded via
  // `loadDictionary()`. We accept it as a parameter (instead of importing
  // a constant from this module) so the chunk graph stays clean: callers
  // only pull in the locale chunks they actually display. The provider
  // passes the active locale's dictionary AND the English fallback so we
  // can resolve a key without ever importing the dictionary constants.
  dictionaries?: Partial<Record<Locale, Dictionary>>,
): string => {
  let raw: string | undefined;
  if (locale === 'vi') {
    raw = dictionaries?.vi?.[key];
  }
  if (!raw) raw = dictionaries?.en?.[key];
  if (!raw) raw = fallback;
  if (!raw) return key;
  if (!params) return raw;

  // Pre-compute whether any count-shaped parameter is exactly 1 so we can
  // collapse `{s}` placeholders in count-bearing templates. We accept
  // either an explicit `count` parameter or any numeric parameter with
  // name ending in `Count` so plural forms work consistently.
  const countParam = (() => {
    const direct = params.count;
    if (typeof direct === 'number') return direct;
    for (const [name, value] of Object.entries(params)) {
      if (typeof value === 'number' && /count$/i.test(name)) return value;
    }
    return null;
  })();
  const isSingular = countParam === 1;

  // Step 1 — resolve ICU MessageFormat plurals (`{var, plural, =N {…}
  // other {…}}`). Each chosen case may contain further `{var}`
  // placeholders which we re-substitute, plus the `#` shorthand which
  // gets the count value.
  let working = resolveIcuPlurals(raw, params, countParam);

  // Step 2 — substitute the remaining `{var}` placeholders.
  working = working.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    if (name === 's') {
      // Pluralization marker — strip when the count is exactly 1.
      return isSingular ? '' : 's';
    }
    return v === undefined || v === null ? match : String(v);
  });
  return working;
};

/**
 * Replace ICU MessageFormat plural expressions with the matching case.
 *
 * Recognises the i18next-style fragment:
 *
 *   {<var>, plural, =N {text} other {text}}
 *   {<var>, plural, one {text} other {text}}
 *
 * Returns the original string unchanged when the expression does not
 * match the recognised shape — this keeps `{key}` substitutions and
 * `{s}` pluralization working as before.
 *
 * The chosen case's body is post-processed:
 *   • `#` is replaced with the numeric value of the variable.
 *   • `{var}` placeholders inside the case body are re-substituted
 *     with their `params` values, so a case like `{name} has {# answers}`
 *     inside an outer `{count, plural, …}` resolves correctly.
 *
 * Non-numeric values of the outer variable resolve to the `other` case
 * (or to the original fragment if there is no `other` case) so we never
 * emit a literal `{name, plural, …}` string into the UI.
 */
function resolveIcuPlurals(
  template: string,
  params: Record<string, string | number>,
  countParam: number | null,
): string {
  // We process plural expressions left-to-right; each one may contain
  // its own nested cases, so we walk the string and split on the
  // top-level brace pairs only. A naive `\{(\w+),\s*plural,` regex
  // would also match inside an inner case, so we hand-roll a tiny
  // scanner.
  let out = '';
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch !== '{') {
      out += ch;
      i += 1;
      continue;
    }
    // Look for a closing `}` at the same depth. If we find it, check
    // whether this is a plural expression we know how to handle.
    const closing = findClosingBrace(template, i);
    if (closing === -1) {
      // Unterminated — copy the remainder verbatim.
      out += template.slice(i);
      break;
    }
    const fragment = template.slice(i + 1, closing);
    const handled = tryHandlePlural(fragment, params, countParam);
    if (handled !== null) {
      out += handled;
      i = closing + 1;
    } else {
      // Not a plural we recognise — emit the opening brace as-is and
      // let the regular `{var}` substitution pass handle it.
      out += ch;
      i += 1;
    }
  }
  return out;
}

/**
 * Locate the matching closing `}` for the `{` at `startIndex`, taking
 * nested `{…}` pairs into account. Returns the index of the matching
 * `}` or `-1` if the brace is unterminated.
 */
function findClosingBrace(template: string, startIndex: number): number {
  let depth = 1;
  for (let j = startIndex + 1; j < template.length; j += 1) {
    const c = template[j];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/**
 * If `fragment` matches `<name>, plural, <cases>`, pick the matching
 * case and return the rendered body. Returns `null` for non-plural
 * fragments so the caller knows to leave them in place for the regular
 * `{var}` pass.
 */
function tryHandlePlural(
  fragment: string,
  params: Record<string, string | number>,
  countParam: number | null,
): string | null {
  const headerMatch = /^(\w+)\s*,\s*plural\s*,\s*(.*)$/s.exec(fragment);
  if (!headerMatch) return null;
  const varName = headerMatch[1]!;
  const casesText = headerMatch[2]!;
  const cases = parsePluralCases(casesText);
  if (cases.length === 0) return null;

  const value = params[varName];
  const numeric = typeof value === 'number' ? value : countParam;
  const selected = selectPluralCase(cases, numeric);
  if (selected === null) return null;

  // Substitute `#` with the numeric value (if any) and recursively
  // resolve any `{var}` placeholders so the chosen case behaves as if
  // it were a normal key.
  const rendered = selected.text.replace(/#/g, () =>
    numeric === null ? '' : String(numeric),
  );
  return substitutePlaceholders(rendered, params);
}

/**
 * Parse a plural-cases list like `=1 {one answer} other {# answers}`
 * into `{ selector, text }` pairs. The text is the raw body inside the
 * `{…}` braces — case bodies are not interpolated here.
 */
function parsePluralCases(
  text: string,
): Array<{ selector: string; text: string }> {
  const out: Array<{ selector: string; text: string }> = [];
  let i = 0;
  while (i < text.length) {
    // Skip leading whitespace between cases.
    while (i < text.length && /\s/.test(text[i]!)) i += 1;
    if (i >= text.length) break;
    // Read the selector up to the next `{`.
    const selStart = i;
    while (i < text.length && text[i] !== '{') i += 1;
    const selector = text.slice(selStart, i).trim();
    if (selector === '' || i >= text.length) break;
    // Read the body up to the matching `}`.
    const bodyStart = i + 1;
    const bodyEnd = findClosingBrace(text, i);
    if (bodyEnd === -1) break;
    out.push({ selector, text: text.slice(bodyStart, bodyEnd) });
    i = bodyEnd + 1;
  }
  return out;
}

/**
 * Pick the case whose selector matches `numeric`. Selectors are tried
 * in declaration order, so `=1` declared before `other` wins for a
 * count of exactly 1. Returns `null` if no case matches and no
 * `other` fallback exists.
 */
function selectPluralCase(
  candidates: Array<{ selector: string; text: string }>,
  numeric: number | null,
): { selector: string; text: string } | null {
  let other: { selector: string; text: string } | null = null;
  for (const c of candidates) {
    if (c.selector === 'other') {
      other = c;
      continue;
    }
    // Exact-match selectors look like `=0`, `=1`, `=2`. Only match
    // when the value is numeric.
    if (c.selector.startsWith('=') && numeric !== null) {
      const target = Number(c.selector.slice(1));
      if (Number.isFinite(target) && target === numeric) return c;
    }
  }
  return other;
}

/**
 * Substitute `{var}` placeholders inside a chosen case body. Mirrors
 * the simple-substitution loop in `translate()` — we re-run it on the
 * inner text so ICU cases can reference other params.
 */
function substitutePlaceholders(
  body: string,
  params: Record<string, string | number>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? match : String(v);
  });
}
