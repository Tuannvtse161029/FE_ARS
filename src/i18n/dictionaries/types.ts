/**
 * Per-locale dictionary type. Each locale ships its own chunk via a
 * lazy-loaded module so the entry bundle never carries both English and
 * Vietnamese strings at once.
 */
export type Dictionary = Record<string, string>;
