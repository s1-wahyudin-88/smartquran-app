// ============================================================
// engine.js — Logika Bisnis Smart Quran + Ribath App
// ============================================================
// Murni fungsi transformasi data. Tidak ada:
//   - DOM manipulation
//   - fetch() / request ke API
//   - localStorage langsung (kecuali fungsi formatter khusus)
// Semua fungsi menerima data sebagai parameter dan return hasil.
// ============================================================

// ── KONSTANTA ─────────────────────────────────────────────────

export const JUZ30 = [
  { surah: 'An-Naba',       nomor: 78,  total_ayat: 40 },
  { surah: "An-Nazi'at",    nomor: 79,  total_ayat: 46 },
  { surah: 'Abasa',         nomor: 80,  total_ayat: 42 },
  { surah: 'At-Takwir',     nomor: 81,  total_ayat: 29 },
  { surah: 'Al-Infitar',    nomor: 82,  total_ayat: 19 },
  { surah: 'Al-Mutaffifin', nomor: 83,  total_ayat: 36 },
  { surah: 'Al-Insyiqaq',   nomor: 84,  total_ayat: 25 },
  { surah: 'Al-Buruj',      nomor: 85,  total_ayat: 22 },
  { surah: 'At-Tariq',      nomor: 86,  total_ayat: 17 },
  { surah: "Al-A'la",       nomor: 87,  total_ayat: 19 },
  { surah: 'Al-Ghasyiyah',  nomor: 88,  total_ayat: 26 },
  { surah: 'Al-Fajr',       nomor: 89,  total_ayat: 30 },
  { surah: 'Al-Balad',      nomor: 90,  total_ayat: 20 },
  { surah: 'Asy-Syams',     nomor: 91,  total_ayat: 15 },
  { surah: 'Al-Lail',       nomor: 92,  total_ayat: 21 },
  { surah: 'Ad-Duha',       nomor: 93,  total_ayat: 11 },
  { surah: 'Al-Insyirah',   nomor: 94,  total_ayat: 8  },
  { surah: 'At-Tin',        nomor: 95,  total_ayat: 8  },
  { surah: 'Al-Alaq',       nomor: 96,  total_ayat: 19 },
  { surah: 'Al-Qadr',       nomor: 97,  total_ayat: 5  },
  { surah: 'Al-Bayyinah',   nomor: 98,  total_ayat: 8  },
  { surah: 'Az-Zalzalah',   nomor: 99,  total_ayat: 8  },
  { surah: 'Al-Adiyat',     nomor: 100, total_ayat: 11 },
  { surah: "Al-Qari'ah",    nomor: 101, total_ayat: 11 },
  { surah: 'At-Takasur',    nomor: 102, total_ayat: 8  },
  { surah: 'Al-Asr',        nomor: 103, total_ayat: 3  },
  { surah: 'Al-Humazah',    nomor: 104, total_ayat: 9  },
  { surah: 'Al-Fil',        nomor: 105, total_ayat: 5  },
  { surah: 'Quraisy',       nomor: 106, total_ayat: 4  },
  { surah: "Al-Ma'un",      nomor: 107, total_ayat: 7  },
  { surah: 'Al-Kausar',     nomor: 108, total_ayat: 3  },
  { surah: 'Al-Kafirun',    nomor: 109, total_ayat: 6  },
  { surah: 'An-Nasr',       nomor: 110, total_ayat: 3  },
  { surah: 'Al-Lahab',      nomor: 111, total_ayat: 5  },
  { surah: 'Al-Ikhlas',     nomor: 112, total_ayat: 4  },
  { surah: 'Al-Falaq',      nomor: 113, total_ayat: 5  },
  { surah: 'An-Nas',        nomor: 114, total_ayat: 6  }
];

export const TOTAL_AYAT_JUZ30 = 564;

export const ENUM_JENIS = ['ABS', 'THF', 'IQRA', 'THS', 'QRN', 'TRB', 'SPP'];

