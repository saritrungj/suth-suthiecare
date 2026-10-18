const CACHE_KEY = "suthie_translation_cache";
const CACHE_LIMIT = 400;
// Google's free endpoint rejects long GET URLs (the failure surfaces as a CORS
// error), so long text is translated in pieces of at most this many characters.
const CHUNK_CHARS = 300;
const THAI = /[\u0E00-\u0E7F]/;

let translationCache = {};
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) translationCache = JSON.parse(stored) || {};
} catch {
  translationCache = {};
}

const inFlight = new Map();
// Once the service fails (offline, blocked, rate limited) stop calling it for
// this page view instead of logging an error for every card on the screen.
let serviceUnavailable = false;

const saveCache = () => {
  try {
    const keys = Object.keys(translationCache);
    if (keys.length > CACHE_LIMIT)
      for (const key of keys.slice(0, keys.length - CACHE_LIMIT))
        delete translationCache[key];
    localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
  } catch {
    // Storage full or blocked: the in-memory cache still works.
  }
};

// Split on sentence and word boundaries so no piece exceeds CHUNK_CHARS.
export function splitForTranslation(text, limit = CHUNK_CHARS) {
  const chunks = [];
  let current = "";
  for (const part of text.split(/(\s+)/)) {
    if ((current + part).length <= limit) {
      current += part;
      continue;
    }
    if (current) chunks.push(current);
    // A single run without spaces (common in Thai) is cut hard.
    let rest = part;
    while (rest.length > limit) {
      chunks.push(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    current = rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(chunk) {
  if (!chunk.trim() || !THAI.test(chunk)) return chunk;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=${encodeURIComponent(chunk)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  return result[0].map((item) => item[0]).join("");
}

export async function translateTextSmart(text) {
  if (!text) return "";
  if (!THAI.test(text)) return text;
  if (translationCache[text]) return translationCache[text];
  if (serviceUnavailable) return text;
  if (inFlight.has(text)) return inFlight.get(text);

  const request = (async () => {
    try {
      const parts = [];
      for (const chunk of splitForTranslation(text))
        parts.push((await translateChunk(chunk)).trim());
      const translated = parts.filter(Boolean).join(" ");
      translationCache[text] = translated;
      saveCache();
      return translated;
    } catch (error) {
      if (!serviceUnavailable)
        console.warn(
          "Translation service unavailable; showing original text.",
          error,
        );
      serviceUnavailable = true;
      return text;
    } finally {
      inFlight.delete(text);
    }
  })();
  inFlight.set(text, request);
  return request;
}
