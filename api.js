// ============================================================
// api.js — Jembatan Frontend ↔ Backend (Google Apps Script)
// Smart Quran + Ribath App
// ============================================================
// Satu-satunya file yang boleh melakukan fetch ke API.
// Tidak ada file lain yang boleh berkomunikasi langsung ke backend.
// ============================================================

// ── KONSTANTA ────────────────────────────────────────────────

export const API_URL = 'https://script.google.com/macros/s/AKfycbyQhlfFtPtAH5Gj0lZA7iowxvip-8ovo6Tqml-hsoWPeVwG_RXe0ph2fouAggI5JI3x/exec';
const TIMEOUT_MS = 10000; // 10 detik

// Key localStorage untuk offline queue dan cache
const OFFLINE_QUEUE_KEY = 'ribath_offline_queue';
const CACHE_PREFIX = 'ribath_cache_';

// ── HELPER INTERNAL ──────────────────────────────────────────

// Mendapatkan tanggal hari ini dalam format YYYY-MM-DD
function getTodayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Fetch dengan timeout — lempar Error jika melebihi TIMEOUT_MS
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Memproses response HTTP dan melempar error jika ada masalah
async function processResponse(response) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Response tidak valid');
  }
  if (data && data.success === false) {
    throw new Error(data.error || 'API mengembalikan error tidak dikenal');
  }
  return data;
}

// ── CACHE ─────────────────────────────────────────────────────

// Menyimpan data ke localStorage cache dengan TTL
function setCache(action, params, data, ttlDetik) {
  const key = `${CACHE_PREFIX}${action}_${params}`;
  const item = {
    data,
    expiredAt: Date.now() + ttlDetik * 1000
  };
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch {
    // Abaikan jika localStorage penuh
  }
}