// Nama bulan Bahasa Indonesia
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// ── BAGIAN 1 — AUTO HAFALAN ENGINE ───────────────────────────

/**
 * Mendapatkan total ayat surah berdasarkan nama
 * @param {string} namaSurah - nama surah
 * @returns {number} total ayat, 0 jika tidak ditemukan
 */
export function getTotalAyatSurah(namaSurah) {
  const surah = JUZ30.find(s => s.surah === namaSurah);
  return surah ? surah.total_ayat : 0;
}

/**
 * Mendapatkan nama surah berikutnya dalam urutan Juz 30
 * @param {string} surahSekarang - nama surah saat ini
 * @returns {string|null} nama surah berikutnya, null jika sudah An-Nas
 */
export function getSurahBerikutnya(surahSekarang) {
  const idx = JUZ30.findIndex(s => s.surah === surahSekarang);
  if (idx === -1 || idx === JUZ30.length - 1) return null;
  return JUZ30[idx + 1].surah;
}

/**
 * Menghitung saran hafalan berikutnya berdasarkan data hafalan terakhir
 * @param {object|null} lastHafalanData - hasil API getLastHafalan, atau null
 * @returns {{ surah, ayat_start, ayat_end_suggest, total_ayat_surah, is_surah_baru }}
 */
export function getNextHafalan(lastHafalanData) {
  // Belum ada hafalan sama sekali
  if (!lastHafalanData || !lastHafalanData.surah_terakhir) {
    const totalAyat = getTotalAyatSurah('An-Naba');
    return {
      surah: 'An-Naba',
      ayat_start: 1,
      ayat_end_suggest: Math.min(5, totalAyat),
      total_ayat_surah: totalAyat,
      is_surah_baru: true
    };
  }

  const { surah_terakhir, ayat_end_terakhir } = lastHafalanData;
  const totalAyatSekarang = getTotalAyatSurah(surah_terakhir);

  // Jika sudah khatam surah ini, pindah ke surah berikutnya
  if (ayat_end_terakhir >= totalAyatSekarang) {
    const surahBaru = getSurahBerikutnya(surah_terakhir);
    if (!surahBaru) {
      // Sudah khatam semua Juz 30
      return {
        surah: surah_terakhir,
        ayat_start: totalAyatSekarang,
        ayat_end_suggest: totalAyatSekarang,
        total_ayat_surah: totalAyatSekarang,
        is_surah_baru: false
      };
    }
    const totalBaru = getTotalAyatSurah(surahBaru);
    return {
      surah: surahBaru,
      ayat_start: 1,
      ayat_end_suggest: Math.min(5, totalBaru),
      total_ayat_surah: totalBaru,
      is_surah_baru: true
    };
  }

  // Lanjutkan dari ayat berikutnya di surah yang sama
  const ayatStart = ayat_end_terakhir + 1;
  const ayatEndSuggest = Math.min(ayatStart + 4, totalAyatSekarang);
  return {
    surah: surah_terakhir,
    ayat_start: ayatStart,
    ayat_end_suggest: ayatEndSuggest,
    total_ayat_surah: totalAyatSekarang,
    is_surah_baru: false
  };
}

// ── BAGIAN 2 — MURAJAAH ENGINE ────────────────────────────────

/**
 * Mengecek apakah surah sudah dimurajaah dalam N hari terakhir
 * @param {Array} hafalanHistory - array aktivitas THF
 * @param {string} surah - nama surah
 * @param {number} hariTerakhir - batas hari ke belakang
 * @returns {boolean}
 */
export function cekSudahMurajaah(hafalanHistory, surah, hariTerakhir = 7) {
  const batasTanggal = new Date();
  batasTanggal.setDate(batasTanggal.getDate() - hariTerakhir);

  return hafalanHistory.some(item => {
    const nilai = typeof item.nilai === 'string' ? JSON.parse(item.nilai) : item.nilai;
    if (nilai.tipe !== 'murajaah') return false;
    if (nilai.surah !== surah) return false;
    const tgl = new Date(item.tanggal);
    return tgl >= batasTanggal;
  });
}

