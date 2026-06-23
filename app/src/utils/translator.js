const CACHE_KEY = 'suthie_translation_cache';

// Load initial cache from localStorage
let translationCache = {};
try {
  const stored = localStorage.getItem(CACHE_KEY);
  if (stored) {
    translationCache = JSON.parse(stored);
  }
} catch (e) {
  console.error('Failed to load translation cache', e);
}

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
  } catch (e) {
    console.error('Failed to save translation cache', e);
  }
};

export async function translateTextSmart(text) {
  if (!text) return "";
  
  // If already translated, return from cache
  if (translationCache[text]) {
    return translationCache[text];
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=th&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const result = await response.json();
    
    // Extract translated text
    const translated = result[0].map(item => item[0]).join("");
    
    // Cache it
    translationCache[text] = translated;
    saveCache(); // Persist to localStorage

    return translated;
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Fallback to original text if error
  }
}