// Mengambil data dari cache jika belum expired
function getCache(action, params) {
  const key = `${CACHE_PREFIX}${action}_${params}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (Date.now() > item.expiredAt) {
      localStorage.removeItem(key);
      return null;
    }
    return item.data;
  } catch {
    return null;
  }
}

// Menghapus cache tertentu atau semua cache ribath
export function clearCache(action = null) {
  if (action === null) {
    // Hapus semua cache yang diawali CACHE_PREFIX
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  } else {
    // Hapus semua entri cache untuk action tertentu
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CACHE_PREFIX}${action}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  }
}

// Menghapus cache yang terpengaruh setelah write berhasil
function invalidateWriteCache() {
  clearCache('get_santri');
  clearCache('get_dashboard');
  clearCache('get_feed');
}

// Fetch dengan cache — return dari cache jika belum expired
async function cachedGet(action, params, ttlDetik = 30) {
  const cacheKey = params;
  const cached = getCache(action, cacheKey);
  if (cached !== null) {
    return cached;
  }

  const queryString = new URLSearchParams({ action, ...params }).toString();
  const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
  const data = await processResponse(response);

  setCache(action, cacheKey, data, ttlDetik);
  return data;
}

// ── OFFLINE QUEUE ─────────────────────────────────────────────

// Menambahkan action ke antrian offline
function enqueueOffline(action, data) {
  let queue = [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    queue = [];
  }
  queue.push({ action, data, timestamp: Date.now() });
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Abaikan jika penuh
  }
}

// Mengirim semua item di antrian offline ke server
export async function flushOfflineQueue() {
  let queue = [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    queue = raw ? JSON.parse(raw) : [];
  } catch {
    return;
  }

  if (queue.length === 0) return;

  const remaining = [];

  for (const item of queue) {
    try {
      const response = await fetchWithTimeout(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: item.action, ...item.data })
      });
      const result = await processResponse(response);
      if (!result || result.success === false) {
        // Jika gagal di sisi server, tetap masukkan ke remaining
        remaining.push(item);
      }
      // Jika sukses: tidak dimasukkan kembali ke queue
    } catch {
      // Gagal karena network: tetap di queue
      remaining.push(item);
    }
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // Abaikan
  }

  // Setelah flush berhasil, bersihkan cache agar data fresh
  if (remaining.length < queue.length) {
    invalidateWriteCache();
  }
}

// Mengembalikan jumlah item di antrian offline
export function getOfflineQueueCount() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    return queue.length;
  } catch {
    return 0;
  }
}

// Menghapus seluruh antrian offline (untuk debugging)
export function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// Dengarkan event 'online' untuk otomatis flush antrian
window.addEventListener('online', () => {
  flushOfflineQueue();
});

// ── FUNGSI GET ─────────────────────────────────────────────────

// Mengambil daftar santri, filter aktif secara default
export async function getSantri(filterAktif = true) {
  try {
    return await cachedGet('get_santri', { aktif: String(filterAktif) }, 300);
  } catch (err) {
    throw new Error(`getSantri gagal: ${err.message}`);
  }
}

// Mengambil feed aktivitas terbaru
export async function getFeed(limit = 20, santriId = null) {
  try {
    const params = { limit: String(limit) };
    if (santriId !== null) params.santri_id = santriId;
    return await cachedGet('get_feed', params, 15);
  } catch (err) {
    throw new Error(`getFeed gagal: ${err.message}`);
  }
}

// Mengambil data ringkasan dashboard
export async function getDashboard() {
  try {
    return await cachedGet('get_dashboard', {}, 30);
  } catch (err) {
    throw new Error(`getDashboard gagal: ${err.message}`);
  }
}

// Mengambil progress hafalan Juz 30 santri tertentu
export async function getProgressJuz30(santriId) {
  try {
    const queryString = new URLSearchParams({
      action: 'get_progress_juz30',
      santri_id: santriId
    }).toString();
    const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
    return await processResponse(response);
  } catch (err) {
    throw new Error(`getProgressJuz30 gagal: ${err.message}`);
  }
}

// Mengambil hafalan terakhir santri beserta saran lanjutan
export async function getLastHafalan(santriId) {
  try {
    const queryString = new URLSearchParams({
      action: 'get_last_hafalan',
      santri_id: santriId
    }).toString();
    const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
    return await processResponse(response);
  } catch (err) {
    throw new Error(`getLastHafalan gagal: ${err.message}`);
  }
}

// Mengambil riwayat hafalan santri
export async function getHafalanHistory(santriId, limit = 10) {
  try {
    const queryString = new URLSearchParams({
      action: 'get_hafalan_history',
      santri_id: santriId,
      limit: String(limit)
    }).toString();
    const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
    return await processResponse(response);
  } catch (err) {
    throw new Error(`getHafalanHistory gagal: ${err.message}`);
  }
}

// Mengambil status SPP santri untuk bulan tertentu
// bulan: format YYYY-MM (contoh: "2026-04")
export async function getSppBulan(bulan) {
  try {
    const queryString = new URLSearchParams({
      action: 'get_spp_bulan',
      bulan: bulan
    }).toString();
    const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
    return await processResponse(response);
  } catch (err) {
    throw new Error(`getSppBulan gagal: ${err.message}`);
  }
}

// Mengambil rekap absensi santri untuk bulan tertentu
// bulan: format YYYY-MM, opsional
export async function getAbsensiRekap(santriId, bulan = null) {
  try {
    const params = {
      action: 'get_absensi_rekap',
      santri_id: santriId
    };
    if (bulan !== null) params.bulan = bulan;
    const queryString = new URLSearchParams(params).toString();
    const response = await fetchWithTimeout(`${API_URL}?${queryString}`);
    return await processResponse(response);
  } catch (err) {
    throw new Error(`getAbsensiRekap gagal: ${err.message}`);
  }
}

// ── FUNGSI POST ────────────────────────────────────────────────

// Menyimpan satu aktivitas ke backend melalui gateway
export async function saveAktivitas(santriId, jenis, nilai, catatan = '', tanggal = null) {
  const body = {
    action: 'save_aktivitas',
    santri_id: santriId,
    jenis,
    nilai,
    catatan,
    tanggal: tanggal || getTodayISO()
  };

  // Jika offline: masukkan ke antrian
  if (!navigator.onLine) {
    enqueueOffline('save_aktivitas', body);
    return { success: true, queued: true, offline: true };
  }

  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await processResponse(response);
    // Invalidasi cache setelah write berhasil
    invalidateWriteCache();
    return result;
  } catch (err) {
    // Jika tiba-tiba offline saat request berlangsung
    if (!navigator.onLine) {
      enqueueOffline('save_aktivitas', body);
      return { success: true, queued: true, offline: true };
    }
    throw new Error(`saveAktivitas gagal: ${err.message}`);
  }
}

// Menambahkan santri baru ke database
export async function addSantri(data) {
  const body = {
    action: 'add_santri',
    ...data
  };

  if (!navigator.onLine) {
    enqueueOffline('add_santri', body);
    return { success: true, queued: true, offline: true };
  }

  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await processResponse(response);
    invalidateWriteCache();
    return result;
  } catch (err) {
    if (!navigator.onLine) {
      enqueueOffline('add_santri', body);
      return { success: true, queued: true, offline: true };
    }
    throw new Error(`addSantri gagal: ${err.message}`);
  }
}

// Memperbarui data santri yang sudah ada
export async function updateSantri(santriId, perubahan) {
  const body = {
    action: 'update_santri',
    santri_id: santriId,
    ...perubahan
  };

  if (!navigator.onLine) {
    enqueueOffline('update_santri', body);
    return { success: true, queued: true, offline: true };
  }

  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await processResponse(response);
    invalidateWriteCache();
    return result;
  } catch (err) {
    if (!navigator.onLine) {
      enqueueOffline('update_santri', body);
      return { success: true, queued: true, offline: true };
    }
    throw new Error(`updateSantri gagal: ${err.message}`);
  }
}
