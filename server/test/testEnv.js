// Synthetic secrets so `pnpm test` runs without a real .env. Values are only
// filled in when unset, so a developer's or CI's own settings still win.
// These are test-only keys and never protect real data.
const defaults = {
  AES_KEY: "a".repeat(64),
  AES_SEARCH_KEY: "test-only-search-key-0123456789abcdef",
};
for (const [name, value] of Object.entries(defaults))
  if (!process.env[name]) process.env[name] = value;
