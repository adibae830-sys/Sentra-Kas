import {
  computeAdminDashboard,
  computeRingkasanAnggota,
  rupiah,
} from './financeEngine';
import { FinanceDataset } from '../types/finance';

export interface RingkasanImageResult {
  dataUrl: string;
  filename: string;
  width: number;
  height: number;
}

export interface RingkasanImageOptions {
  highlightText?: string;
  highlightTone?: 'credit' | 'debit';
  subtitle?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(clipped + '...').width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped + '...';
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function generateRingkasanSaldoImage(
  dataset: FinanceDataset,
  options?: RingkasanImageOptions
): RingkasanImageResult {
  const admin = computeAdminDashboard(dataset);
  const members = computeRingkasanAnggota(dataset);

  const width = 1080;
  const padX = 36;
  const innerW = width - padX * 2;
  const headerH = 148;
  const hasHighlight = Boolean(options?.highlightText);
  const highlightH = hasHighlight ? 54 : 0;
  const highlightGap = hasHighlight ? 16 : 0;
  const kpiSectionH = 132;
  const tableHeaderAreaH = 108; // Card title + column headers
  const rowH = 56;
  const visibleRows = Math.max(members.length, 1);
  const tableTotalRowH = 56;
  const tableCardH = tableHeaderAreaH + visibleRows * rowH + tableTotalRowH + 16;
  const footerH = 54;

  const height =
    32 +
    headerH +
    20 +
    highlightH +
    highlightGap +
    kpiSectionH +
    24 +
    tableCardH +
    footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return {
      dataUrl: '',
      filename: 'ringkasan-saldo-sentra-kas.png',
      width,
      height,
    };
  }

  // Canvas background
  ctx.fillStyle = '#F2F6FA';
  ctx.fillRect(0, 0, width, height);

  // Header Card (Banking Cobalt Gradient)
  let cursorY = 32;
  const headerGrad = ctx.createLinearGradient(padX, cursorY, width - padX, cursorY + headerH);
  headerGrad.addColorStop(0, '#002855');
  headerGrad.addColorStop(0.55, '#004A8F');
  headerGrad.addColorStop(1, '#0066CC');
  drawRoundedRect(ctx, padX, cursorY, innerW, headerH, 20);
  ctx.fillStyle = headerGrad;
  ctx.fill();

  // Decorative circle inside header
  ctx.save();
  drawRoundedRect(ctx, padX, cursorY, innerW, headerH, 20);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(width - padX - 40, cursorY + 24, 130, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.restore();

  // Header Text Left
  ctx.fillStyle = '#FCD34D';
  ctx.font = '700 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('SENTRA KAS · LAPORAN POSISI KEUANGAN', padX + 30, cursorY + 42);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 30px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    fitText(ctx, dataset.spreadsheetTitle || 'Keuangan Anggota Kelompok', 620),
    padX + 30,
    cursorY + 84
  );

