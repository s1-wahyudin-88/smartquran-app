// ============================================================
// app.js — Controller Utama Smart Quran + Ribath App
// ============================================================
// ES Module. Tidak ada logic bisnis di sini.
// Semua data lewat api.js, semua transformasi lewat engine.js.
// ============================================================

import * as API from './api.js';
import * as Engine from './engine.js';

// ══════════════════════════════════════════════════════════════
// STATE GLOBAL
// ══════════════════════════════════════════════════════════════

const state = {
  pin: null,
  santriList: [],
  dashboardData: null,
  activeTab: 'dashboard',
  selectedSantriId: null,
  offlineMode: false,
  isLoading: false,
  catatanSantriIndex: 0,
  catatanSantriUrutan: [],
  sudahDicatatHariIni: new Set()
};

// ══════════════════════════════════════════════════════════════
// INISIALISASI
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  // Setup listener online/offline
  window.addEventListener('offline', () => {
    state.offlineMode = true;
    document.getElementById('offline-banner')?.classList.add('active');
  });
  window.addEventListener('online', () => {
    state.offlineMode = false;
    document.getElementById('offline-banner')?.classList.remove('active');
    showToast('Kembali online — mengirim data tertunda...', 'success');
  });

  // Setup PIN listener
  setupPinListeners();

  // Cek sesi
  const sesi = sessionStorage.getItem('ribath_session');
  if (sesi === 'ok') {
    document.getElementById('pin-overlay')?.classList.remove('active');
    await initApp();
  } else {
    document.getElementById('pin-overlay')?.classList.add('active');
    setTimeout(() => document.getElementById('pin-1')?.focus(), 300);
  }
});

async function initApp() {
  try {
    const data = await API.getSantri(true);
    state.santriList = Array.isArray(data) ? data : (data.data || data.santri || []);
  } catch (err) {
    showToast('Gagal memuat data santri', 'error');
    state.santriList = [];
  }

  initEventListeners();
  await initDashboard();

  const qCount = API.getOfflineQueueCount();
  if (qCount > 0) {
    showToast(`Ada ${qCount} data offline menunggu sync`, 'warning');
  }
}

function initEventListeners() {
  // Navbar
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  // Header
  document.getElementById('btn-notif')?.addEventListener('click', openNotifPanel);
  document.getElementById('notif-overlay')?.addEventListener('click', closeNotifPanel);
  document.getElementById('btn-notif-close')?.addEventListener('click', closeNotifPanel);

  // Absensi
  document.getElementById('btn-semua-hadir')?.addEventListener('click', handleSemuaHadir);
  document.getElementById('btn-simpan-absensi')?.addEventListener('click', simpanAbsensi);
  document.getElementById('bs-absensi-overlay')?.addEventListener('click', () => closeBottomSheet('absensi'));

  // Catatan
  document.getElementById('btn-simpan-catatan')?.addEventListener('click', simpanCatatan);
  document.getElementById('btn-skip-catatan')?.addEventListener('click', skipCatatan);
  document.getElementById('btn-prev-santri')?.addEventListener('click', () => navigasiSantri(-1));
  document.getElementById('btn-next-santri')?.addEventListener('click', () => navigasiSantri(1));
  document.getElementById('modal-catatan-close')?.addEventListener('click', () => closeModal('modal-catatan'));

  // SPP
  document.getElementById('btn-simpan-spp')?.addEventListener('click', simpanSpp);
  document.getElementById('modal-spp-close')?.addEventListener('click', () => closeModal('modal-spp'));

  // Santri
  document.getElementById('btn-simpan-santri')?.addEventListener('click', simpanTambahSantri);
  document.getElementById('btn-edit-santri')?.addEventListener('click', handleEditSantri);
  document.getElementById('fab-tambah')?.addEventListener('click', openFormTambahSantri);
  document.getElementById('search-santri')?.addEventListener('input', handleSearchSantri);
  document.getElementById('modal-tambah-santri-close')?.addEventListener('click', () => closeModal('modal-tambah-santri'));

  // Profil
  document.getElementById('modal-profil-close')?.addEventListener('click', () => closeModal('modal-profil'));

  // Bottom sheet overlay
  document.getElementById('bs-catatan-overlay')?.addEventListener('click', () => closeBottomSheet('catatan'));
}

// ══════════════════════════════════════════════════════════════
// LAYAR PIN
// ══════════════════════════════════════════════════════════════

function setupPinListeners() {
  const inputs = document.querySelectorAll('.pin-input');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      // Hanya terima angka
      e.target.value = e.target.value.replace(/\D/g, '');
      if (e.target.value && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
      // Cek jika semua terisi
      const pin = Array.from(inputs).map(i => i.value).join('');
      if (pin.length === 4) validatePin(pin);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });
  });
}

function validatePin(pin) {
  const pinTersimpan = localStorage.getItem('ribath_pin') || '1234';
  if (pin === pinTersimpan) {
    sessionStorage.setItem('ribath_session', 'ok');
    document.getElementById('pin-overlay')?.classList.remove('active');
    initApp();
  } else {
    const row = document.querySelector('.pin-input-row');
    row?.classList.add('shake');
    const errEl = document.getElementById('pin-error');
    if (errEl) errEl.classList.remove('hidden');
    document.querySelectorAll('.pin-input').forEach(i => { i.value = ''; });
    setTimeout(() => {
      row?.classList.remove('shake');
      document.getElementById('pin-1')?.focus();
    }, 600);
  }
}