/**
 * Memberikan saran surah untuk dimurajaah hari ini
 * @param {Array} hafalanHistory - array hasil getHafalanHistory (sudah di-parse)
 * @returns {{ surah, ayat_start, ayat_end, alasan }|null}
 */
export function getMurajaahSuggest(hafalanHistory) {
  if (!hafalanHistory || hafalanHistory.length === 0) return null;

  // Kumpulkan surah yang sudah dihafal (tipe baru)
  const surahHafalSet = new Set();
  hafalanHistory.forEach(item => {
    const nilai = typeof item.nilai === 'string' ? JSON.parse(item.nilai) : item.nilai;
    if (nilai.tipe === 'baru') surahHafalSet.add(nilai.surah);
  });

  if (surahHafalSet.size === 0) return null;

  // Cari surah yang belum dimurajaah dalam 7 hari
  // Urutkan berdasarkan urutan Juz 30 (yang paling awal = prioritas)
  const surahUrut = JUZ30.map(s => s.surah).filter(s => surahHafalSet.has(s));

  // Cari terakhir kali murajaah untuk setiap surah
  const getMurajaahTerakhir = (surah) => {
    const murajaahItems = hafalanHistory.filter(item => {
      const nilai = typeof item.nilai === 'string' ? JSON.parse(item.nilai) : item.nilai;
      return nilai.tipe === 'murajaah' && nilai.surah === surah;
    });
    if (murajaahItems.length === 0) return null;
    return murajaahItems.reduce((latest, item) =>
      item.tanggal > latest.tanggal ? item : latest
    ).tanggal;
  };

  // Prioritaskan yang belum dimurajaah 7 hari
  let kandidat = null;
  let tglTerlama = null;

  for (const surah of surahUrut) {
    const sudahMurajaah = cekSudahMurajaah(hafalanHistory, surah, 7);
    if (!sudahMurajaah) {
      const tglTerakhir = getMurajaahTerakhir(surah);
      if (!kandidat || !tglTerakhir || tglTerakhir < tglTerlama) {
        kandidat = surah;
        tglTerlama = tglTerakhir;
      }
    }
  }

  // Jika semua sudah dimurajaah dalam 7 hari, ambil yang paling awal
  if (!kandidat) {
    kandidat = surahUrut[0];
  }

  const totalAyat = getTotalAyatSurah(kandidat);
  const sudah7Hari = !cekSudahMurajaah(hafalanHistory, kandidat, 7);

  return {
    surah: kandidat,
    ayat_start: 1,
    ayat_end: totalAyat,
    alasan: sudah7Hari ? 'Belum murajaah 7 hari' : 'Murajaah rutin'
  };
}

// ── BAGIAN 3 — PROGRESS ENGINE ────────────────────────────────

/**
 * Membangun set ayat unik yang sudah dihafal dari riwayat hafalan
 * @param {Array} hafalanHistory - array aktivitas THF tipe "baru"
 * @returns {Array<{surah, ayat}>} array unik
 */
export function buildAyatSet(hafalanHistory) {
  const ayatSet = new Set();
  const result = [];

  hafalanHistory.forEach(item => {
    const nilai = typeof item.nilai === 'string' ? JSON.parse(item.nilai) : item.nilai;
    if (nilai.tipe !== 'baru') return;

    for (let ayat = nilai.ayat_start; ayat <= nilai.ayat_end; ayat++) {
      const key = `${nilai.surah}:${ayat}`;
      if (!ayatSet.has(key)) {
        ayatSet.add(key);
        result.push({ surah: nilai.surah, ayat });
      }
    }
  });

  return result;
}

/**
 * Menghitung progress hafalan Juz 30 berdasarkan set ayat unik
 * @param {Array<{surah, ayat}>} ayatHafal - array ayat unik yang sudah hafal
 * @returns {{ total_ayat, persen, surah_selesai, surah_sedang, surah_sedang_detail }}
 */
