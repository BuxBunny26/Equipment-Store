/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'equipment-store-v12';
const STATIC_CACHE = 'static-v12';
const DYNAMIC_CACHE = 'dynamic-v12';

// Only cache assets that won't change between deploys
// NEVER cache index.html — it contains hashed JS/CSS references that change on every build
const STATIC_ASSETS = [
  '/manifest.json',
];

// Install event - cache static assets and immediately activate
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v12...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.log('[Service Worker] Some static assets failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up ALL old caches to force fresh content
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v12...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for everything except hashed static files
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip Supabase API calls entirely — no caching
  if (url.hostname.includes('supabase')) return;

  // Handle static assets and navigation
  event.respondWith(handleRequest(request));
});

// Network-first strategy for all requests
async function handleRequest(request) {
  const url = new URL(request.url);

  // Hashed JS/CSS files in /static/ are immutable — cache-first is safe
  if (url.pathname.startsWith('/static/')) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      return new Response('Offline', { status: 503 });
    }
  }

  // Everything else (index.html, navigation, etc.) — always network-first
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Offline — serve offline page for navigation requests
    if (request.mode === 'navigate') {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Offline - Equipment Store</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex; justify-content: center; align-items: center;
                height: 100vh; margin: 0; background: #f8fafc; color: #1e293b;
              }
              .offline-container { text-align: center; padding: 2rem; }
              h1 { color: #2563eb; margin-bottom: 0.5rem; }
              p { color: #64748b; }
              button {
                background: #2563eb; color: white; border: none;
                padding: 0.75rem 1.5rem; border-radius: 0.5rem;
                cursor: pointer; font-size: 1rem; margin-top: 1rem;
              }
              button:hover { background: #1d4ed8; }
            </style>
          </head>
          <body>
            <div class="offline-container">
              <h1>Equipment Store</h1>
              <h2>You're Offline</h2>
              <p>Check your internet connection and try again.</p>
              <button onclick="location.reload()">Retry</button>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