function openUbahPin() {
  const html = `
    <div class="modal-overlay active" id="modal-ubah-pin">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">Ubah PIN</span>
          <button class="modal-close" id="btn-close-ubah-pin" aria-label="Tutup">✕</button>
        </div>
        <div class="form-group">
          <label>PIN Lama</label>
          <input type="password" inputmode="numeric" maxlength="4" id="pin-lama" placeholder="4 digit">
        </div>
        <div class="form-group">
          <label>PIN Baru</label>
          <input type="password" inputmode="numeric" maxlength="4" id="pin-baru" placeholder="4 digit">
        </div>
        <div class="form-group">
          <label>Konfirmasi PIN Baru</label>
          <input type="password" inputmode="numeric" maxlength="4" id="pin-konfirmasi" placeholder="4 digit">
        </div>
        <div id="ubah-pin-error" class="form-error hidden"></div>
        <button class="btn btn-primary" id="btn-konfirmasi-ubah-pin">Simpan PIN Baru</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('btn-close-ubah-pin')?.addEventListener('click', () => {
    document.getElementById('modal-ubah-pin')?.remove();
  });

  document.getElementById('btn-konfirmasi-ubah-pin')?.addEventListener('click', () => {
    const lama = document.getElementById('pin-lama')?.value;
    const baru = document.getElementById('pin-baru')?.value;
    const konfirmasi = document.getElementById('pin-konfirmasi')?.value;
    const pinTersimpan = localStorage.getItem('ribath_pin') || '1234';
    const errEl = document.getElementById('ubah-pin-error');

    if (lama !== pinTersimpan) {
      if (errEl) { errEl.textContent = 'PIN lama salah'; errEl.classList.remove('hidden'); }
      return;
    }
    if (!/^\d{4}$/.test(baru)) {
      if (errEl) { errEl.textContent = 'PIN baru harus 4 digit angka'; errEl.classList.remove('hidden'); }
      return;
    }
    if (baru !== konfirmasi) {
      if (errEl) { errEl.textContent = 'Konfirmasi PIN tidak cocok'; errEl.classList.remove('hidden'); }
      return;
    }
    localStorage.setItem('ribath_pin', baru);
    document.getElementById('modal-ubah-pin')?.remove();
    showToast('PIN berhasil diubah', 'success');
  });
}

// ══════════════════════════════════════════════════════════════
// NAVIGASI
// ══════════════════════════════════════════════════════════════

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tabName}"]`)?.classList.add('active');
  state.activeTab = tabName;

  switch (tabName) {
    case 'dashboard':
      if (!state.dashboardData) initDashboard();
      break;
    case 'feed':
      initFeed();
      break;
    case 'santri':
      initDaftarSantri();
      break;
    case 'laporan':
      initLaporan();
      break;
  }
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function closeBottomSheet(sheetName) {
  document.getElementById(`bs-${sheetName}`)?.classList.remove('active');
  document.getElementById(`bs-${sheetName}-overlay`)?.classList.remove('active');
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

async function initDashboard() {
  // Update tanggal di header
  const headerDate = document.getElementById('header-date');
  if (headerDate) headerDate.textContent = Engine.formatTanggal(Engine.getTanggalHariIni());

  showSkeleton('kartu-absensi');
  showSkeleton('kartu-catatan');
  showSkeleton('kartu-metrik');
  showSkeleton('kartu-tindakan');

  try {
    const data = await API.getDashboard();
    state.dashboardData = data;

    renderKartuAbsensi(data);
    renderKartuCatatan(data);
    renderKartuMetrik(data);
    renderKartuPerluTindakan(data);
    renderKartuSpp(data);

    const jumlahTindakan = (data.perlu_tindakan?.alpha_2x_berturut?.length || 0) +
                           (data.perlu_tindakan?.spp_tunggak_2bln?.length || 0);
    updateNotifBadge(jumlahTindakan);

    if (state.santriList.length > 0) renderGrafikKehadiran();
  } catch (err) {
    document.getElementById('kartu-absensi').innerHTML = `<p class="text-muted text-sm">Gagal memuat data: ${err.message}</p>`;
  }
}

function renderKartuAbsensi(data) {
  const el = document.getElementById('kartu-absensi');
  if (!el) return;
  const abs = data.absensi_hari_ini;
  const total = abs.sudah_diisi + abs.belum_diisi;
  const persen = total > 0 ? Math.round((abs.hadir / total) * 100) : 0;
  const warna = Engine.getWarnaKehadiran(persen);

  if (abs.belum_diisi > 0) {
    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">📋 Absensi Hari Ini</span>
        <span class="card-badge">${abs.belum_diisi} belum</span>
      </div>
      <p class="text-muted text-sm mb-2">${abs.belum_diisi} santri belum diisi absensinya</p>
      <button class="btn btn-primary" id="btn-isi-absensi-dashboard">Isi Absensi Sekarang</button>`;
    document.getElementById('btn-isi-absensi-dashboard')?.addEventListener('click', openBottomSheetAbsensi);
  } else {
    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">📋 Absensi Hari Ini</span>
        <span class="card-badge" style="background:var(--success)">Selesai</span>
      </div>
      <div class="metric-row" style="grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
        <div class="metric-card"><div class="metric-number">${abs.hadir}</div><div class="metric-label">Hadir</div></div>
        <div class="metric-card warning"><div class="metric-number">${abs.izin}</div><div class="metric-label">Izin</div></div>
        <div class="metric-card danger"><div class="metric-number">${abs.alpha}</div><div class="metric-label">Alpha</div></div>
        <div class="metric-card"><div class="metric-number">${total}</div><div class="metric-label">Total</div></div>
      </div>
      <div class="progress-wrap"><div class="progress-fill ${warna}" style="width:${persen}%"></div></div>
      <div class="flex-between mt-1">
        <span class="text-sm text-muted">${persen}% hadir</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" id="btn-edit-absensi">Edit</button>
          ${abs.alpha > 0 ? `<button class="btn btn-danger btn-sm" id="btn-kirim-notif-alpha">Notif Alpha</button>` : ''}
        </div>
      </div>`;
    document.getElementById('btn-edit-absensi')?.addEventListener('click', openBottomSheetAbsensi);
    document.getElementById('btn-kirim-notif-alpha')?.addEventListener('click', () => {
      const alphaList = state.santriList.filter(s => {
        // Filter berdasarkan data yang ada di dashboard
        return data.perlu_tindakan?.alpha_2x_berturut?.some(a => a.santri_id === s.santri_id);
      });
      kirimNotifAlpha(alphaList);
    });
  }
}

function renderKartuCatatan(data) {
  const el = document.getElementById('kartu-catatan');
  if (!el) return;
  const cat = data.catatan_hari_ini;

  if (cat.belum_dicatat > 0) {
    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">📝 Catatan Belajar</span>
        <span class="card-badge">${cat.belum_dicatat} belum</span>
      </div>
      <p class="text-muted text-sm mb-2">${cat.sudah_dicatat} dari ${cat.sudah_dicatat + cat.belum_dicatat} santri sudah dicatat</p>
      <button class="btn btn-secondary" id="btn-lanjut-catat">Lanjut Catat</button>`;
    document.getElementById('btn-lanjut-catat')?.addEventListener('click', () => openFormCatatan());
  } else {
    const total = cat.sudah_dicatat;
    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">📝 Catatan Belajar</span>
        <span class="card-badge" style="background:var(--success)">Selesai</span>
      </div>
      <p class="text-sm" style="color:var(--success)">✅ ${total}/${total} santri sudah dicatat hari ini</p>
      <button class="btn btn-outline btn-sm mt-2" id="btn-rekap-catatan">Lihat Rekap Hari Ini</button>`;
    document.getElementById('btn-rekap-catatan')?.addEventListener('click', () => {
      switchTab('feed');
    });
  }
}

function renderKartuMetrik(data) {
  const el = document.getElementById('kartu-metrik');
  if (!el) return;
  const perluWA = (data.perlu_tindakan?.alpha_2x_berturut?.length || 0) +
                  (data.perlu_tindakan?.spp_tunggak_2bln?.length || 0);
  const warnaWA = perluWA > 0 ? 'danger' : 'success';
  const pemasukan = Engine.formatRupiah(data.spp_bulan_ini?.total_nominal || 0);

  el.innerHTML = `
    <div class="metric-row">
      <div class="metric-card" onclick="window.switchTab('santri')">
        <div class="metric-number">${data.total_santri_aktif || 0}</div>
        <div class="metric-label">Santri Aktif</div>
      </div>
      <div class="metric-card">
        <div class="metric-number" style="font-size:1rem">${pemasukan}</div>
        <div class="metric-label">Masuk Bulan Ini</div>
      </div>
      <div class="metric-card ${warnaWA}" onclick="window.openNotifPanel()">
        <div class="metric-number">${perluWA}</div>
        <div class="metric-label">Perlu WA</div>
      </div>
    </div>`;
}

function renderKartuPerluTindakan(data) {
  const el = document.getElementById('kartu-tindakan');
  if (!el) return;
  const alpha = data.perlu_tindakan?.alpha_2x_berturut || [];
  const tunggak = data.perlu_tindakan?.spp_tunggak_2bln || [];

  if (alpha.length === 0 && tunggak.length === 0) {
    el.innerHTML = `
      <div class="card-header"><span class="card-title">⚠️ Perlu Tindakan</span></div>
      <p class="text-sm text-muted">✅ Tidak ada tindakan yang perlu dilakukan</p>`;
    return;
  }

  let html = `<div class="card-header"><span class="card-title">⚠️ Perlu Tindakan</span></div>`;

  if (alpha.length > 0) {
    html += `<div class="notif-section-title">Alpha 2x Berturut</div>`;
    alpha.forEach(s => {
      html += `
        <div class="list-item" style="padding:10px 0">
          <div class="avatar avatar-a">${inisial(s.nama)}</div>
          <div class="list-item-content">
            <div class="list-item-name">${s.nama}</div>
            <div class="list-item-sub">Ortu: ${s.nama_ortu}</div>
            <div class="list-item-actions">
              <button class="btn btn-wa btn-sm" onclick="window._kirimWaAlpha('${s.santri_id}')">💬 WA Ortu</button>
            </div>
          </div>
        </div>`;
    });
    window._kirimWaAlpha = (id) => {
      const s = state.santriList.find(x => x.santri_id === id) ||
                alpha.find(x => x.santri_id === id);
      if (!s) return;
      const tgl1 = Engine.formatTanggalPendek(Engine.getTanggalHariIni());
      const pesan = Engine.buildPesanAlpha2x(s.nama, s.nama_ortu, tgl1, '(kemarin)');
      window.open(`https://wa.me/${s.no_hp_ortu}?text=${encodeURIComponent(pesan)}`);
    };
  }

  if (tunggak.length > 0) {
    html += `<div class="notif-section-title">Tunggak SPP 2 Bulan</div>`;
    tunggak.forEach(s => {
      const bulanStr = (s.bulan_tunggak || []).join(', ');
      html += `
        <div class="list-item" style="padding:10px 0">
          <div class="avatar avatar-b">${inisial(s.nama)}</div>
          <div class="list-item-content">
            <div class="list-item-name">${s.nama}</div>
            <div class="list-item-sub">Tunggak: ${bulanStr}</div>
            <div class="list-item-actions">
              <button class="btn btn-wa btn-sm" onclick="window._kirimWaTunggak('${s.santri_id}')">💬 WA Ortu</button>
              <button class="btn btn-accent btn-sm" onclick="window.openModalSpp('${s.santri_id}')">Input SPP</button>
            </div>
          </div>
        </div>`;
    });
    window._kirimWaTunggak = (id) => {
      const s = state.santriList.find(x => x.santri_id === id) ||
                tunggak.find(x => x.santri_id === id);
      if (!s) return;
      const [b1, b2] = (s.bulan_tunggak || ['', '']);
      const pesan = Engine.buildPesanSppTunggak(s.nama, s.nama_ortu, b1 || '-', b2 || '-');
      window.open(`https://wa.me/${s.no_hp_ortu}?text=${encodeURIComponent(pesan)}`);
    };
  }

  el.innerHTML = html;
}

function renderKartuSpp(data) {
  const el = document.getElementById('kartu-spp');
  if (!el) return;
  const spp = data.spp_bulan_ini;
  const bulan = spp?.bulan || Engine.getBulanSekarangLabel();

  el.innerHTML = `
    <div class="card-header">
      <span class="card-title">💰 SPP ${bulan}</span>
      <span class="card-badge">${spp?.belum || 0} belum</span>
    </div>
    <div class="metric-row" style="margin-bottom:10px">
      <div class="metric-card success"><div class="metric-number">${spp?.lunas || 0}</div><div class="metric-label">Lunas</div></div>
      <div class="metric-card danger"><div class="metric-number">${spp?.belum || 0}</div><div class="metric-label">Belum</div></div>
      <div class="metric-card"><div class="metric-number" style="font-size:0.9rem">${Engine.formatRupiah(spp?.total_nominal || 0)}</div><div class="metric-label">Total</div></div>
    </div>
    <button class="btn btn-outline btn-sm" id="btn-input-spp-dashboard">+ Input SPP</button>`;
  document.getElementById('btn-input-spp-dashboard')?.addEventListener('click', () => openModalSpp());
}

async function renderGrafikKehadiran() {
  const el = document.getElementById('kartu-grafik');
  if (!el || state.santriList.length === 0) return;

  try {
    const results = await Promise.all(
      state.santriList.map(s =>
        API.getAbsensiRekap(s.santri_id, Engine.getBulanSekarang()).catch(() => null)
      )
    );
    const valid = results.filter(r => r !== null);
    if (valid.length === 0) return;

    const maxPersen = 100;
    const bars = valid.map(r => {
      const persen = r.persen_hadir || 0;
      const warna = Engine.getWarnaKehadiran(persen);
      const tinggi = Math.max(4, Math.round((persen / maxPersen) * 60));
      return `<div class="grafik-bar ${warna}" style="height:${tinggi}px" title="${r.nama}: ${persen}%"></div>`;
    }).join('');

    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">📊 Kehadiran Bulan Ini</span>
        <span class="text-sm text-muted">${Engine.getBulanSekarangLabel()}</span>
      </div>
      <div class="grafik-bar-wrap">${bars}</div>
      <div class="text-sm text-muted mt-1">Rata-rata: ${Math.round(valid.reduce((a, r) => a + (r.persen_hadir || 0), 0) / valid.length)}%</div>`;
  } catch {
    // Abaikan error grafik
  }
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ══════════════════════════════════════════════════════════════
// BOTTOM SHEET ABSENSI
// ══════════════════════════════════════════════════════════════

function openBottomSheetAbsensi() {
  document.getElementById('bs-absensi')?.classList.add('active');
  document.getElementById('bs-absensi-overlay')?.classList.add('active');
  renderListAbsensi();
}

function renderListAbsensi() {
  const container = document.getElementById('bs-absensi-list');
  if (!container) return;

  const html = state.santriList.map(s => `
    <div class="list-item absensi-row" data-santri-id="${s.santri_id}">
      <div class="avatar avatar-a">${inisial(s.nama)}</div>
      <div class="list-item-content">
        <div class="list-item-name">${s.nama}</div>
        <div class="chips" style="margin:6px 0 0">
          <button class="chip absensi-chip" data-santri="${s.santri_id}" data-status="hadir">✅ Hadir</button>
          <button class="chip absensi-chip" data-santri="${s.santri_id}" data-status="izin">🟡 Izin</button>
          <button class="chip absensi-chip" data-santri="${s.santri_id}" data-status="alpha">❌ Alpha</button>
        </div>
      </div>
    </div>`).join('');

  container.innerHTML = html;

  // Pasang event listener chip absensi
  container.querySelectorAll('.absensi-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const santriId = chip.dataset.santri;
      const status = chip.dataset.status;
      // Reset semua chip di baris ini
      container.querySelectorAll(`.absensi-chip[data-santri="${santriId}"]`).forEach(c => {
        c.className = 'chip absensi-chip';
      });
      chip.classList.add(`active-${status}`);
      // Tandai row sudah diisi
      const row = container.querySelector(`.absensi-row[data-santri-id="${santriId}"]`);
      row?.classList.add('absensi-row-done');
      updateAbsensiCounter();
    });
  });

  updateAbsensiCounter();
}

function updateAbsensiCounter() {
  const total = state.santriList.length;
  const sudahDipilih = document.querySelectorAll(
    '.absensi-chip.active-hadir, .absensi-chip.active-izin, .absensi-chip.active-alpha'
  ).length;
  const belum = total - sudahDipilih;

  const infoEl = document.getElementById('bs-absensi-info');
  if (infoEl) {
    infoEl.textContent = belum > 0
      ? `${belum} santri belum dipilih statusnya`
      : `✅ Semua ${total} santri sudah diisi`;
    infoEl.style.color = belum > 0 ? 'var(--warning)' : 'var(--success)';
  }

  const btnSimpan = document.getElementById('btn-simpan-absensi');
  if (btnSimpan) {
    btnSimpan.disabled = belum > 0;
    btnSimpan.style.opacity = belum > 0 ? '0.5' : '1';
  }
}

function handleSemuaHadir() {
  document.querySelectorAll('.absensi-chip').forEach(chip => {
    chip.className = 'chip absensi-chip';
    if (chip.dataset.status === 'hadir') {
      chip.classList.add('active-hadir');
    }
  });
  document.querySelectorAll('.absensi-row').forEach(row => row.classList.add('absensi-row-done'));
  updateAbsensiCounter();
}

async function simpanAbsensi() {
  const chips = document.querySelectorAll('.absensi-chip.active-hadir, .absensi-chip.active-izin, .absensi-chip.active-alpha');
  const statusMap = {};
  chips.forEach(chip => {
    statusMap[chip.dataset.santri] = chip.dataset.status;
  });

  const entries = Object.entries(statusMap);
  if (entries.length === 0) { showToast('Pilih status absensi terlebih dahulu', 'warning'); return; }

  showLoading('btn-simpan-absensi', 'Menyimpan...');
  const alphaList = [];

  for (const [santriId, status] of entries) {
    const nilai = { status, waktu: new Date().toTimeString().slice(0, 5) };
    try {
      await API.saveAktivitas(santriId, 'ABS', nilai);
      if (status === 'alpha') {
        const s = state.santriList.find(x => x.santri_id === santriId);
        if (s) alphaList.push(s);
      }
    } catch (err) {
      showToast(`Gagal simpan absensi: ${err.message}`, 'error');
    }
  }

  hideLoading('btn-simpan-absensi', 'Simpan Absensi');
  closeBottomSheet('absensi');
  showToast('Absensi berhasil disimpan ✅', 'success');
  await initDashboard();

  if (alphaList.length > 0) {
    setTimeout(() => kirimNotifAlpha(alphaList), 800);
  }
}

async function kirimNotifAlpha(santriAlphaList) {
  for (const s of santriAlphaList) {
    const tgl = Engine.formatTanggal(Engine.getTanggalHariIni());
    const pesan = Engine.buildPesanAbsenAlpha(s.nama, s.nama_ortu, tgl);
    window.open(`https://wa.me/${s.no_hp_ortu}?text=${encodeURIComponent(pesan)}`);
    await sleep(1500);
  }
}

// ══════════════════════════════════════════════════════════════
// FORM CATATAN BELAJAR
// ══════════════════════════════════════════════════════════════

async function openFormCatatan(santriId = null) {
  document.getElementById('modal-catatan')?.classList.add('active');

  // Tentukan urutan santri yang belum dicatat
  state.catatanSantriUrutan = state.santriList.filter(s => !state.sudahDicatatHariIni.has(s.santri_id));
  if (state.catatanSantriUrutan.length === 0) {
    state.catatanSantriUrutan = [...state.santriList];
  }

  let targetId = santriId || state.catatanSantriUrutan[0]?.santri_id;
  const idx = state.catatanSantriUrutan.findIndex(s => s.santri_id === targetId);
  state.catatanSantriIndex = idx >= 0 ? idx : 0;

  await loadFormCatatanUntuk(state.catatanSantriUrutan[state.catatanSantriIndex]?.santri_id);
}

async function loadFormCatatanUntuk(santriId) {
  if (!santriId) return;
  state.selectedSantriId = santriId;
  const santri = state.santriList.find(s => s.santri_id === santriId);
  if (!santri) return;

  // Update label
  const labelEl = document.getElementById('catatan-santri-label');
  if (labelEl) labelEl.textContent = santri.nama;
  const progEl = document.getElementById('catatan-progress-label');
  if (progEl) progEl.textContent = `${state.catatanSantriIndex + 1} / ${state.catatanSantriUrutan.length}`;

  // Tampilkan skeleton
  showSkeleton('catatan-form-area');

  try {
    let lastData = null;
    const program = santri.program || 'IQRA';

    if (program === 'THF') {
      lastData = await API.getLastHafalan(santriId).catch(() => null);
    }

    const infoEl = document.getElementById('catatan-info-terakhir');
    if (infoEl && lastData) {
      infoEl.textContent = `Terakhir: ${lastData.surah_terakhir || '-'} ayat ${lastData.ayat_end_terakhir || '-'}`;
    }

    await renderFormPerProgram(program, lastData, santriId);
  } catch (err) {
    const area = document.getElementById('catatan-form-area');
    if (area) area.innerHTML = `<p class="text-muted">Gagal memuat form: ${err.message}</p>`;
  }
}

async function renderFormPerProgram(program, lastData, santriId) {
  const area = document.getElementById('catatan-form-area');
  if (!area) return;

  let html = '';
  switch (program) {
    case 'IQRA': {
      html = `
        <div class="form-group">
          <label>Jilid</label>
          <select id="iqra-jilid">
            ${[1,2,3,4,5,6].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Halaman</label>
          <input type="number" id="iqra-halaman" min="1" max="100" value="1" placeholder="Halaman ke-...">
        </div>
        <div class="form-group">
          <label>Kualitas Bacaan</label>
          <div class="chips">
            <button class="chip kualitas-chip active-primary" data-val="lancar">Lancar</button>
            <button class="chip kualitas-chip" data-val="perlu_ulang">Perlu Ulang</button>
          </div>
        </div>`;
      break;
    }
    case 'THS': {
      html = `
        <div class="form-group">
          <label>Materi Tahsin</label>
          <input type="text" id="ths-materi" placeholder="Contoh: Mad Thabi'i">
        </div>
        <div class="form-group">
          <label>Nilai</label>
          <div class="chips">
            <button class="chip nilai-chip active-primary" data-val="A">A</button>
            <button class="chip nilai-chip" data-val="B">B</button>
            <button class="chip nilai-chip" data-val="C">C</button>
          </div>
        </div>`;
      break;
    }
    case 'THF': {
      const next = Engine.getNextHafalan(lastData);
      html = `
        <div class="form-group">
          <label>Tipe</label>
          <div class="chips">
            <button class="chip tipe-chip active-primary" data-val="baru">Hafalan Baru</button>
            <button class="chip tipe-chip" data-val="murajaah">Murajaah</button>
          </div>
        </div>
        <div class="form-group">
          <label>Surah</label>
          <select id="thf-surah">
            ${Engine.JUZ30.map(s => `<option value="${s.surah}" ${s.surah === next.surah ? 'selected' : ''}>${s.surah}</option>`).join('')}
          </select>
        </div>
        <div class="btn-row">
          <div class="form-group">
            <label>Ayat Mulai</label>
            <input type="number" id="thf-ayat-start" value="${next.ayat_start}" min="1">
          </div>
          <div class="form-group">
            <label>Ayat Akhir</label>
            <input type="number" id="thf-ayat-end" value="${next.ayat_end_suggest}" min="1">
          </div>
        </div>`;
      break;
    }
    case 'QRN': {
      html = `
        <div class="form-group">
          <label>Halaman</label>
          <input type="number" id="qrn-halaman" min="1" max="604" value="1">
        </div>
        <div class="form-group">
          <label>Irama</label>
          <div class="chips">
            <button class="chip irama-chip active-primary" data-val="Bayati">Bayati</button>
            <button class="chip irama-chip" data-val="Hijaz">Hijaz</button>
            <button class="chip irama-chip" data-val="Nahawand">Nahawand</button>
          </div>
        </div>
        <div class="form-group">
          <label>Kualitas</label>
          <div class="chips">
            <button class="chip kualitas-chip active-primary" data-val="baik">Baik</button>
            <button class="chip kualitas-chip" data-val="perlu_perbaikan">Perlu Perbaikan</button>
          </div>
        </div>`;
      break;
    }
    case 'TRB': {
      html = `
        <div class="form-group">
          <label>Materi Tarbiyah</label>
          <input type="text" id="trb-materi" placeholder="Nama materi...">
        </div>
        <div class="form-group">
          <label>Kehadiran</label>
          <div class="chips">
            <button class="chip hadir-chip active-primary" data-val="true">Hadir</button>
            <button class="chip hadir-chip" data-val="false">Tidak Hadir</button>
          </div>
        </div>`;
      break;
    }
    default:
      html = `<p class="text-muted">Program tidak dikenali: ${program}</p>`;
  }

  html += `
    <div class="form-group">
      <label>Catatan (opsional)</label>
      <textarea id="catatan-tambahan" placeholder="Catatan ustadz..."></textarea>
    </div>`;

  area.innerHTML = html;

  // Pasang event listener chip
  area.querySelectorAll('.chip[data-val]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const group = chip.className.split(' ').find(c => c.endsWith('-chip') && c !== 'chip');
      if (!group) return;
      area.querySelectorAll(`.${group}`).forEach(c => c.className = 'chip ' + group);
      chip.classList.add('active-primary');
    });
  });
}