export function hitungProgressJuz30(ayatHafal) {
  // Hitung jumlah ayat per surah yang sudah dihafal
  const hafalPerSurah = {};
  ayatHafal.forEach(({ surah }) => {
    hafalPerSurah[surah] = (hafalPerSurah[surah] || 0) + 1;
  });

  const surahSelesai = [];
  let surahSedang = null;
  let surahSedangDetail = null;

  for (const surahInfo of JUZ30) {
    const hafal = hafalPerSurah[surahInfo.surah] || 0;
    if (hafal === 0) continue;

    if (hafal >= surahInfo.total_ayat) {
      surahSelesai.push(surahInfo.surah);
    } else {
      // Surah yang sedang dihafal = surah terakhir yang belum selesai
      surahSedang = surahInfo.surah;
      surahSedangDetail = {
        surah: surahInfo.surah,
        hafal,
        total: surahInfo.total_ayat
      };
    }
  }

  const totalAyat = ayatHafal.length;
  const persen = parseFloat(((totalAyat / TOTAL_AYAT_JUZ30) * 100).toFixed(2));

  return {
    total_ayat: totalAyat,
    persen,
    surah_selesai: surahSelesai,
    surah_sedang: surahSedang,
    surah_sedang_detail: surahSedangDetail
  };
}

// ── BAGIAN 4 — FEED RENDERER ──────────────────────────────────

/**
 * Menghasilkan teks deskripsi aktivitas dalam Bahasa Indonesia
 * Digunakan sebagai FALLBACK saat teks_human dari backend tidak tersedia.
 * @param {{ jenis, nilai, nama_santri, tanggal }} aktivitas
 * @returns {string} teks deskripsi
 */
export function renderTeksHuman(aktivitas) {
  const { jenis, nilai: nilaiRaw, nama_santri, tanggal } = aktivitas;
  const nilai = typeof nilaiRaw === 'string' ? JSON.parse(nilaiRaw) : nilaiRaw;
  const nama = nama_santri || 'Santri';
  const tgl = tanggal ? formatTanggalPendek(tanggal) : '';

  switch (jenis) {
    case 'ABS': {
      if (nilai.status === 'hadir')  return `${nama} hadir · ${tgl}`;
      if (nilai.status === 'izin')   return `${nama} izin · ${tgl}`;
      if (nilai.status === 'alpha')  return `${nama} tidak hadir (alpha) · ${tgl}`;
      return `${nama} absensi · ${tgl}`;
    }
    case 'THF': {
      const range = `${nilai.surah} ${nilai.ayat_start}-${nilai.ayat_end}`;
      if (nilai.tipe === 'baru')      return `${nama} hafal ${range} · ${tgl}`;
      if (nilai.tipe === 'murajaah') return `${nama} murajaah ${range} · ${tgl}`;
      return `${nama} hafalan ${range} · ${tgl}`;
    }
    case 'IQRA':
      return `${nama} Iqra Jilid ${nilai.jilid} Hal ${nilai.halaman} · ${tgl}`;
    case 'THS':
      return `${nama} Tahsin: ${nilai.materi} · Nilai ${nilai.nilai}`;
    case 'QRN':
      return `${nama} Tilawah Hal ${nilai.halaman} (${nilai.irama})`;
    case 'TRB':
      return `${nama} Tarbiyah: ${nilai.materi}`;
    case 'SPP':
      return `${nama} SPP ${nilai.bulan} · ${nilai.status} Rp${formatAngka(nilai.nominal)}`;
    default:
      return `${nama} · ${tgl}`;
  }
}

// ── BAGIAN 5 — TEMPLATE WA ENGINE ────────────────────────────

/**
 * Pesan notifikasi ketidakhadiran hari ini (T-14)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} tanggal - format "Senin, 2 April 2026"
 * @returns {string}
 */
export function buildPesanAbsenAlpha(namaSantri, namaOrtu, tanggal) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Kami ingin menginformasikan bahwa *${namaSantri}* tidak hadir dalam kegiatan belajar pada:

