/*
 * SUTH Suthiecare deliberately does not cache pages, API responses, or patient data.
 * This worker exists only to support secure PWA installation; all content remains
 * network-only so logout, revocation, and privacy controls take effect immediately.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
