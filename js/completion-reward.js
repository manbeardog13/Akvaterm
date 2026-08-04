// A tiny, dependency-free gate for earned completion motion.
//
// The visual layer belongs to the view, but the replay contract is domain-like:
// the same completed commission may celebrate once per tab, while a materially
// changed commission may earn a new moment. Keeping that contract pure makes it
// testable without a browser, GPU, storage permission, or animation clock.

export const COMPLETION_REWARD_KEY = "akv:atelier-completion-rewards";
const MAX_REMEMBERED = 12;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Stable, non-cryptographic identity for a completed commission. */
export function completionRewardSignature(value) {
  const text = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function availableSessionStorage() {
  try { return globalThis.sessionStorage || null; }
  catch { return null; }
}

/**
 * Return a registry whose claim(value) is true exactly once per signature.
 * Storage is best-effort; the in-memory set remains authoritative if privacy
 * settings, quota, or a test environment make sessionStorage unavailable.
 */
export function createCompletionRewardRegistry(storage = availableSessionStorage()) {
  const seen = new Set();
  let loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    try {
      const values = JSON.parse(storage?.getItem(COMPLETION_REWARD_KEY) || "[]");
      if (Array.isArray(values)) {
        values.filter((value) => typeof value === "string")
          .slice(-MAX_REMEMBERED).forEach((value) => seen.add(value));
      }
    } catch { /* malformed or blocked storage falls back to this module */ }
  }

  function persist() {
    try {
      storage?.setItem(COMPLETION_REWARD_KEY,
        JSON.stringify([...seen].slice(-MAX_REMEMBERED)));
    } catch { /* celebration history is helpful, never journey-critical */ }
  }

  return {
    claim(value) {
      load();
      const signature = completionRewardSignature(value);
      if (seen.has(signature)) return false;
      seen.add(signature);
      while (seen.size > MAX_REMEMBERED) seen.delete(seen.values().next().value);
      persist();
      return true;
    },
  };
}