function kumpulkanNilaiCatatan() {
  const santri = state.santriList.find(s => s.santri_id === state.selectedSantriId);
  const program = santri?.program || 'IQRA';

  const getChip = (className) => {
    const el = document.querySelector(`.${className}.active-primary`);
    return el?.dataset.val || null;
  };

  let jenis, nilai;
  switch (program) {
    case 'IQRA':
      jenis = 'IQRA';
      nilai = {
        jilid: parseInt(document.getElementById('iqra-jilid')?.value || 1),
        halaman: parseInt(document.getElementById('iqra-halaman')?.value || 1),
        kualitas: getChip('kualitas-chip') || 'lancar'
      };
      break;
    case 'THS':
      jenis = 'THS';
      nilai = {
        materi: document.getElementById('ths-materi')?.value || '',
        nilai: getChip('nilai-chip') || 'A'
      };
      break;
    case 'THF':
      jenis = 'THF';
      nilai = {
        surah: document.getElementById('thf-surah')?.value || 'An-Naba',
        ayat_start: parseInt(document.getElementById('thf-ayat-start')?.value || 1),
        ayat_end: parseInt(document.getElementById('thf-ayat-end')?.value || 5),
        tipe: getChip('tipe-chip') || 'baru'
      };
      break;
    case 'QRN':
      jenis = 'QRN';
      nilai = {
        halaman: parseInt(document.getElementById('qrn-halaman')?.value || 1),
        irama: getChip('irama-chip') || 'Bayati',
        kualitas: getChip('kualitas-chip') || 'baik'
      };
      break;
    case 'TRB':
      jenis = 'TRB';
      nilai = {
        materi: document.getElementById('trb-materi')?.value || '',
        hadir: getChip('hadir-chip') === 'true'
      };
      break;
    default:
      return null;
  }

  const catatan = document.getElementById('catatan-tambahan')?.value || '';
  return { jenis, nilai, catatan };
}