📅 *${tanggal}*

Mohon konfirmasi terkait ketidakhadiran ini. Apabila ada uzur syar'i, silakan kabari kami agar dapat dicatat dengan tepat.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan reminder pembayaran SPP (T-03)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} bulan - contoh: "April 2026"
 * @param {number} nominal
 * @returns {string}
 */
export function buildPesanSppReminder(namaSantri, namaOrtu, bulan, nominal) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Kami ingin mengingatkan bahwa SPP *${namaSantri}* untuk bulan *${bulan}* sebesar *${formatRupiah(nominal)}* belum kami terima.

Mohon untuk segera melakukan pembayaran agar proses belajar dapat berjalan lancar. Terima kasih atas perhatian dan kerja samanya.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan konfirmasi penerimaan SPP (T-04)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} bulan
 * @param {number} nominal
 * @param {string} status - "lunas" | "subsidi" | "infaq"
 * @returns {string}
 */
export function buildPesanKonfirmasiSpp(namaSantri, namaOrtu, bulan, nominal, status) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Alhamdulillah, kami telah menerima pembayaran SPP *${namaSantri}*:

📌 Bulan  : *${bulan}*
💰 Nominal: *${formatRupiah(nominal)}*
✅ Status  : *${status.charAt(0).toUpperCase() + status.slice(1)}*

Semoga menjadi amal jariyah yang diberkahi Allah Subhanahu wa Ta'ala.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan selamat atas pencapaian milestone (T-07)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} pencapaian - contoh: "Khatam Iqra Jilid 1" | "Hafal An-Naba"
 * @returns {string}
 */
export function buildPesanMilestone(namaSantri, namaOrtu, pencapaian) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang kami hormati,

Alhamdulillah, kami dengan bangga menyampaikan bahwa *${namaSantri}* telah mencapai:

🏆 *${pencapaian}*

Semoga Allah Subhanahu wa Ta'ala menjadikannya ilmu yang bermanfaat dan pemberi syafaat di hari kiamat. Teruslah semangat!

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan tindak lanjut 2x alpha berturut-turut (T-08)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} tanggal1 - tanggal alpha pertama
 * @param {string} tanggal2 - tanggal alpha kedua
 * @returns {string}
 */
export function buildPesanAlpha2x(namaSantri, namaOrtu, tanggal1, tanggal2) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Kami hendak menyampaikan bahwa *${namaSantri}* telah tidak hadir sebanyak 2 kali berturut-turut:

📅 ${tanggal1}
📅 ${tanggal2}

Kami sangat mengharapkan perhatian Bapak/Ibu untuk memastikan kehadiran beliau agar proses belajar tidak terganggu. Apabila ada kendala, mohon segera berikan informasi kepada kami.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan informasi tunggakan SPP 2 bulan (T-13)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} bulan1 - bulan tunggak pertama
 * @param {string} bulan2 - bulan tunggak kedua
 * @returns {string}
 */
export function buildPesanSppTunggak(namaSantri, namaOrtu, bulan1, bulan2) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Kami ingin menginformasikan bahwa SPP *${namaSantri}* tercatat masih belum dibayarkan untuk:

📌 ${bulan1}
📌 ${bulan2}

Mohon untuk segera menyelesaikan tunggakan tersebut agar administrasi berjalan lancar. Apabila ada kesulitan, jangan ragu untuk menghubungi kami.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan broadcast mingguan dari ustadz (T-01)
 * @param {string} tanggal - tanggal broadcast
 * @param {string} kelompok - nama kelompok
 * @param {{ hadir, izin, alpha, total_pertemuan, highlight }} ringkasan
 * @returns {string}
 */
