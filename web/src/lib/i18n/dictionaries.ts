import type { Locale } from "./config";
import { en } from "./dictionaries/en";
import { zh } from "./dictionaries/zh";
import { ru } from "./dictionaries/ru";

// English is the source of truth for the dictionary shape. zh/ru are typed
// against it so missing keys surface at compile time.
export type Dictionary = typeof en;

export const dictionaries: Record<Locale, Dictionary> = { en, zh, ru };

type Vars = Record<string, string | number>;

/**
 * Resolve a dot-path key (e.g. "nav.overview") against a dictionary, with
 * `{name}`-style interpolation. Falls back to the English value, then to the
 * raw key, so a missing translation degrades gracefully instead of crashing.
 */
export function translate(dict: Dictionary, key: string, vars?: Vars): string {
  const raw = lookup(dict, key) ?? lookup(en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

function lookup(dict: Dictionary, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}