async function simpanCatatan() {
  const result = kumpulkanNilaiCatatan();
  if (!result) return;
  const { jenis, nilai, catatan } = result;

  const validasi = Engine.validateNilaiAktivitas(jenis, nilai);
  if (!validasi.valid) {
    showToast(validasi.error, 'error');
    document.getElementById('catatan-form-area')?.classList.add('shake');
    setTimeout(() => document.getElementById('catatan-form-area')?.classList.remove('shake'), 500);
    return;
  }

  showLoading('btn-simpan-catatan', 'Menyimpan...');
  try {
    await API.saveAktivitas(state.selectedSantriId, jenis, nilai, catatan);
    state.sudahDicatatHariIni.add(state.selectedSantriId);
    showToast('Catatan tersimpan ✅', 'success');
    navigasiSantriBerikutnya();
  } catch (err) {
    showToast(`Gagal menyimpan: ${err.message}`, 'error');
  } finally {
    hideLoading('btn-simpan-catatan', 'Simpan Catatan');
  }
}

function navigasiSantri(arah) {
  const next = state.catatanSantriIndex + arah;
  if (next < 0 || next >= state.catatanSantriUrutan.length) return;
  state.catatanSantriIndex = next;
  loadFormCatatanUntuk(state.catatanSantriUrutan[state.catatanSantriIndex]?.santri_id);
}

