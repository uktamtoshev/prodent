import type { TranslationDictionary } from "./types";

function isDictionary(value: unknown): value is TranslationDictionary {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (isDictionary(value)) return cloneTranslationDictionary(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  return value;
}

export function cloneTranslationDictionary(
  dictionary: TranslationDictionary,
): TranslationDictionary {
  return Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [key, cloneValue(value)]),
  );
}

export function getTranslationLeafPaths(
  dictionary: TranslationDictionary,
  prefix = "",
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isDictionary(value)) {
      paths.push(...getTranslationLeafPaths(value, path));
    } else {
      paths.push(path);
    }
  }

  return paths.sort();
}

export function getEffectiveTranslationLeafPaths(
  fallback: TranslationDictionary,
  localized: TranslationDictionary,
): string[] {
  return Array.from(
    new Set([
      ...getTranslationLeafPaths(fallback),
      ...getTranslationLeafPaths(localized),
    ]),
  ).sort();
}

export function mergeTranslationDictionaries(
  target: TranslationDictionary,
  source: TranslationDictionary,
  namespace: string,
  prefix = "",
): TranslationDictionary {
  for (const [key, sourceValue] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = sourceValue;
      continue;
    }

    const targetValue = target[key];
    if (isDictionary(targetValue) && isDictionary(sourceValue)) {
      mergeTranslationDictionaries(targetValue, sourceValue, namespace, path);
      continue;
    }

    if (targetValue === sourceValue) {
      continue;
    }

    throw new Error(
      `Duplicate translation key "${path}" in namespace "${namespace}"`,
    );
  }

  return target;
}
