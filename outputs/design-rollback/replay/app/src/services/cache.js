class FormCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 5 * 60 * 1000; // 5 นาที
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // ✅ ตรวจสอบ expiry
    if (Date.now() - item.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
}

export const formCache = new FormCache();