function navigasiSantriBerikutnya() {
  const remaining = state.catatanSantriUrutan.filter(s => !state.sudahDicatatHariIni.has(s.santri_id));
  if (remaining.length > 0) {
    const nextIdx = state.catatanSantriUrutan.findIndex(s => s.santri_id === remaining[0].santri_id);
    state.catatanSantriIndex = nextIdx;
    loadFormCatatanUntuk(remaining[0].santri_id);
  } else {
    const area = document.getElementById('catatan-form-area');
    if (area) area.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">Semua catatan selesai hari ini!</div>
      </div>
      <button class="btn btn-primary mt-2" id="btn-selesai-catatan">Kembali ke Dashboard</button>`;
    document.getElementById('btn-selesai-catatan')?.addEventListener('click', () => {
      closeModal('modal-catatan');
      initDashboard();
    });
  }
}

function skipCatatan() {
  navigasiSantriBerikutnya();
}

// ══════════════════════════════════════════════════════════════
// MODAL SPP
// ══════════════════════════════════════════════════════════════

function openModalSpp(santriId = null) {
  document.getElementById('modal-spp')?.classList.add('active');

  renderSantriOptions('spp-santri-select', state.santriList, santriId);

  const bulanSelect = document.getElementById('spp-bulan-select');
  if (bulanSelect) {
    const bulanList = Engine.getBulanList(6);
    bulanSelect.innerHTML = bulanList.map(b =>
      `<option value="${b}" ${b === Engine.getBulanSekarang() ? 'selected' : ''}>${Engine.bulanParamToLabel(b)}</option>`
    ).join('');
  }

  const nominalEl = document.getElementById('spp-nominal');
  if (nominalEl) nominalEl.value = '100000';

  // Pasang chip status SPP
  document.querySelectorAll('.spp-status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.spp-status-chip').forEach(c => c.className = 'chip spp-status-chip');
      chip.classList.add('active-primary');
    });
  });
}

async function simpanSpp() {
  const santriId = document.getElementById('spp-santri-select')?.value;
  const bulanParam = document.getElementById('spp-bulan-select')?.value;
  const nominal = parseInt(document.getElementById('spp-nominal')?.value || 0);
  const metode = document.getElementById('spp-metode')?.value || 'tunai';
  const keterangan = document.getElementById('spp-keterangan')?.value || '';
  const statusChip = document.querySelector('.spp-status-chip.active-primary');
  const status = statusChip?.dataset.val || 'lunas';

  if (!santriId) { showToast('Pilih santri terlebih dahulu', 'warning'); return; }
  if (status === 'belum') { showToast('Status tidak valid untuk disimpan', 'error'); return; }
  if (!nominal || nominal <= 0) { showToast('Nominal harus lebih dari 0', 'warning'); return; }

  const bulanLabel = Engine.bulanParamToLabel(bulanParam);
  const nilai = { nominal, status, metode, bulan: bulanLabel, keterangan };

  const validasi = Engine.validateNilaiAktivitas('SPP', nilai);
  if (!validasi.valid) { showToast(validasi.error, 'error'); return; }

  showLoading('btn-simpan-spp', 'Menyimpan...');
  try {
    await API.saveAktivitas(santriId, 'SPP', nilai);
    closeModal('modal-spp');
    showToast('SPP berhasil disimpan ✅', 'success');
    await initDashboard();

    // Tawarkan kirim konfirmasi WA
    const santri = state.santriList.find(s => s.santri_id === santriId);
    if (santri) {
      const pesan = Engine.buildPesanKonfirmasiSpp(santri.nama, santri.nama_ortu, bulanLabel, nominal, status);
      setTimeout(() => {
        if (confirm(`Kirim konfirmasi SPP ke ${santri.nama_ortu} via WhatsApp?`)) {
          window.open(`https://wa.me/${santri.no_hp_ortu}?text=${encodeURIComponent(pesan)}`);
        }
      }, 500);
    }
  } catch (err) {
    showToast(`Gagal simpan SPP: ${err.message}`, 'error');
  } finally {
    hideLoading('btn-simpan-spp', 'Simpan SPP');
  }
}

// ══════════════════════════════════════════════════════════════
// PANEL NOTIFIKASI
// ══════════════════════════════════════════════════════════════

function openNotifPanel() {
  document.getElementById('notif-panel')?.classList.add('active');
  document.getElementById('notif-overlay')?.classList.add('active');
  renderNotifContent();
}

function closeNotifPanel() {
  document.getElementById('notif-panel')?.classList.remove('active');
  document.getElementById('notif-overlay')?.classList.remove('active');
}

