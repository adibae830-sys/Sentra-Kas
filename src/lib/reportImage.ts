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

const FONT_SANS =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

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

function formatCleanGroupTitle(rawTitle?: string): string {
  const trimmed = String(rawTitle || '').trim();
  if (!trimmed) return 'Laporan Keuangan Kelompok';
  if (/template/i.test(trimmed) || /^buku_besar/i.test(trimmed)) {
    return 'Rekapitulasi Keuangan Kelompok';
  }
  return trimmed.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getInitials(name: string): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function drawBankEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  // Golden rounded square container
  drawRoundedRect(ctx, cx, cy, 44, 44, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.55)';
  ctx.stroke();

  // Minimalist bank pediment + pillars icon
  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Roof triangle
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy + 18);
  ctx.lineTo(cx + 22, cy + 10);
  ctx.lineTo(cx + 34, cy + 18);
  ctx.closePath();
  ctx.stroke();

  // Pillars
  [14, 22, 30].forEach((px) => {
    ctx.beginPath();
    ctx.moveTo(cx + px, cy + 18);
    ctx.lineTo(cx + px, cy + 31);
    ctx.stroke();
  });

  // Base line
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy + 32);
  ctx.lineTo(cx + 34, cy + 32);
  ctx.stroke();
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

  // 2x Retina logical coordinate space
  const scale = 2;
  const width = 1040;
  const outerPad = 36;
  const cardX = outerPad;
  const cardW = width - outerPad * 2;
  const innerPad = 32;
  const contentX = cardX + innerPad;
  const contentW = cardW - innerPad * 2;

  const heroH = 166;
  const hasHighlight = Boolean(options?.highlightText);
  const highlightH = hasHighlight ? 52 : 0;
  const highlightGap = hasHighlight ? 18 : 0;
  const balanceSectionH = 144;
  const sectionTitleH = 54;
  const tableHeaderH = 44;
  const rowH = 68;
  const visibleRows = Math.max(members.length, 1);
  const totalBarH = 60;
  const footerH = 64;

  const cardH =
    heroH +
    28 +
    balanceSectionH +
    highlightGap +
    highlightH +
    28 +
    sectionTitleH +
    tableHeaderH +
    visibleRows * rowH +
    14 +
    totalBarH +
    footerH;

  const height = outerPad * 2 + cardH;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return {
      dataUrl: '',
      filename: 'ringkasan-saldo-sentra-kas.png',
      width,
      height,
    };
  }

  ctx.scale(scale, scale);

  // Outer soft banking canvas backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#E6EEF8');
  bgGrad.addColorStop(1, '#F1F5FA');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Main elevated white statement sheet
  ctx.save();
  ctx.shadowColor = 'rgba(10, 36, 99, 0.11)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, cardX, outerPad, cardW, cardH, 26);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Hairline border around statement sheet
  drawRoundedRect(ctx, cardX, outerPad, cardW, cardH, 26);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#DCE5F2';
  ctx.stroke();

  // Clip hero top inside sheet rounded corners
  ctx.save();
  drawRoundedRect(ctx, cardX, outerPad, cardW, cardH, 26);
  ctx.clip();

  // Hero Cobalt-Navy Header
  const heroGrad = ctx.createLinearGradient(cardX, outerPad, cardX + cardW, outerPad + heroH);
  heroGrad.addColorStop(0, '#071E4A');
  heroGrad.addColorStop(0.5, '#003B7A');
  heroGrad.addColorStop(1, '#005EB8');
  ctx.fillStyle = heroGrad;
  ctx.fillRect(cardX, outerPad, cardW, heroH);

  // Subtle decorative banking arcs in header
  ctx.beginPath();
  ctx.arc(cardX + cardW - 60, outerPad + 20, 175, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cardX + cardW - 140, outerPad + heroH + 30, 130, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();

  // Subtle golden bottom accent stripe under hero
  const goldLine = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  goldLine.addColorStop(0, '#F59E0B');
  goldLine.addColorStop(0.5, '#FCD34D');
  goldLine.addColorStop(1, '#38BDF8');
  ctx.fillStyle = goldLine;
  ctx.fillRect(cardX, outerPad + heroH - 4, cardW, 4);

  ctx.restore();

  // Hero Brand Emblem & Title
  drawBankEmblem(ctx, contentX, outerPad + 30);

  ctx.fillStyle = '#FCD34D';
  ctx.font = `700 12.5px ${FONT_SANS}`;
  ctx.fillText('SENTRA KAS  ·  E-STATEMENT KELOMPOK', contentX + 58, outerPad + 47);

  const cleanTitle = formatCleanGroupTitle(dataset.spreadsheetTitle);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 26px ${FONT_SANS}`;
  ctx.fillText(fitText(ctx, cleanTitle, 520), contentX + 58, outerPad + 76);

  ctx.fillStyle = 'rgba(219, 234, 254, 0.9)';
  ctx.font = `500 14.5px ${FONT_SANS}`;
  ctx.fillText(
    options?.subtitle || 'Rincian Saldo Terkini & Posisi Keuangan Anggota',
    contentX,
    outerPad + 124
  );

  // Hero Right Timestamp Pill
  const nowStr = new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const pillW = 248;
  const pillX = contentX + contentW - pillW;
  const pillY = outerPad + 32;
  drawRoundedRect(ctx, pillX, pillY, pillW, 56, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#BFDBFE';
  ctx.font = `600 11px ${FONT_SANS}`;
  ctx.fillText('POSISI PER TANGGAL', pillX + pillW - 16, pillY + 21);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 14.5px ${FONT_SANS}`;
  ctx.fillText(`${nowStr} WIB`, pillX + pillW - 16, pillY + 43);

  ctx.fillStyle = '#FCD34D';
  ctx.font = `600 13px ${FONT_SANS}`;
  ctx.fillText(
    `${admin.anggotaAktif} Anggota Aktif  ·  ${admin.pinjamanStatusCounts.Berjalan} Pinjaman Aktif`,
    contentX + contentW,
    outerPad + 124
  );
  ctx.textAlign = 'left';

  // Cursor inside statement body
  let cursorY = outerPad + heroH + 28;

  // Balance Overview Panel (Hero Saldo + 3 Metric Columns)
  drawRoundedRect(ctx, contentX, cursorY, contentW, balanceSectionH, 18);
  ctx.fillStyle = '#F8FAFD';
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Left Primary Cash Balance
  const primaryW = 335;
  drawRoundedRect(ctx, contentX + 10, cursorY + 10, primaryW - 10, balanceSectionH - 20, 14);
  const focalGrad = ctx.createLinearGradient(
    contentX + 10,
    cursorY + 10,
    contentX + primaryW,
    cursorY + balanceSectionH - 10
  );
  focalGrad.addColorStop(0, '#072456');
  focalGrad.addColorStop(1, '#004A8F');
  ctx.fillStyle = focalGrad;
  ctx.fill();

  ctx.fillStyle = '#FCD34D';
  ctx.font = `700 11.5px ${FONT_SANS}`;
  ctx.fillText('SALDO KAS SAAT INI', contentX + 30, cursorY + 38);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 32px ${FONT_SANS}`;
  ctx.fillText(fitText(ctx, rupiah(admin.saldo), primaryW - 50), contentX + 30, cursorY + 82);

  // Subtle green status dot
  ctx.beginPath();
  ctx.arc(contentX + 35, cursorY + 111, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#34D399';
  ctx.fill();

  ctx.fillStyle = '#DBEAFE';
  ctx.font = `500 12.5px ${FONT_SANS}`;
  ctx.fillText('Saldo bersih tersedia di kas', contentX + 46, cursorY + 115);

  // Right 3 Metric Columns
  const rightAreaX = contentX + primaryW + 12;
  const rightAreaW = contentW - primaryW - 22;
  const colW = rightAreaW / 3;

  const metrics = [
    {
      label: 'TOTAL DANA MASUK',
      value: `+ ${rupiah(admin.masuk)}`,
      sub: `${dataset.kasMasuk.length} transaksi kredit`,
      color: '#059669',
      dot: '#10B981',
    },
    {
      label: 'TOTAL DANA KELUAR',
      value: `- ${rupiah(admin.keluar)}`,
      sub: `${dataset.kasKeluar.length} transaksi debit`,
      color: '#D97706',
      dot: '#F59E0B',
    },
    {
      label: 'PIUTANG PINJAMAN',
      value: rupiah(admin.piutang),
      sub: `${admin.pinjamanStatusCounts.Berjalan} pinjaman berjalan`,
      color: '#004A8F',
      dot: '#2563EB',
    },
  ];

  metrics.forEach((m, idx) => {
    const mx = rightAreaX + idx * colW;
    if (idx > 0) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(mx - 6, cursorY + 24, 1, balanceSectionH - 48);
    }

    ctx.beginPath();
    ctx.arc(mx + 14, cursorY + 38, 4, 0, Math.PI * 2);
    ctx.fillStyle = m.dot;
    ctx.fill();

    ctx.fillStyle = '#64748B';
    ctx.font = `700 11px ${FONT_SANS}`;
    ctx.fillText(m.label, mx + 25, cursorY + 42);

    ctx.fillStyle = m.color;
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText(fitText(ctx, m.value, colW - 22), mx + 10, cursorY + 79);

    ctx.fillStyle = '#64748B';
    ctx.font = `500 12.5px ${FONT_SANS}`;
    ctx.fillText(fitText(ctx, m.sub, colW - 22), mx + 10, cursorY + 110);
  });

  cursorY += balanceSectionH;

  // Optional Latest Mutation Highlight Strip
  if (hasHighlight && options?.highlightText) {
    cursorY += highlightGap;
    const isDebit = options.highlightTone === 'debit';
    drawRoundedRect(ctx, contentX, cursorY, contentW, highlightH, 12);
    ctx.fillStyle = isDebit ? '#FFFBEB' : '#ECFDF5';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = isDebit ? '#FDE68A' : '#A7F3D0';
    ctx.stroke();

    // Left accent bar
    drawRoundedRect(ctx, contentX, cursorY, 6, highlightH, 3);
    ctx.fillStyle = isDebit ? '#D97706' : '#059669';
    ctx.fill();

    ctx.fillStyle = isDebit ? '#92400E' : '#065F46';
    ctx.font = `700 14px ${FONT_SANS}`;
    ctx.fillText(
      fitText(ctx, `MUTASI TERBARU:  ${options.highlightText}`, contentW - 40),
      contentX + 20,
      cursorY + 31
    );
    cursorY += highlightH;
  }

  cursorY += 28;

  // Member Breakdown Section Header
  ctx.fillStyle = '#0F172A';
  ctx.font = `800 19px ${FONT_SANS}`;
  ctx.fillText('Rincian Saldo & Pinjaman Anggota', contentX, cursorY + 22);

  ctx.fillStyle = '#64748B';
  ctx.font = `500 12.5px ${FONT_SANS}`;
  ctx.fillText('Total simpanan, sisa pinjaman, dan saldo bersih masing-masing anggota', contentX, cursorY + 42);

  // Formula Pill on Right
  const formulaLabel = 'Saldo = Simpanan - Pinjaman';
  ctx.font = `600 11.5px ${FONT_SANS}`;
  const fWidth = ctx.measureText(formulaLabel).width + 24;
  drawRoundedRect(ctx, contentX + contentW - fWidth, cursorY + 8, fWidth, 28, 14);
  ctx.fillStyle = '#EFF6FF';
  ctx.fill();
  ctx.strokeStyle = '#BFDBFE';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#004A8F';
  ctx.fillText(formulaLabel, contentX + contentW - fWidth / 2, cursorY + 26);
  ctx.textAlign = 'left';

  cursorY += sectionTitleH;

  // Column Header Pill Bar
  drawRoundedRect(ctx, contentX, cursorY, contentW, tableHeaderH, 12);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();

  const colMemberX = contentX + 18;
  const colSimpananRightX = contentX + 515;
  const colPinjamanRightX = contentX + 705;
  const colSaldoRightX = contentX + contentW - 18;

  ctx.fillStyle = '#475569';
  ctx.font = `700 11.5px ${FONT_SANS}`;
  ctx.fillText('ANGGOTA', colMemberX, cursorY + 26);

  ctx.textAlign = 'right';
  ctx.fillText('TOTAL SALDO (SIMPANAN)', colSimpananRightX, cursorY + 26);
  ctx.fillText('PINJAMAN (SISA)', colPinjamanRightX, cursorY + 26);
  ctx.fillText('SALDO SAAT INI', colSaldoRightX, cursorY + 26);
  ctx.textAlign = 'left';

  cursorY += tableHeaderH;

  const avatarPalette = [
    { bg: '#DBEAFE', fg: '#1E40AF' },
    { bg: '#D1FAE5', fg: '#065F46' },
    { bg: '#E0E7FF', fg: '#3730A3' },
    { bg: '#FEF3C7', fg: '#92400E' },
    { bg: '#E0F2FE', fg: '#075985' },
  ];

  if (members.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 14px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data anggota terdaftar.', width / 2, cursorY + 40);
    ctx.textAlign = 'left';
    cursorY += rowH;
  } else {
    members.forEach((m, index) => {
      if (index % 2 === 1) {
        ctx.fillStyle = '#FAFBFD';
        ctx.fillRect(contentX, cursorY, contentW, rowH);
      }

      // Row hairline divider
      if (index < members.length - 1) {
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(contentX + 14, cursorY + rowH - 1, contentW - 28, 1);
      }

      // Circular monogram avatar
      const pal = avatarPalette[index % avatarPalette.length];
      const avatarX = colMemberX + 19;
      const avatarY = cursorY + rowH / 2;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, 19, 0, Math.PI * 2);
      ctx.fillStyle = pal.bg;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = pal.fg;
      ctx.font = `700 13px ${FONT_SANS}`;
      ctx.fillText(getInitials(m.nama), avatarX, avatarY + 4.5);
      ctx.textAlign = 'left';

      // Member name & clean human subtitle (no raw timestamp ID)
      const textX = colMemberX + 50;
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 15.5px ${FONT_SANS}`;
      ctx.fillText(fitText(ctx, m.nama, 270), textX, cursorY + 29);

      const subtitleParts: string[] = [];
      subtitleParts.push(m.status === 'Aktif' ? 'Aktif' : m.status);
      if (m.totalSisaPinjaman > 0) {
        subtitleParts.push(
          m.totalSisaAngsuran > 0
            ? `Sisa ${m.totalSisaAngsuran}x angsuran`
            : 'Pinjaman berjalan'
        );
      } else {
        subtitleParts.push('Bebas pinjaman');
      }

      ctx.fillStyle = m.totalSisaPinjaman > 0 ? '#B45309' : '#64748B';
      ctx.font = `500 12px ${FONT_SANS}`;
      ctx.fillText(subtitleParts.join('  ·  '), textX, cursorY + 49);

      // Total Simpanan
      ctx.textAlign = 'right';
      ctx.fillStyle = m.totalSimpanan > 0 ? '#059669' : '#94A3B8';
      ctx.font = `700 15.5px ${FONT_SANS}`;
      ctx.fillText(rupiah(m.totalSimpanan), colSimpananRightX, cursorY + 39);

      // Sisa Pinjaman
      ctx.fillStyle = m.totalSisaPinjaman > 0 ? '#D97706' : '#94A3B8';
      ctx.font = `700 15.5px ${FONT_SANS}`;
      ctx.fillText(
        m.totalSisaPinjaman > 0 ? rupiah(m.totalSisaPinjaman) : 'Rp 0',
        colPinjamanRightX,
        cursorY + 39
      );

      // Saldo Saat Ini inside soft tinted pill
      const saldoText = rupiah(m.saldoAnggotaSaatIni);
      ctx.font = `800 15px ${FONT_SANS}`;
      const pillTextW = ctx.measureText(saldoText).width;
      const saldoPillW = Math.max(pillTextW + 24, 108);
      const saldoPillX = colSaldoRightX - saldoPillW;
      const saldoPillY = cursorY + 17;
      drawRoundedRect(ctx, saldoPillX, saldoPillY, saldoPillW, 34, 10);

      if (m.saldoAnggotaSaatIni < 0) {
        ctx.fillStyle = '#FEF2F2';
        ctx.fill();
        ctx.fillStyle = '#DC2626';
      } else if (m.saldoAnggotaSaatIni > 0) {
        ctx.fillStyle = '#EFF6FF';
        ctx.fill();
        ctx.fillStyle = '#004A8F';
      } else {
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.fillStyle = '#64748B';
      }

      ctx.fillText(saldoText, colSaldoRightX - 12, cursorY + 39);
      ctx.textAlign = 'left';

      cursorY += rowH;
    });
  }

  cursorY += 14;

  // Grand Totals Bar
  const sumSimpanan = members.reduce((s, m) => s + m.totalSimpanan, 0);
  const sumPinjaman = members.reduce((s, m) => s + m.totalSisaPinjaman, 0);
  const sumSaldoSaatIni = members.reduce((s, m) => s + m.saldoAnggotaSaatIni, 0);

  drawRoundedRect(ctx, contentX, cursorY, contentW, totalBarH, 14);
  const totalGrad = ctx.createLinearGradient(contentX, cursorY, contentX + contentW, cursorY);
  totalGrad.addColorStop(0, '#071E4A');
  totalGrad.addColorStop(1, '#003B7A');
  ctx.fillStyle = totalGrad;
  ctx.fill();

  ctx.fillStyle = '#FCD34D';
  ctx.font = `800 13.5px ${FONT_SANS}`;
  ctx.fillText(`TOTAL KESELURUHAN (${members.length} ANGGOTA)`, colMemberX, cursorY + 35);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#6EE7B7';
  ctx.font = `800 16px ${FONT_SANS}`;
  ctx.fillText(rupiah(sumSimpanan), colSimpananRightX, cursorY + 36);

  ctx.fillStyle = '#FCD34D';
  ctx.fillText(rupiah(sumPinjaman), colPinjamanRightX, cursorY + 36);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 17px ${FONT_SANS}`;
  ctx.fillText(rupiah(sumSaldoSaatIni), colSaldoRightX - 12, cursorY + 36);
  ctx.textAlign = 'left';

  cursorY += totalBarH;

  // Footer inside Statement Sheet
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(contentX, cursorY + 20, contentW, 1);

  ctx.beginPath();
  ctx.arc(contentX + 5, cursorY + 42, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#10B981';
  ctx.fill();

  ctx.fillStyle = '#64748B';
  ctx.font = `600 12px ${FONT_SANS}`;
  ctx.fillText(
    'Sentra Kas  ·  Transparansi Keuangan Kelompok Terintegrasi',
    contentX + 16,
    cursorY + 46
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 12px ${FONT_SANS}`;
  ctx.fillText(
    'Dokumen Ringkasan Resmi · Siap Bagikan ke Grup WhatsApp',
    contentX + contentW,
    cursorY + 46
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