  ctx.fillStyle = 'rgba(219, 234, 254, 0.9)';
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    options?.subtitle || 'Rincian Saldo Kelompok & Posisi Simpanan / Pinjaman Anggota',
    padX + 30,
    cursorY + 116
  );

  // Header Text Right (Date & Active Members)
  const nowStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(219, 234, 254, 0.85)';
  ctx.font = '600 14px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('Update Posisi Kas', width - padX - 30, cursorY + 46);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText(nowStr + ' WIB', width - padX - 30, cursorY + 78);

  ctx.fillStyle = '#FCD34D';
  ctx.font = '700 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${admin.anggotaAktif} Anggota Aktif · ${admin.pinjamanStatusCounts.Berjalan} Pinjaman Aktif`,
    width - padX - 30,
    cursorY + 114
  );
  ctx.textAlign = 'left';

  cursorY += headerH + 20;

  // Optional Latest Mutation Strip
  if (hasHighlight && options?.highlightText) {
    const isDebit = options.highlightTone === 'debit';
    drawRoundedRect(ctx, padX, cursorY, innerW, highlightH, 14);
    ctx.fillStyle = isDebit ? '#FFFBEB' : '#ECFDF5';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isDebit ? '#FDE68A' : '#A7F3D0';
    ctx.stroke();

    ctx.fillStyle = isDebit ? '#B45309' : '#047857';
    ctx.font = '700 16px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText(
      fitText(ctx, `MUTASI TERBARU: ${options.highlightText}`, innerW - 44),
      padX + 22,
      cursorY + 33
    );

    cursorY += highlightH + highlightGap;
  }

  // 4 Summary KPI Cards (Rincian Saldo Saat Ini)
  const kpiGap = 14;
  const kpiW = (innerW - kpiGap * 3) / 4;

  const kpiItems = [
    {
      label: 'SALDO KAS SAAT INI',
      value: rupiah(admin.saldo),
      sub: 'Saldo bersih tersedia',
      focal: true,
      valColor: '#FFFFFF',
    },
    {
      label: 'TOTAL DANA MASUK',
      value: rupiah(admin.masuk),
      sub: `${dataset.kasMasuk.length} transaksi kredit`,
      focal: false,
      valColor: '#047857',
    },
    {
      label: 'TOTAL DANA KELUAR',
      value: rupiah(admin.keluar),
      sub: `${dataset.kasKeluar.length} transaksi debit`,
      focal: false,
      valColor: '#D97706',
    },
    {
      label: 'PIUTANG PINJAMAN',
      value: rupiah(admin.piutang),
      sub: `${admin.pinjamanStatusCounts.Berjalan} pinjaman berjalan`,
      focal: false,
      valColor: '#004A8F',
    },
  ];

  kpiItems.forEach((item, i) => {
    const kx = padX + i * (kpiW + kpiGap);
    drawRoundedRect(ctx, kx, cursorY, kpiW, kpiSectionH, 16);
    if (item.focal) {
      const cardGrad = ctx.createLinearGradient(kx, cursorY, kx + kpiW, cursorY + kpiSectionH);
      cardGrad.addColorStop(0, '#00356B');
      cardGrad.addColorStop(1, '#0056A8');
      ctx.fillStyle = cardGrad;
      ctx.fill();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();
    }

    ctx.fillStyle = item.focal ? '#FCD34D' : '#64748B';
    ctx.font = '700 12px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText(item.label, kx + 18, cursorY + 32);

    ctx.fillStyle = item.valColor;
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.fillText(fitText(ctx, item.value, kpiW - 32), kx + 18, cursorY + 74);

    ctx.fillStyle = item.focal ? 'rgba(219, 234, 254, 0.85)' : '#64748B';
    ctx.font = '500 13px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.fillText(fitText(ctx, item.sub, kpiW - 32), kx + 18, cursorY + 108);
  });

  cursorY += kpiSectionH + 24;

  // Rincian Masing-Masing Anggota Card
  drawRoundedRect(ctx, padX, cursorY, innerW, tableCardH, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Section Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 20px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('Rincian Keuangan Masing-Masing Anggota', padX + 24, cursorY + 38);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(
    'Saldo Saat Ini = Total Simpanan - Sisa Pinjaman',
    width - padX - 24,
    cursorY + 38
  );
  ctx.textAlign = 'left';

  // Table Column Header Bar
  const thY = cursorY + 58;
  const thH = 44;
  ctx.fillStyle = '#EBF3FC';
  ctx.fillRect(padX + 16, thY, innerW - 32, thH);

  const colNoX = padX + 32;
  const colNamaX = padX + 82;
  const colSimpananRightX = padX + 590;
  const colPinjamanRightX = padX + 795;
  const colSaldoRightX = width - padX - 32;

  ctx.fillStyle = '#002855';
  ctx.font = '700 13px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('NO', colNoX, thY + 27);
  ctx.fillText('NAMA ANGGOTA', colNamaX, thY + 27);

  ctx.textAlign = 'right';
  ctx.fillText('TOTAL SALDO (SIMPANAN)', colSimpananRightX, thY + 27);
  ctx.fillText('PINJAMAN (SISA)', colPinjamanRightX, thY + 27);
  ctx.fillText('SALDO SAAT INI', colSaldoRightX, thY + 27);
  ctx.textAlign = 'left';

  let rowY = thY + thH;

  if (members.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data anggota terdaftar.', width / 2, rowY + 34);
    ctx.textAlign = 'left';
    rowY += rowH;
  } else {
    members.forEach((m, index) => {
      if (index % 2 === 1) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(padX + 16, rowY, innerW - 32, rowH);
      }

      // Row divider
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(padX + 16, rowY + rowH - 1, innerW - 32, 1);

      // No
      ctx.fillStyle = '#64748B';
      ctx.font = '600 14px "JetBrains Mono", monospace';
      ctx.fillText(String(index + 1), colNoX, rowY + 33);

      // Name & ID subtitle
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 16px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
      ctx.fillText(fitText(ctx, m.nama, 300), colNamaX, rowY + 26);

      ctx.fillStyle = m.status === 'Aktif' ? '#64748B' : '#94A3B8';
      ctx.font = '500 12px "JetBrains Mono", monospace';
      ctx.fillText(
        `${m.idAnggota}${m.status !== 'Aktif' ? ` · ${m.status}` : ''}`,
        colNamaX,
        rowY + 45
      );

      // Total Simpanan
      ctx.textAlign = 'right';
      ctx.fillStyle = '#047857';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(rupiah(m.totalSimpanan), colSimpananRightX, rowY + 34);

      // Sisa Pinjaman
      ctx.fillStyle = m.totalSisaPinjaman > 0 ? '#D97706' : '#94A3B8';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.fillText(rupiah(m.totalSisaPinjaman), colPinjamanRightX, rowY + 34);

      // Saldo Saat Ini
      ctx.fillStyle = m.saldoAnggotaSaatIni >= 0 ? '#004A8F' : '#DC2626';
      ctx.font = '800 17px "JetBrains Mono", monospace';
      ctx.fillText(rupiah(m.saldoAnggotaSaatIni), colSaldoRightX, rowY + 34);
      ctx.textAlign = 'left';

      rowY += rowH;
    });
  }

  // Summary Totals Row
  const sumSimpanan = members.reduce((s, m) => s + m.totalSimpanan, 0);
  const sumPinjaman = members.reduce((s, m) => s + m.totalSisaPinjaman, 0);
  const sumSaldoSaatIni = members.reduce((s, m) => s + m.saldoAnggotaSaatIni, 0);

  ctx.fillStyle = '#002855';
  drawRoundedRect(ctx, padX + 16, rowY + 4, innerW - 32, tableTotalRowH - 8, 12);
  ctx.fill();

  ctx.fillStyle = '#FCD34D';
  ctx.font = '700 15px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(`TOTAL (${members.length} ANGGOTA)`, colNamaX, rowY + 35);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#6EE7B7';
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.fillText(rupiah(sumSimpanan), colSimpananRightX, rowY + 35);

  ctx.fillStyle = '#FCD34D';
  ctx.fillText(rupiah(sumPinjaman), colPinjamanRightX, rowY + 35);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 17px "JetBrains Mono", monospace';
  ctx.fillText(rupiah(sumSaldoSaatIni), colSaldoRightX, rowY + 35);
  ctx.textAlign = 'left';

  // Footer
  const footerY = height - 20;
  ctx.fillStyle = '#64748B';
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText('Sentra Kas · Transparansi Keuangan Kelompok', padX + 6, footerY);

  ctx.textAlign = 'right';
  ctx.fillText(
    'Dokumen ringkasan otomatis siap bagikan ke Grup WA',
    width - padX - 6,
    footerY
  );
  ctx.textAlign = 'left';

  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    filename: `ringkasan-saldo-sentra-kas-${dateTag}.png`,
    width,
    height,
  };
}