function renderNotifContent() {
  const el = document.getElementById('notif-content');
  if (!el || !state.dashboardData) return;

  const data = state.dashboardData;
  const abs = data.absensi_hari_ini;
  const cat = data.catatan_hari_ini;
  const alpha = data.perlu_tindakan?.alpha_2x_berturut || [];
  const tunggak = data.perlu_tindakan?.spp_tunggak_2bln || [];

  let html = '';

  // Section Hari Ini
  html += `<div class="notif-section-title">Hari Ini</div>`;
  if (abs.belum_diisi > 0) {
    html += `<div class="notif-item"><div class="notif-dot"></div><div class="notif-text">${abs.belum_diisi} santri belum diisi absensinya</div></div>`;
  } else {
    html += `<div class="notif-item done"><div class="notif-dot done"></div><div class="notif-text">Absensi sudah lengkap ✅</div></div>`;
  }
  if (cat.belum_dicatat > 0) {
    html += `<div class="notif-item"><div class="notif-dot"></div><div class="notif-text">${cat.belum_dicatat} santri belum dicatat catatannya</div></div>`;
  } else {
    html += `<div class="notif-item done"><div class="notif-dot done"></div><div class="notif-text">Catatan belajar sudah lengkap ✅</div></div>`;
  }

  // Section Perlu Tindakan
  if (alpha.length > 0 || tunggak.length > 0) {
    html += `<div class="notif-section-title">Perlu Tindakan</div>`;
    alpha.forEach(s => {
      html += `<div class="notif-item"><div class="notif-dot"></div><div class="notif-text"><span class="notif-name">${s.nama}</span> alpha 2x berturut — <button class="btn btn-wa btn-sm" onclick="window._kirimWaAlpha('${s.santri_id}')">WA Ortu</button></div></div>`;
    });
    tunggak.forEach(s => {
      html += `<div class="notif-item"><div class="notif-dot"></div><div class="notif-text"><span class="notif-name">${s.nama}</span> tunggak SPP — <button class="btn btn-wa btn-sm" onclick="window._kirimWaTunggak('${s.santri_id}')">WA Ortu</button></div></div>`;
    });
  }

  // Tombol Ubah PIN
  html += `
    <div class="notif-section-title">Pengaturan</div>
    <button class="ubah-pin-btn" id="btn-ubah-pin-notif">⚙️ Ubah PIN</button>`;

  el.innerHTML = html;
  document.getElementById('btn-ubah-pin-notif')?.addEventListener('click', () => {
    closeNotifPanel();
    openUbahPin();
  });
}

// ══════════════════════════════════════════════════════════════
// TAB FEED
// ══════════════════════════════════════════════════════════════

async function initFeed(santriId = null) {
  const container = document.getElementById('feed-list');
  if (!container) return;
  showSkeleton('feed-list');

  try {
    const items = await API.getFeed(30, santriId);
    const list = Array.isArray(items) ? items : (items.data || items.feed || []);

    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Belum ada aktivitas</div></div>`;
      return;
    }
    container.innerHTML = list.map(renderFeedItem).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-muted text-sm">Gagal memuat feed: ${err.message}</p>`;
  }
}

function renderFeedItem(aktivitas) {
  const teks = aktivitas.teks_human || Engine.renderTeksHuman(aktivitas);
  const waktu = waktuRelatif(aktivitas.tanggal);
  const nama = aktivitas.nama_santri || 'Santri';

  return `
    <div class="feed-item">
      <div class="feed-item-header">
        <div class="avatar avatar-a">${inisial(nama)}</div>
        <div class="feed-item-meta">
          <div class="feed-item-name">${nama}</div>
          <div class="feed-item-time">${waktu}</div>
        </div>
      </div>
      <div class="feed-item-text">${teks}</div>
      <span class="feed-item-jenis jenis-${aktivitas.jenis}">${labelJenis(aktivitas.jenis)}</span>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// TAB SANTRI
// ══════════════════════════════════════════════════════════════

function initDaftarSantri() {
  renderDaftarSantri(state.santriList);

  // Filter chip
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active-primary'));
      chip.classList.add('active-primary');
      const filter = chip.dataset.filter;
      const filtered = filter === 'semua' ? state.santriList :
        state.santriList.filter(s => s.kelompok === filter || s.level === filter);
      renderDaftarSantri(filtered);
    });
  });
}

function renderDaftarSantri(list) {
  const container = document.getElementById('santri-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Tidak ada santri ditemukan</div></div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="list-item">
      <div class="avatar avatar-a">${inisial(s.nama)}</div>
      <div class="list-item-content">
        <div class="list-item-name">${s.nama}</div>
        <div class="list-item-sub">Kel. ${s.kelompok} · ${s.program} · ${s.level}</div>
        <div class="list-item-actions">
          <button class="btn btn-outline btn-sm" onclick="window.openProfilSantri('${s.santri_id}')">Profil</button>
          <button class="btn btn-secondary btn-sm" onclick="window.openFormCatatan('${s.santri_id}')">Catat</button>
          <button class="btn btn-accent btn-sm" onclick="window.openModalSpp('${s.santri_id}')">SPP</button>
        </div>
      </div>
    </div>`).join('');
}

function handleSearchSantri() {
  const q = document.getElementById('search-santri')?.value.toLowerCase() || '';
  const filtered = state.santriList.filter(s => s.nama.toLowerCase().includes(q));
  renderDaftarSantri(filtered);
}

