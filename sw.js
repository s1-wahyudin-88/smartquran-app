// ═══════════════════════════════════════════════════════════
// sw.js — Service Worker PWA Smart Quran + Ribath Iqra
// Strategi: Cache First untuk aset statis, Network Only untuk API
// ═══════════════════════════════════════════════════════════

// ── Konfigurasi Cache ────────────────────────────────────────
const CACHE_NAME = 'ribath-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './api.js',
  './engine.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── Event INSTALL ────────────────────────────────────────────
// Saat service worker pertama kali diinstall: cache semua aset statis
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Menyimpan aset statis ke cache...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Semua aset berhasil di-cache');
        // Langsung aktif tanpa menunggu tab lama ditutup
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Gagal menyimpan cache saat install:', err);
      })
  );
});

// ── Event ACTIVATE ───────────────────────────────────────────
// Saat service worker diaktifkan: hapus cache lama yang sudah tidak dipakai
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namaCache) => {
        return Promise.all(
          namaCache
            .filter((nama) => nama !== CACHE_NAME)
            .map((namaLama) => {
              console.log('[SW] Menghapus cache lama:', namaLama);
              return caches.delete(namaLama);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker aktif dan mengontrol semua halaman');
        // Langsung kendalikan semua halaman yang sudah terbuka
        return self.clients.claim();
      })
  );
});

// ── Event FETCH ──────────────────────────────────────────────
// Menangani semua request jaringan dari aplikasi
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Request ke Google Apps Script / Google API → Network Only, jangan cache
  if (url.includes('script.google.com') || url.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Request bukan GET (POST, PUT, DELETE, dll) → Network Only
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Request GET lainnya → Cache First, fallback ke Network
  event.respondWith(
    caches.match(event.request)
      .then((responDariCache) => {
        // Jika ada di cache, langsung kembalikan dari cache
        if (responDariCache) {
          return responDariCache;
        }

        // Jika tidak ada di cache, ambil dari jaringan lalu simpan ke cache
        return fetch(event.request)
          .then((responDariNetwork) => {
            // Hanya cache respons yang valid
            if (
              !responDariNetwork ||
              responDariNetwork.status !== 200 ||
              responDariNetwork.type === 'error'
            ) {
              return responDariNetwork;
            }

            // Clone karena response hanya bisa dibaca sekali
            const responUntukCache = responDariNetwork.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responUntukCache);
              });

            return responDariNetwork;
          })
          .catch(() => {
            // ── Error Handling: tidak ada jaringan dan tidak ada cache ──

            // Untuk navigasi (buka halaman): kembalikan index.html dari cache
            if (event.request.mode === 'navigate') {
              console.warn('[SW] Offline, mengembalikan index.html dari cache');
              return caches.match('./index.html');
            }

            // Untuk aset lain yang tidak ditemukan: kembalikan 503
            console.warn('[SW] Aset tidak tersedia offline:', url);
            return new Response('Konten tidak tersedia saat offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});
