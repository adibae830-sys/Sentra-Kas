import React, { useState } from 'react';
import {
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Film,
  Play,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { IURAN_WAJIB_PER_BULAN, rupiah } from '../lib/financeEngine';
import { VideoTopic } from './VideoPanduanModal';

interface KnowledgeViewProps {
  onOpenVideo: (topic: VideoTopic) => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

const OFFICIAL_BANK = {
  bank: 'SeaBank',
  rekening: '901551447687',
  atasNama: 'Adi Supriyanto',
} as const;

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  onOpenVideo,
  onNotify,
}) => {
  const [copiedRek, setCopiedRek] = useState(false);

  const handleCopyRek = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(OFFICIAL_BANK.rekening);
      } else {
        const temp = document.createElement('textarea');
        temp.value = OFFICIAL_BANK.rekening;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopiedRek(true);
      onNotify?.('success', `Nomor rekening SeaBank (${OFFICIAL_BANK.rekening}) disalin!`);
      setTimeout(() => setCopiedRek(false), 2500);
    } catch {
      onNotify?.('error', 'Gagal menyalin nomor rekening.');
    }
  };

  const videoCards: Array<{
    topic: VideoTopic;
    badge: string;
    title: string;
    desc: string;
    points: string[];
    icon: React.ReactNode;
    accentBg: string;
  }> = [
    {
      topic: 'setor',
      badge: 'Video 1 · 6 Babak',
      title: 'Cara Setor Iuran & Bayar Angsuran',
      desc: 'Panduan lengkap setor iuran bulanan, angsuran, serta fitur Tab Gabungan (sekali transfer langsung terbagi).',
      points: [
        'Tab Gabungan (misal Rp 500.000 → Rp 100.000 Iuran + Rp 400.000 Angsuran)',
        'Transfer SeaBank (salin no. rekening otomatis) & Scan/Unduh QRIS',
        'Masuk antrean ACC Admin / Bendahara sebelum saldo diperbarui',
      ],
      icon: <Wallet className="h-5 w-5 text-amber-300" />,
      accentBg: 'bg-[#1E5B2A]',
    },
    {
      topic: 'pinjaman',
      badge: 'Video 2 · 6 Babak',
      title: 'Cara Pengajuan Pinjaman Anggota',
      desc: 'Langkah pengajuan pinjaman baru langsung dari akun anggota hingga pencairan disetujui pengurus.',
      points: [
        'Isi nominal pinjaman & lama tenor (estimasi cicilan langsung tampil)',
        'Status pengajuan masuk antrean Menunggu ACC Administrator',
        'Pantau sisa pinjaman & bayar cicilan lewat menu Setor',
      ],
      icon: <CreditCard className="h-5 w-5 text-amber-300" />,
      accentBg: 'bg-[#164A21]',
    },
    {
      topic: 'instal',
      badge: 'Video 3 · 6 Babak',
      title: 'Cara Instal Aplikasi di HP & Desktop',
      desc: 'Panduan memasang KSP SENTRA ke layar utama Android, iPhone, maupun Laptop tanpa perlu Play Store.',
      points: [
        'Tombol Install Aplikasi / Pasang di HP langsung dari header aplikasi',
        'Menu titik tiga (⋮) Google Chrome di Android & Laptop/PC',
        'Tombol Bagikan (Share) → Tambahkan ke Layar Utama di iPhone Safari',
      ],
      icon: <Smartphone className="h-5 w-5 text-amber-300" />,
      accentBg: 'bg-[#103D1B]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#103D1B] via-[#1B5727] to-[#287336] p-6 text-white shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
              <BookOpen className="h-3.5 w-3.5" />
              Pusat Edukasi &amp; Panduan Anggota
            </div>
            <h2 className="font-editorial mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Knowledge &amp; Video Panduan KSP SENTRA
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-100/90 sm:text-sm">
              Kumpulan video tutorial resmi bersuara panduan wanita Indonesia (format HP 9:16 siap unduh &amp; bagikan ke Grup WhatsApp) serta panduan tertulis untuk seluruh anggota dan pengurus.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-emerald-50">
            <Film className="h-4 w-4 text-amber-300" />
            <span>3 Video Tutorial Tersedia</span>
          </div>
        </div>
      </div>

      {/* Video Tutorial Cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-editorial text-base font-bold text-slate-900 sm:text-lg">
            Video Presentasi &amp; Panduan (Bisa Diunduh &amp; Share ke WA)
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {videoCards.map((card) => (
            <div
              key={card.topic}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.accentBg}`}
                  >
                    {card.icon}
                  </span>
                  <span className="rounded-full bg-[#EAF4EC] px-2.5 py-1 text-[11px] font-bold text-[#1E5B2A]">
                    {card.badge}
                  </span>
                </div>

                <h4 className="mt-4 text-base font-bold text-slate-900">{card.title}</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{card.desc}</p>

                <ul className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3">
                  {card.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E5B2A]" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onOpenVideo(card.topic)}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#154620]"
              >
                <Play className="h-3.5 w-3.5 fill-current text-amber-300" />
                Tonton &amp; Unduh Video
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Written Reference Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Official Payment & Verification Rules */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A]">
              <Building2 className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-editorial text-base font-bold text-slate-900">
                Rekening Resmi &amp; Aturan Setoran
              </h3>
              <p className="text-xs text-slate-500">
                Gunakan hanya metode pembayaran resmi koperasi di bawah ini.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-[#F4FAF5] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#1E5B2A] uppercase">
                  Transfer Bank · {OFFICIAL_BANK.bank}
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold tracking-wide text-slate-900 select-all">
                  {OFFICIAL_BANK.rekening}
                </p>
                <p className="text-xs text-slate-600">
                  a.n. <strong className="text-slate-900">{OFFICIAL_BANK.atasNama}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyRek}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  copiedRek
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1E5B2A] text-white hover:bg-[#154620]'
                }`}
              >
                {copiedRek ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedRek ? 'Tersalin' : 'Salin No. Rek'}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs leading-relaxed text-slate-700">
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-[#1E5B2A]" />
              <p>
                <strong>Pembayaran QRIS:</strong> Gambar QRIS resmi tampil otomatis saat Anda memilih metode QRIS di menu <em>Setor</em> (dapat diperbesar atau diunduh ke galeri HP).
              </p>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1E5B2A]" />
              <p>
                <strong>Setoran Sekaligus (Tab Gabungan):</strong> Jika transfer sekaligus (misal Rp 500.000), sistem otomatis membagi {rupiah(IURAN_WAJIB_PER_BULAN)} untuk Iuran Wajib dan sisanya memotong Angsuran. Saldo baru berubah setelah diverifikasi Admin/Bendahara.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Installation & Loan Guide */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF4EC] text-[#1E5B2A]">
              <Smartphone className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-editorial text-base font-bold text-slate-900">
                Panduan Cepat Pasang Aplikasi &amp; Pinjaman
              </h3>
              <p className="text-xs text-slate-500">
                Ringkasan langkah pemasangan di HP tanpa perlu Play Store.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5">
              <p className="font-bold text-slate-900">1. Pengguna HP Android &amp; Laptop (Chrome/Edge)</p>
              <p className="mt-1 text-slate-600">
                Buka aplikasi di browser Chrome, ketuk tombol <strong>Install Aplikasi</strong> / <strong>Pasang di HP</strong> di bagian atas, atau ketuk menu <strong>⋮ (titik tiga) → Tambahkan ke layar utama</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-[#F8FAF8] p-3.5">
              <p className="font-bold text-slate-900">2. Pengguna iPhone / iPad (Safari)</p>
              <p className="mt-1 text-slate-600">
                Buka aplikasi menggunakan browser <strong>Safari</strong>, ketuk ikon <strong>Bagikan (Share)</strong> di bilah bawah, lalu pilih <strong>Tambahkan ke Layar Utama</strong> dan tekan <strong>Tambah</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-[#EAF4EC]/60 p-3.5">
              <p className="font-bold text-[#1E5B2A]">3. Alur Pengajuan Pinjaman Anggota</p>
              <p className="mt-1 text-slate-700">
                Masuk ke menu <strong>Pinjam / Ajukan Pinjaman</strong>, isi nominal dan tenor bulan, lalu kirim pengajuan. Administrator akan memverifikasi kelayakan dan mencairkan dana sebelum status berubah menjadi <strong>Berjalan</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