async function openProfilSantri(santriId) {
  document.getElementById('modal-profil')?.classList.add('active');
  state.selectedSantriId = santriId;
  showSkeleton('profil-content');

  const santri = state.santriList.find(s => s.santri_id === santriId);
  if (!santri) return;

  try {
    const [progress, history, absensi, sppData] = await Promise.all([
      API.getProgressJuz30(santriId).catch(() => null),
      API.getHafalanHistory(santriId, 5).catch(() => []),
      API.getAbsensiRekap(santriId, Engine.getBulanSekarang()).catch(() => null),
      API.getSppBulan(Engine.getBulanSekarang()).catch(() => [])
    ]);

    const sppSantri = (Array.isArray(sppData) ? sppData : (sppData.data || [])).find(x => x.santri_id === santriId);
    const persenHafal = progress?.persen || 0;
    const warnaHafal = Engine.getWarnaKehadiran(persenHafal);
    const warnaAbsensi = absensi ? Engine.getWarnaKehadiran(absensi.persen_hadir) : 'normal';
    const hist = Array.isArray(history) ? history : (history.data || []);

    const el = document.getElementById('profil-content');
    if (!el) return;

    el.innerHTML = `
      <div id="profil-data-diri">
        <div class="flex-between mb-2">
          <div>
            <div style="font-size:1.1rem;font-weight:700">${santri.nama}</div>
            <div class="text-muted text-sm">ID: ${santri.santri_id} · Kel. ${santri.kelompok}</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-edit-santri">✏️ Edit</button>
        </div>
        <div class="text-sm"><b>Program:</b> ${santri.program} · <b>Level:</b> ${santri.level}</div>
        <div class="text-sm mt-1"><b>Mulai:</b> ${Engine.formatTanggalPendek(santri.tgl_mulai)}</div>
      </div>

      <div class="divider"></div>
      <div class="section-title">Data Orang Tua</div>
      <div class="text-sm mb-1"><b>${santri.nama_ortu}</b></div>
      <a href="https://wa.me/${santri.no_hp_ortu}" target="_blank" class="btn btn-wa btn-sm" style="margin-top:4px">💬 WhatsApp</a>

      <div class="divider"></div>
      <div class="section-title">Progress Hafalan Juz 30</div>
      <div class="flex-between mb-1">
        <span class="text-sm">${progress?.total_ayat_hafal || 0} / ${Engine.TOTAL_AYAT_JUZ30} ayat</span>
        <span class="text-sm font-bold">${Engine.formatPersen(persenHafal)}</span>
      </div>
      <div class="progress-wrap"><div class="progress-fill ${warnaHafal}" style="width:${persenHafal}%"></div></div>
      ${progress?.surah_sedang ? `<div class="text-sm text-muted mt-1">Sedang: ${progress.surah_sedang}</div>` : ''}

      <div class="divider"></div>
      <div class="section-title">Absensi ${Engine.getBulanSekarangLabel()}</div>
      ${absensi ? `
        <div class="metric-row" style="margin-bottom:8px">
          <div class="metric-card success"><div class="metric-number">${absensi.total_hadir}</div><div class="metric-label">Hadir</div></div>
          <div class="metric-card warning"><div class="metric-number">${absensi.total_izin}</div><div class="metric-label">Izin</div></div>
          <div class="metric-card danger"><div class="metric-number">${absensi.total_alpha}</div><div class="metric-label">Alpha</div></div>
        </div>
        <div class="progress-wrap"><div class="progress-fill ${warnaAbsensi}" style="width:${absensi.persen_hadir}%"></div></div>` :
        '<div class="text-muted text-sm">Belum ada data absensi</div>'}

      <div class="divider"></div>
      <div class="section-title">5 Catatan Terakhir</div>
      ${hist.length > 0 ? hist.map(h => {
        const n = typeof h.nilai === 'string' ? JSON.parse(h.nilai) : h.nilai;
        return `<div class="list-item" style="padding:8px 0">
          <span class="feed-item-jenis jenis-${h.jenis}" style="flex-shrink:0">${labelJenis(h.jenis)}</span>
          <span class="text-sm" style="flex:1">${Engine.renderTeksHuman({...h, nama_santri: santri.nama})}</span>
        </div>`;
      }).join('') : '<div class="text-muted text-sm">Belum ada catatan</div>'}

      <div class="divider"></div>
      <div class="section-title">SPP ${Engine.getBulanSekarangLabel()}</div>
      ${sppSantri ? `<span class="badge badge-${sppSantri.status}">${sppSantri.status}</span>
        ${sppSantri.nominal ? ` · ${Engine.formatRupiah(sppSantri.nominal)}` : ''}` :
        '<span class="badge badge-belum">Belum bayar</span>'}

      <div class="divider"></div>
      <div class="btn-row mt-2">
        <button class="btn btn-secondary" onclick="window.openFormCatatan('${santriId}')">📝 Catat Belajar</button>
        <button class="btn btn-accent" onclick="window.openModalSpp('${santriId}')">💰 Input SPP</button>
      </div>
      <button class="btn btn-wa mt-2" onclick="window._waProfilSantri('${santriId}')">💬 Kirim WA Ortu</button>`;

    // Pasang event listener tombol edit
    document.getElementById('btn-edit-santri')?.addEventListener('click', handleEditSantri);

    window._waProfilSantri = (id) => {
      const s = state.santriList.find(x => x.santri_id === id);
      if (!s) return;
      const pesan = `Assalamu'alaikum, ini informasi terkait santri ${s.nama}. Ada yang bisa kami bantu?`;
      window.open(`https://wa.me/${s.no_hp_ortu}?text=${encodeURIComponent(pesan)}`);
    };
  } catch (err) {
    document.getElementById('profil-content').innerHTML = `<p class="text-muted">Gagal memuat profil: ${err.message}</p>`;
  }
}

function openFormTambahSantri() {
  document.getElementById('modal-tambah-santri')?.classList.add('active');
}

async function simpanTambahSantri() {
  const nama = document.getElementById('tambah-nama')?.value.trim() || '';
  const noHp = document.getElementById('tambah-no-hp')?.value.trim() || '';
  const kelompok = document.getElementById('tambah-kelompok')?.value || 'A';
  const level = document.getElementById('tambah-level')?.value || 'Dasar';
  const program = document.getElementById('tambah-program')?.value || 'IQRA';
  const namaOrtu = document.getElementById('tambah-nama-ortu')?.value.trim() || '';
  const noHpOrtu = document.getElementById('tambah-no-hp-ortu')?.value.trim() || '';
  const tglMulai = document.getElementById('tambah-tgl-mulai')?.value || Engine.getTanggalHariIni();

  const validNama = Engine.validateNamaLengkap(nama);
  if (!validNama.valid) { showToast(validNama.error, 'error'); return; }

  const validHp = Engine.validateNomorHP(noHpOrtu);
  if (!validHp.valid) { showToast(`No. HP Ortu: ${validHp.error}`, 'error'); return; }

  const data = {
    nama, no_hp: noHp, kelompok, level, program,
    nama_ortu: namaOrtu, no_hp_ortu: validHp.normalized, tgl_mulai: tglMulai
  };

  showLoading('btn-simpan-santri', 'Menyimpan...');
  try {
    await API.addSantri(data);
    const newList = await API.getSantri(true);
    state.santriList = Array.isArray(newList) ? newList : (newList.data || newList.santri || []);
    closeModal('modal-tambah-santri');
    showToast(`${nama} berhasil didaftarkan ✅`, 'success');

    setTimeout(() => {
      if (confirm(`Kirim pesan sambutan ke ${namaOrtu}?`)) {
        const pesan = Engine.buildPesanSambutanBaru(nama, namaOrtu, kelompok);
        window.open(`https://wa.me/${validHp.normalized}?text=${encodeURIComponent(pesan)}`);
      }
    }, 500);
  } catch (err) {
    showToast(`Gagal daftar santri: ${err.message}`, 'error');
  } finally {
    hideLoading('btn-simpan-santri', 'Daftarkan Santri');
  }
}

function handleEditSantri() {
  const santri = state.santriList.find(s => s.santri_id === state.selectedSantriId);
  if (!santri) return;

  const el = document.getElementById('profil-data-diri');
  if (!el) return;

  el.innerHTML = `
    <div class="form-group"><label>Nama</label><input id="edit-nama" value="${santri.nama}"></div>
    <div class="form-group"><label>No HP</label><input id="edit-no-hp" value="${santri.no_hp || ''}"></div>
    <div class="form-group"><label>Kelompok</label>
      <select id="edit-kelompok">
        ${['A','B','C','D'].map(k => `<option value="${k}" ${k===santri.kelompok?'selected':''}>${k}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Level</label>
      <select id="edit-level">
        ${['Dasar','Lanjut','Tahfidz'].map(l => `<option value="${l}" ${l===santri.level?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="btn-row mt-2">
      <button class="btn btn-primary" id="btn-konfirmasi-edit">Simpan</button>
      <button class="btn btn-outline" id="btn-batal-edit">Batal</button>
    </div>`;

  document.getElementById('btn-konfirmasi-edit')?.addEventListener('click', async () => {
    const perubahan = {
      nama: document.getElementById('edit-nama')?.value,
      no_hp: document.getElementById('edit-no-hp')?.value,
      kelompok: document.getElementById('edit-kelompok')?.value,
      level: document.getElementById('edit-level')?.value,
    };
    try {
      await API.updateSantri(state.selectedSantriId, perubahan);
      const newList = await API.getSantri(true);
      state.santriList = Array.isArray(newList) ? newList : (newList.data || newList.santri || []);
      showToast('Data santri diperbarui ✅', 'success');
      openProfilSantri(state.selectedSantriId);
    } catch (err) {
      showToast(`Gagal update: ${err.message}`, 'error');
    }
  });

  document.getElementById('btn-batal-edit')?.addEventListener('click', () => {
    openProfilSantri(state.selectedSantriId);
  });
}

// ══════════════════════════════════════════════════════════════
// TAB LAPORAN
// ══════════════════════════════════════════════════════════════

async function initLaporan() {
  const container = document.getElementById('laporan-content');
  if (!container) return;

  container.innerHTML = `
    <div class="card" id="lap-absensi-section">
      <div class="card-header lap-accordion" data-target="lap-absensi-body" style="cursor:pointer">
        <span class="card-title">📋 Rekap Absensi Bulan Ini</span>
        <span>▼</span>
      </div>
      <div id="lap-absensi-body" class="hidden"><div class="text-muted text-sm">Memuat...</div></div>
    </div>
    <div class="card" id="lap-spp-section">
      <div class="card-header lap-accordion" data-target="lap-spp-body" style="cursor:pointer">
        <span class="card-title">💰 Status SPP Bulan Ini</span>
        <span>▼</span>
      </div>
      <div id="lap-spp-body" class="hidden"><div class="text-muted text-sm">Memuat...</div></div>
    </div>
    <div class="card" id="lap-hafalan-section">
      <div class="card-header lap-accordion" data-target="lap-hafalan-body" style="cursor:pointer">
        <span class="card-title">📖 Progress Hafalan</span>
        <span>▼</span>
      </div>
      <div id="lap-hafalan-body" class="hidden"><div class="text-muted text-sm">Memuat...</div></div>
    </div>
    <div class="card" id="lap-aktivitas-section">
      <div class="card-header lap-accordion" data-target="lap-aktivitas-body" style="cursor:pointer">
        <span class="card-title">📊 Rekap Aktivitas 7 Hari</span>
        <span>▼</span>
      </div>
      <div id="lap-aktivitas-body" class="hidden"><div class="text-muted text-sm">Memuat...</div></div>
    </div>`;

  // Accordion
  container.querySelectorAll('.lap-accordion').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const body = document.getElementById(targetId);
      if (!body) return;
      const isOpen = !body.classList.contains('hidden');
      body.classList.toggle('hidden', isOpen);
      if (!isOpen) return;
      loadLaporanSection(targetId);
    });
  });
}