export function buildPesanBroadcastMingguan(tanggal, kelompok, ringkasan) {
  const { hadir, izin, alpha, total_pertemuan, highlight } = ringkasan;
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

📚 *Laporan Mingguan — Kelompok ${kelompok}*
📅 ${tanggal}

Alhamdulillah, pekan ini telah terlaksana *${total_pertemuan} pertemuan* dengan rekap kehadiran:
✅ Hadir  : ${hadir} santri
🟡 Izin   : ${izin} santri
❌ Alpha  : ${alpha} santri

💡 *Highlight pekan ini:*
${highlight || 'Tidak ada catatan khusus pekan ini.'}

Mari terus tingkatkan semangat belajar Al-Qur'an. Semoga Allah mudahkan dan berkahi setiap langkah kita.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

/**
 * Pesan sambutan santri baru (T-09)
 * @param {string} namaSantri
 * @param {string} namaOrtu
 * @param {string} kelompok - nama kelompok yang dimasuki
 * @returns {string}
 */
export function buildPesanSambutanBaru(namaSantri, namaOrtu, kelompok) {
  return `Assalamu'alaikum warahmatullahi wabarakatuh,

Bapak/Ibu ${namaOrtu} yang terhormat,

Selamat datang! Kami dengan penuh kegembiraan menyambut *${namaSantri}* sebagai santri baru di:

🕌 *Ribath Iqra Izzul Islam*
👥 Kelompok: *${kelompok}*

Semoga Allah Subhanahu wa Ta'ala memberikan kemudahan, keberkahan, dan kecintaan terhadap Al-Qur'an kepada *${namaSantri}*. Kami siap mendampingi setiap langkah perjalanan belajarnya.

Jazakumullahu khairan 🙏
_Tim Ribath Iqra Izzul Islam_`;
}

// ── BAGIAN 6 — FORMATTER ENGINE ──────────────────────────────

// Helper internal: format angka dengan titik ribuan (tanpa "Rp")
function formatAngka(nominal) {
  return Number(nominal).toLocaleString('id-ID');
}

/**
 * Memformat tanggal ISO menjadi format panjang Indonesia
 * @param {string} isoString - "2026-04-02"
 * @returns {string} "Rabu, 2 April 2026"
 */
export function formatTanggal(isoString) {
  if (!isoString) return '';
  const [yyyy, mm, dd] = isoString.split('-').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  const hari = NAMA_HARI[date.getDay()];
  const bulan = NAMA_BULAN[mm - 1];
  return `${hari}, ${dd} ${bulan} ${yyyy}`;
}

/**
 * Memformat tanggal ISO menjadi format pendek
 * @param {string} isoString - "2026-04-02"
 * @returns {string} "2 Apr 2026"
 */
export function formatTanggalPendek(isoString) {
  if (!isoString) return '';
  const [yyyy, mm, dd] = isoString.split('-').map(Number);
  const bulan = NAMA_BULAN[mm - 1].slice(0, 3);
  return `${dd} ${bulan} ${yyyy}`;
}

/**
 * Memformat angka ke format rupiah
 * @param {number} nominal
 * @returns {string} "Rp 100.000"
 */
export function formatRupiah(nominal) {
  return `Rp ${formatAngka(nominal)}`;
}

/**
 * Memformat angka persen dengan desimal
 * @param {number} angka - nilai persentase
 * @param {number} desimal - jumlah desimal
 * @returns {string} "8,0%"
 */
export function formatPersen(angka, desimal = 1) {
  return `${angka.toFixed(desimal).replace('.', ',')}%`;
}

/**
 * Mendapatkan tanggal hari ini dalam format ISO
 * @returns {string} "2026-04-02"
 */
export function getTanggalHariIni() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Mendapatkan bulan sekarang dalam format parameter API
 * @returns {string} "2026-04"
 */
export function getBulanSekarang() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Mendapatkan label bulan sekarang untuk ditampilkan di UI
 * @returns {string} "April 2026"
 */
export function getBulanSekarangLabel() {
  const now = new Date();
  return `${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Mendapatkan daftar bulan terakhir dalam format parameter API
 * @param {number} jumlahBulanKe - jumlah bulan ke belakang + bulan ini
 * @returns {string[]} array YYYY-MM, dari terlama ke sekarang
 */
export function getBulanList(jumlahBulanKe = 6) {
  const result = [];
  const now = new Date();
  for (let i = jumlahBulanKe - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}

/**
 * Mengkonversi format parameter bulan ke label tampilan
 * @param {string} bulanParam - "2026-04"
 * @returns {string} "April 2026"
 */
export function bulanParamToLabel(bulanParam) {
  if (!bulanParam) return '';
  const [yyyy, mm] = bulanParam.split('-').map(Number);
  return `${NAMA_BULAN[mm - 1]} ${yyyy}`;
}

/**
 * Mengkonversi label tampilan bulan ke format parameter
 * @param {string} bulanLabel - "April 2026"
 * @returns {string} "2026-04"
 */
export function bulanLabelToParam(bulanLabel) {
  if (!bulanLabel) return '';
  const parts = bulanLabel.split(' ');
  const yyyy = parts[1];
  const mm = String(NAMA_BULAN.indexOf(parts[0]) + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Mendapatkan nama hari dari tanggal ISO
 * @param {string} isoString - "2026-04-02"
 * @returns {string} "Rabu"
 */
export function getDayName(isoString) {
  if (!isoString) return '';
  const [yyyy, mm, dd] = isoString.split('-').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return NAMA_HARI[date.getDay()];
}

/**
 * Mengecek apakah tanggal ISO adalah hari ini
 * @param {string} isoString
 * @returns {boolean}
 */
export function isHariIni(isoString) {
  return isoString === getTanggalHariIni();
}

// ── BAGIAN 7 — VALIDATOR ──────────────────────────────────────

/**
 * Memvalidasi dan menormalisasi nomor HP Indonesia
 * @param {string} noHp
 * @returns {{ valid: boolean, normalized: string, error: string|null }}
 */
export function validateNomorHP(noHp) {
  if (!noHp) return { valid: false, normalized: '', error: 'Nomor HP wajib diisi' };

  // Hilangkan karakter non-digit kecuali +
  let normalized = noHp.replace(/[^\d+]/g, '');

  // Normalisasi awalan
  if (normalized.startsWith('+62')) {
    normalized = normalized.slice(1); // hapus +, jadi 628xxx
  } else if (normalized.startsWith('62')) {
    // sudah benar
  } else if (normalized.startsWith('08')) {
    normalized = '62' + normalized.slice(1); // 08xxx → 628xxx
  } else if (normalized.startsWith('8')) {
    normalized = '62' + normalized; // 8xxx → 628xxx
  }

  if (!normalized.startsWith('628')) {
    return { valid: false, normalized: '', error: 'Format nomor HP tidak valid' };
  }

  if (normalized.length < 11 || normalized.length > 14) {
    return { valid: false, normalized: '', error: 'Panjang nomor HP harus 11-14 digit' };
  }

  return { valid: true, normalized, error: null };
}

/**
 * Memvalidasi nama lengkap
 * @param {string} nama
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateNamaLengkap(nama) {
  if (!nama || nama.trim().length < 2) {
    return { valid: false, error: 'Nama minimal 2 karakter' };
  }
  if (/^\d+$/.test(nama.trim())) {
    return { valid: false, error: 'Nama tidak boleh hanya berisi angka' };
  }
  return { valid: true, error: null };
}

/**
 * Memvalidasi nilai aktivitas sesuai jenis
 * @param {string} jenis - enum JENIS
 * @param {object} nilai - objek nilai (bukan string)
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateNilaiAktivitas(jenis, nilai) {
  if (!nilai || typeof nilai !== 'object') {
    return { valid: false, error: 'Nilai harus berupa objek' };
  }

  switch (jenis) {
    case 'ABS': {
      const statusValid = ['hadir', 'izin', 'alpha'];
      if (!statusValid.includes(nilai.status)) {
        return { valid: false, error: `Status absensi tidak valid: ${nilai.status}` };
      }
      break;
    }
    case 'THF': {
      if (!nilai.surah || typeof nilai.surah !== 'string') {
        return { valid: false, error: 'Nama surah wajib diisi' };
      }
      if (typeof nilai.ayat_start !== 'number' || typeof nilai.ayat_end !== 'number') {
        return { valid: false, error: 'Ayat start dan end harus berupa angka' };
      }
      if (!['baru', 'murajaah'].includes(nilai.tipe)) {
        return { valid: false, error: `Tipe hafalan tidak valid: ${nilai.tipe}` };
      }
      break;
    }
    case 'IQRA': {
      if (typeof nilai.jilid !== 'number') {
        return { valid: false, error: 'Jilid harus berupa angka' };
      }
      if (typeof nilai.halaman !== 'number') {
        return { valid: false, error: 'Halaman harus berupa angka' };
      }
      if (!['lancar', 'perlu_ulang'].includes(nilai.kualitas)) {
        return { valid: false, error: `Kualitas tidak valid: ${nilai.kualitas}` };
      }
      break;
    }
    case 'THS': {
      if (!nilai.materi || typeof nilai.materi !== 'string') {
        return { valid: false, error: 'Materi tahsin wajib diisi' };
      }
      if (!['A', 'B', 'C'].includes(nilai.nilai)) {
        return { valid: false, error: `Nilai tahsin tidak valid: ${nilai.nilai}` };
      }
      break;
    }
    case 'QRN': {
      if (typeof nilai.halaman !== 'number') {
        return { valid: false, error: 'Halaman harus berupa angka' };
      }
      if (!['Bayati', 'Hijaz', 'Nahawand'].includes(nilai.irama)) {
        return { valid: false, error: `Irama tidak valid: ${nilai.irama}` };
      }
      if (!['baik', 'perlu_perbaikan'].includes(nilai.kualitas)) {
        return { valid: false, error: `Kualitas tidak valid: ${nilai.kualitas}` };
      }
      break;
    }
    case 'TRB': {
      if (!nilai.materi || typeof nilai.materi !== 'string') {
        return { valid: false, error: 'Materi tarbiyah wajib diisi' };
      }
      if (typeof nilai.hadir !== 'boolean') {
        return { valid: false, error: 'Field hadir harus berupa boolean' };
      }
      break;
    }
    case 'SPP': {
      if (typeof nilai.nominal !== 'number' || nilai.nominal <= 0) {
        return { valid: false, error: 'Nominal SPP harus berupa angka positif' };
      }
      // Status "belum" TIDAK VALID untuk dikirim dari frontend
      const statusSppValid = ['lunas', 'subsidi', 'infaq'];
      if (!statusSppValid.includes(nilai.status)) {
        return { valid: false, error: `Status SPP tidak valid: ${nilai.status}` };
      }
      if (!nilai.bulan || typeof nilai.bulan !== 'string') {
        return { valid: false, error: 'Bulan SPP wajib diisi' };
      }
      break;
    }
    default:
      return { valid: false, error: `Jenis aktivitas tidak dikenal: ${jenis}` };
  }

  return { valid: true, error: null };
}

/**
 * Menilai risiko absensi santri berdasarkan riwayat terbaru
 * @param {Array<{status: string}>} riwayatAbsensi - array status absensi
 * @returns {'merah'|'kuning'|'normal'}
 */
export function getRisikoAbsensi(riwayatAbsensi) {
  if (!riwayatAbsensi || riwayatAbsensi.length < 2) return 'normal';

  const terakhir2 = riwayatAbsensi.slice(-2);
  const duaAlpha = terakhir2.every(a => a.status === 'alpha');
  const satuAlpha = terakhir2.some(a => a.status === 'alpha');

  if (duaAlpha) return 'merah';
  if (satuAlpha) return 'kuning';
  return 'normal';
}

/**
 * Menentukan kelas warna berdasarkan persentase kehadiran
 * @param {number} persen - persentase kehadiran (0-100)
 * @returns {'good'|'warn'|'bad'}
 */
export function getWarnaKehadiran(persen) {
  if (persen >= 80) return 'good';
  if (persen >= 60) return 'warn';
  return 'bad';
}