async function loadLaporanSection(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  if (targetId === 'lap-absensi-body') {
    el.innerHTML = `<div class="text-muted text-sm">Memuat data absensi...</div>`;
    try {
      const results = await Promise.all(
        state.santriList.map(s => API.getAbsensiRekap(s.santri_id, Engine.getBulanSekarang()).catch(() => null))
      );
      const valid = results.filter(Boolean);
      el.innerHTML = valid.map(r => `
        <div class="list-item">
          <div class="avatar avatar-a">${inisial(r.nama)}</div>
          <div class="list-item-content">
            <div class="list-item-name">${r.nama}</div>
            <div class="list-item-sub">H:${r.total_hadir} I:${r.total_izin} A:${r.total_alpha} · ${r.persen_hadir}% hadir</div>
            <div class="progress-wrap" style="margin-top:4px"><div class="progress-fill ${Engine.getWarnaKehadiran(r.persen_hadir)}" style="width:${r.persen_hadir}%"></div></div>
          </div>
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted text-sm">Gagal memuat: ${err.message}</p>`;
    }
  }

  if (targetId === 'lap-spp-body') {
    el.innerHTML = `<div class="text-muted text-sm">Memuat data SPP...</div>`;
    try {
      const sppList = await API.getSppBulan(Engine.getBulanSekarang());
      const list = Array.isArray(sppList) ? sppList : (sppList.data || []);
      el.innerHTML = list.map(s => `
        <div class="list-item">
          <div class="avatar avatar-a">${inisial(s.nama)}</div>
          <div class="list-item-content">
            <div class="list-item-name">${s.nama}</div>
            <div class="list-item-sub"><span class="badge badge-${s.status}">${s.status}</span> ${s.nominal ? Engine.formatRupiah(s.nominal) : ''}</div>
            ${s.status === 'belum' ? `<button class="btn btn-accent btn-sm mt-1" onclick="window.openModalSpp('${s.santri_id}')">Input SPP</button>` : ''}
          </div>
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted text-sm">Gagal memuat: ${err.message}</p>`;
    }
  }

  if (targetId === 'lap-hafalan-body') {
    el.innerHTML = `<div class="text-muted text-sm">Memuat progress hafalan...</div>`;
    try {
      const progressList = await Promise.all(
        state.santriList.map(s => API.getProgressJuz30(s.santri_id).catch(() => null))
      );
      const valid = progressList.filter(Boolean).sort((a, b) => b.persen - a.persen);
      el.innerHTML = valid.map(p => `
        <div class="list-item">
          <div class="avatar avatar-a">${inisial(p.nama)}</div>
          <div class="list-item-content">
            <div class="list-item-name">${p.nama}</div>
            <div class="list-item-sub">${p.total_ayat_hafal} / ${Engine.TOTAL_AYAT_JUZ30} ayat · ${Engine.formatPersen(p.persen)}</div>
            <div class="progress-wrap"><div class="progress-fill primary" style="width:${p.persen}%"></div></div>
          </div>
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted text-sm">Gagal memuat: ${err.message}</p>`;
    }
  }

  if (targetId === 'lap-aktivitas-body') {
    el.innerHTML = `<div class="text-muted text-sm">Memuat aktivitas...</div>`;
    try {
      const feed = await API.getFeed(50);
      const list = Array.isArray(feed) ? feed : (feed.data || feed.feed || []);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const filtered = list.filter(f => new Date(f.tanggal) >= cutoff);
      el.innerHTML = filtered.length === 0 ?
        '<div class="text-muted text-sm">Tidak ada aktivitas 7 hari terakhir</div>' :
        filtered.map(f => `<div class="list-item-sub" style="padding:6px 0">${Engine.renderTeksHuman(f)}</div>`).join('');
    } catch (err) {
      el.innerHTML = `<p class="text-muted text-sm">Gagal memuat: ${err.message}</p>`;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

function showToast(pesan, tipe = 'default', durasi = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = pesan;
  toast.className = `toast ${tipe} active`;
  setTimeout(() => { toast.classList.remove('active'); }, durasi);
}

function showLoading(elId, teks = 'Menyimpan...') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.dataset.tesAsli = el.textContent;
  el.textContent = `⏳ ${teks}`;
  el.classList.add('btn-loading');
}

function hideLoading(elId, teksAsal) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = el.dataset.tesAsli || teksAsal;
  el.classList.remove('btn-loading');
}

function showSkeleton(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `
    <div class="skeleton skeleton-line full"></div>
    <div class="skeleton skeleton-line medium" style="margin-top:10px"></div>
    <div class="skeleton skeleton-line short" style="margin-top:8px"></div>`;
}

function renderSantriOptions(selectElId, santriList, defaultValue = null) {
  const el = document.getElementById(selectElId);
  if (!el) return;
  el.innerHTML = `<option value="">-- Pilih Santri --</option>` +
    santriList.map(s =>
      `<option value="${s.santri_id}" ${s.santri_id === defaultValue ? 'selected' : ''}>${s.nama}</option>`
    ).join('');
}

function waktuRelatif(isoString) {
  if (!isoString) return '';
  const now = new Date();
  const tgl = new Date(isoString);
  const diffMs = now - tgl;
  const diffMnt = Math.floor(diffMs / 60000);
  const diffJam = Math.floor(diffMnt / 60);
  const diffHari = Math.floor(diffJam / 24);

  if (diffMnt < 1)  return 'Barusan';
  if (diffMnt < 60) return `${diffMnt} menit lalu`;
  if (diffJam < 24) return `${diffJam} jam lalu`;
  if (diffHari === 1) return 'Kemarin';
  return `${diffHari} hari lalu`;
}

function inisial(nama) {
  if (!nama) return '?';
  return nama.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function labelJenis(jenis) {
  const map = { ABS: 'Absensi', THF: 'Hafalan', IQRA: 'Iqra', THS: 'Tahsin', QRN: 'Tilawah', TRB: 'Tarbiyah', SPP: 'SPP' };
  return map[jenis] || jenis;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════════════
// EXPOSE KE WINDOW (untuk elemen yang dibuat dinamis)
// ══════════════════════════════════════════════════════════════

window.switchTab              = switchTab;
window.openNotifPanel         = openNotifPanel;
window.closeNotifPanel        = closeNotifPanel;
window.openBottomSheetAbsensi = openBottomSheetAbsensi;
window.closeBottomSheet       = closeBottomSheet;
window.openFormCatatan        = openFormCatatan;
window.openModalSpp           = openModalSpp;
window.closeModal             = closeModal;
window.openProfilSantri       = openProfilSantri;
window.openFormTambahSantri   = openFormTambahSantri;
window.openUbahPin            = openUbahPin;
