import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface VideoPanduanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

interface SceneDef {
  id: number;
  title: string;
  startSec: number;
  endSec: number;
}

const SCENES: SceneDef[] = [
  { id: 0, title: 'Intro KSP SENTRA', startSec: 0, endSec: 4.2 },
  { id: 1, title: '1. Buka Menu Setor', startSec: 4.2, endSec: 8.8 },
  { id: 2, title: '2. Tab Gabungan (500rb)', startSec: 8.8, endSec: 14.4 },
  { id: 3, title: '3A. Transfer SeaBank', startSec: 14.4, endSec: 19.6 },
  { id: 4, title: '3B. Scan / Unduh QRIS', startSec: 19.6, endSec: 24.6 },
  { id: 5, title: '4. ACC Pengurus & Saldo', startSec: 24.6, endSec: 30.0 },
];

const TOTAL_DURATION_SEC = 30.0;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;

const LOGO_SRC = '/assets/aistudio/image_1d167c98.png';
const QRIS_SRC = '/assets/aistudio/image_e0eba57e.png';

const FONT_SANS =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'center'
): number {
  ctx.textAlign = align;
  const words = text.split(' ');
  let line = '';
  let currY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currY);
      line = words[i];
      currY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currY);
    currY += lineHeight;
  }
  return currY;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${src}`));
    img.src = src;
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, timeSec: number, dark = false) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  if (dark) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0C2F14');
    grad.addColorStop(0.55, '#164A21');
    grad.addColorStop(1, '#1E5B2A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.arc(W - 60, 140 + Math.sin(timeSec * 1.1) * 14, 190, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, H - 140 + Math.cos(timeSec * 0.9) * 14, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#F4F7F4';
  ctx.fillRect(0, 0, W, H);

  // Top emerald header band
  const hdrGrad = ctx.createLinearGradient(0, 0, W, 240);
  hdrGrad.addColorStop(0, '#103D1B');
  hdrGrad.addColorStop(1, '#1E5B2A');
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(0, 0, W, 190);

  ctx.fillStyle = 'rgba(252, 211, 77, 0.14)';
  ctx.fillRect(0, 184, W, 6);
}

function drawHeaderBrand(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  stepLabel: string
) {
  const W = CANVAS_WIDTH;
  // Logo square
  ctx.save();
  drawRoundedRect(ctx, 44, 48, 72, 72, 16);
  ctx.fillStyle = '#F7F5EE';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.75)';
  ctx.stroke();
  drawRoundedRect(ctx, 47, 51, 66, 66, 14);
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, 47, 51, 66, 66);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 30px ${FONT_SANS}`;
  ctx.fillText('KSP SENTRA', 134, 82);

  ctx.fillStyle = '#D1FAE5';
  ctx.font = `500 18px ${FONT_SANS}`;
  ctx.fillText('Bersama Membangun Umat', 134, 110);

  // Step pill on right
  ctx.save();
  const pillW = Math.max(195, ctx.measureText(stepLabel).width + 44);
  const pillX = W - 44 - pillW;
  drawRoundedRect(ctx, pillX, 58, pillW, 48, 24);
  ctx.fillStyle = '#FCD34D';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#103D1B';
  ctx.font = `800 19px ${FONT_SANS}`;
  ctx.fillText(stepLabel, pillX + pillW / 2, 89);
  ctx.restore();
}

function drawFooterProgress(ctx: CanvasRenderingContext2D, timeSec: number, activeSceneIdx: number) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const pct = clamp01(timeSec / TOTAL_DURATION_SEC);

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
  drawRoundedRect(ctx, 44, H - 54, W - 88, 12, 6);
  ctx.fill();

  ctx.fillStyle = '#1E5B2A';
  drawRoundedRect(ctx, 44, H - 54, Math.max(12, (W - 88) * pct), 12, 6);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText(`Bagian ${activeSceneIdx + 1} dari ${SCENES.length}`, 44, H - 72);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1E5B2A';
  ctx.font = `700 18px ${FONT_SANS}`;
  ctx.fillText('Panduan Setor Anggota', W - 44, H - 72);
  ctx.restore();
}

function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  logoImg: HTMLImageElement | null,
  qrisImg: HTMLImageElement | null
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;

  const sceneIdx = Math.max(
    0,
    SCENES.findIndex((s) => timeSec >= s.startSec && timeSec < s.endSec)
  );
  const currentScene = SCENES[sceneIdx] || SCENES[SCENES.length - 1];
  const localT = timeSec - currentScene.startSec;
  const dur = currentScene.endSec - currentScene.startSec;
  const enter = easeOutCubic(localT / 0.55);

  if (sceneIdx === 0) {
    // SCENE 0: INTRO
    drawBackground(ctx, timeSec, true);

    const logoScale = 0.85 + 0.15 * enter;
    const logoSize = 230 * logoScale;
    const lx = W / 2 - logoSize / 2;
    const ly = 210 + (1 - enter) * 30;

    ctx.save();
    ctx.globalAlpha = enter;
    drawRoundedRect(ctx, lx - 12, ly - 12, logoSize + 24, logoSize + 24, 42);
    ctx.fillStyle = '#F7F5EE';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    drawRoundedRect(ctx, lx, ly, logoSize, logoSize, 32);
    ctx.clip();
    if (logoImg) {
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = easeOutCubic((localT - 0.35) / 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText('VIDEO PANDUAN ANGGOTA', W / 2, 520);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 48px ${FONT_SANS}`;
    wrapText(ctx, 'Cara Setor Iuran & Bayar Angsuran', W / 2, 595, W - 100, 62);

    ctx.fillStyle = '#D1FAE5';
    ctx.font = `500 25px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Transfer SeaBank atau QRIS langsung dari HP, lalu diverifikasi Admin & Bendahara.',
      W / 2,
      745,
      W - 120,
      36
    );
    ctx.restore();

    // 3 Feature pills
    const pills = [
      '✓ Bisa 1x Transfer Gabungan',
      '✓ Rekening & QRIS Resmi',
      '✓ Aman Dicek Pengurus',
    ];
    pills.forEach((p, idx) => {
      const pAnim = easeOutCubic((localT - 0.8 - idx * 0.25) / 0.45);
      ctx.save();
      ctx.globalAlpha = pAnim;
      const py = 875 + idx * 78 + (1 - pAnim) * 18;
      drawRoundedRect(ctx, 110, py, W - 220, 58, 29);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(252, 211, 77, 0.45)';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 23px ${FONT_SANS}`;
      ctx.fillText(p, W / 2, py + 37);
      ctx.restore();
    });
    return;
  }

  // Scenes 1..5 use light financial background + top brand bar
  drawBackground(ctx, timeSec, false);

  const stepTags = [
    '',
    'LANGKAH 1',
    'LANGKAH 2',
    'LANGKAH 3A',
    'LANGKAH 3B',
    'LANGKAH 4',
  ];
  drawHeaderBrand(ctx, logoImg, stepTags[sceneIdx] || 'PANDUAN');

  if (sceneIdx === 1) {
    // SCENE 1: BUKA MENU SETOR
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 40px ${FONT_SANS}`;
    wrapText(ctx, 'Masuk Akun & Pilih Menu Setor', W / 2, 275, W - 90, 50);

    ctx.fillStyle = '#475569';
    ctx.font = `500 23px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Setelah login dengan Username & Password Anda, ketuk menu "Setor" di layar.',
      W / 2,
      385,
      W - 100,
      33
    );
    ctx.restore();

    // Phone mockup
    const px = 115;
    const py = 465 + (1 - enter) * 24;
    const pw = W - 230;
    const ph = 680;
    ctx.save();
    drawRoundedRect(ctx, px, py, pw, ph, 38);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1E293B';
    ctx.stroke();

    // Phone app header
    drawRoundedRect(ctx, px + 14, py + 16, pw - 28, 72, 22);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('Saldo & Simpanan Saya', px + 36, py + 58);

    // Balance card
    drawRoundedRect(ctx, px + 24, py + 106, pw - 48, 130, 22);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.fillStyle = '#FCD34D';
    ctx.font = `700 14px ${FONT_SANS}`;
    ctx.fillText('SALDO BERSIH SAYA', px + 44, py + 138);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 32px ${FONT_MONO}`;
    ctx.fillText('Rp 1.000.000', px + 44, py + 186);

    // Highlighted shortcut card "Setor Iuran / Angsuran"
    const pulse = 0.5 + 0.5 * Math.sin(localT * 6);
    drawRoundedRect(ctx, px + 24, py + 258, pw - 48, 108, 22);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 3 + pulse * 3;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();

    drawRoundedRect(ctx, px + 42, py + 282, 60, 60, 16);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 26px ${FONT_SANS}`;
    ctx.fillText('✓', px + 72, py + 321);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText('Setor Iuran / Angsuran', px + 118, py + 306);
    ctx.fillStyle = '#475569';
    ctx.font = `500 16px ${FONT_SANS}`;
    ctx.fillText('Kirim konfirmasi bayar ke pengurus', px + 118, py + 334);

    // Secondary card
    drawRoundedRect(ctx, px + 24, py + 382, pw - 48, 84, 20);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Ajukan Pinjaman', px + 46, py + 430);

    // Bottom Nav Bar inside phone
    drawRoundedRect(ctx, px + 14, py + ph - 92, pw - 28, 76, 22);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    const tabs = ['Saldo', 'Setor', 'Pinjam', 'Laporan', 'Akun'];
    const tabW = (pw - 28) / tabs.length;
    tabs.forEach((t, i) => {
      const tx = px + 14 + i * tabW + tabW / 2;
      const isSetor = t === 'Setor';
      if (isSetor) {
        drawRoundedRect(ctx, tx - 38, py + ph - 82, 76, 56, 16);
        ctx.fillStyle = '#EAF4EC';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#D98218';
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = isSetor ? '#1E5B2A' : '#64748B';
      ctx.font = `${isSetor ? '800' : '600'} 16px ${FONT_SANS}`;
      ctx.fillText(t, tx, py + ph - 46);
    });

    // Animated tap pointer on "Setor"
    ctx.beginPath();
    ctx.arc(px + 14 + tabW * 1.5, py + ph - 52, 24 + pulse * 14, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(217, 130, 24, ${0.85 - pulse * 0.45})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  } else if (sceneIdx === 2) {
    // SCENE 2: GABUNGAN 500rb = 100rb + 400rb
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 38px ${FONT_SANS}`;
    wrapText(ctx, 'Transfer Banyak Sekaligus? Pilih Tab Gabungan!', W / 2, 268, W - 90, 48);

    ctx.fillStyle = '#475569';
    ctx.font = `500 22px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Misal transfer Rp 500.000 sekaligus: sistem otomatis memisahkan iuran & angsuran.',
      W / 2,
      372,
      W - 96,
      32
    );
    ctx.restore();

    // Main Card
    const cx = 56;
    const cy = 452 + (1 - enter) * 20;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 690, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // 3 Tabs
    drawRoundedRect(ctx, cx + 28, cy + 28, cw - 56, 62, 16);
    ctx.fillStyle = '#F1F5F9';
    ctx.fill();
    const mTabs = ['Gabungan ✓', 'Iuran Saja', 'Angsuran'];
    const mTabW = (cw - 68) / 3;
    mTabs.forEach((mt, idx) => {
      const mx = cx + 34 + idx * mTabW;
      if (idx === 0) {
        drawRoundedRect(ctx, mx, cy + 34, mTabW, 50, 12);
        ctx.fillStyle = '#1E5B2A';
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = idx === 0 ? '#FFFFFF' : '#64748B';
      ctx.font = `700 20px ${FONT_SANS}`;
      ctx.fillText(mt, mx + mTabW / 2, cy + 66);
    });

    // Total Transfer Box
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Total Uang Ditransfer Sekaligus', cx + 32, cy + 138);

    drawRoundedRect(ctx, cx + 32, cy + 154, cw - 64, 78, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 34px ${FONT_MONO}`;
    ctx.fillText('Rp 500.000', cx + 52, cy + 204);

    // Split animation
    const splitAnim = easeOutCubic((localT - 0.7) / 0.7);
    ctx.save();
    ctx.globalAlpha = splitAnim;

    // Arrow down label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#D98218';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('▼  Otomatis Dibagi oleh Sistem  ▼', W / 2, cy + 275);

    // Split Box 1: Simpanan 100rb
    drawRoundedRect(ctx, cx + 32, cy + 302, cw - 64, 148, 22);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#166534';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('1. Porsi Iuran Wajib / Simpanan', cx + 56, cy + 344);
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 36px ${FONT_MONO}`;
    ctx.fillText('Rp 100.000', cx + 56, cy + 398);
    ctx.fillStyle = '#475569';
    ctx.font = `500 17px ${FONT_SANS}`;
    ctx.fillText('Bisa disesuaikan jika setor 2-3 bulan sekaligus', cx + 56, cy + 430);

    // Split Box 2: Angsuran 400rb
    drawRoundedRect(ctx, cx + 32, cy + 474, cw - 64, 174, 22);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    ctx.fillStyle = '#92400E';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('2. Sisa Otomatis Masuk Angsuran', cx + 56, cy + 518);
    ctx.fillStyle = '#B45309';
    ctx.font = `800 36px ${FONT_MONO}`;
    ctx.fillText('Rp 400.000', cx + 56, cy + 572);
    ctx.fillStyle = '#78350F';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('Langsung memotong sisa pinjaman Anda saat ACC!', cx + 56, cy + 612);
    ctx.restore();
  } else if (sceneIdx === 3) {
    // SCENE 3: TRANSFER SEABANK
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 40px ${FONT_SANS}`;
    wrapText(ctx, 'Metode 1: Transfer Bank SeaBank', W / 2, 275, W - 90, 50);

    ctx.fillStyle = '#475569';
    ctx.font = `500 23px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Pilih "Transfer Bank", rekening tujuan otomatis muncul dan tinggal salin.',
      W / 2,
      368,
      W - 96,
      33
    );
    ctx.restore();

    const cx = 56;
    const cy = 445 + (1 - enter) * 20;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 670, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // Method toggle showing Transfer active
    const halfW = (cw - 72) / 2;
    drawRoundedRect(ctx, cx + 28, cy + 28, halfW, 64, 16);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('Transfer Bank ✓', cx + 28 + halfW / 2, cy + 68);

    drawRoundedRect(ctx, cx + 44 + halfW, cy + 28, halfW, 64, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = `600 21px ${FONT_SANS}`;
    ctx.fillText('QRIS', cx + 44 + halfW + halfW / 2, cy + 68);

    // SeaBank Card
    drawRoundedRect(ctx, cx + 28, cy + 120, cw - 56, 360, 26);
    ctx.fillStyle = '#F4FAF5';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 18px ${FONT_SANS}`;
    ctx.fillText('REKENING TUJUAN TRANSFER', cx + 54, cy + 164);

    drawRoundedRect(ctx, cx + cw - 196, cy + 138, 140, 40, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText('SeaBank', cx + cw - 126, cy + 165);

    // Account Number white box
    drawRoundedRect(ctx, cx + 52, cy + 196, cw - 104, 132, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#BBF7D0';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('Nomor Rekening', cx + 74, cy + 234);

    ctx.fillStyle = '#0F172A';
    ctx.font = `800 40px ${FONT_MONO}`;
    ctx.fillText('901551447687', cx + 74, cy + 292);

    // Copy button animation
    const copiedPhase = localT > dur * 0.45;
    drawRoundedRect(ctx, cx + 52, cy + 354, cw - 104, 62, 16);
    ctx.fillStyle = copiedPhase ? '#059669' : '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText(copiedPhase ? '✓ Nomor Rekening Tersalin!' : 'Salin Nomor Rekening', W / 2, cy + 393);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `600 22px ${FONT_SANS}`;
    ctx.fillText('Atas Nama:', cx + 54, cy + 455);
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 24px ${FONT_SANS}`;
    ctx.fillText('Adi Supriyanto', cx + 188, cy + 455);

    // Tip box at bottom
    drawRoundedRect(ctx, cx + 28, cy + 510, cw - 56, 126, 20);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.font = `700 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Tips: Setelah transfer di SeaBank/m-Banking, tulis nama pengirim di kolom Keterangan.',
      W / 2,
      cy + 560,
      cw - 110,
      30
    );
  } else if (sceneIdx === 4) {
    // SCENE 4: QRIS
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 40px ${FONT_SANS}`;
    wrapText(ctx, 'Metode 2: Bayar Praktis via QRIS', W / 2, 275, W - 90, 50);

    ctx.fillStyle = '#475569';
    ctx.font = `500 22px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Pilih "QRIS", scan langsung atau klik Unduh QRIS untuk bayar dari galeri HP.',
      W / 2,
      368,
      W - 96,
      32
    );
    ctx.restore();

    const cx = 76;
    const cy = 445 + (1 - enter) * 20;
    const cw = W - 152;
    drawRoundedRect(ctx, cx, cy, cw, 690, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // QRIS image frame
    const imgBoxW = cw - 80;
    const imgBoxH = 510;
    const ix = cx + 40;
    const iy = cy + 32;
    drawRoundedRect(ctx, ix, iy, imgBoxW, imgBoxH, 22);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();

    if (qrisImg) {
      const ratio = qrisImg.width / qrisImg.height;
      let drawH = imgBoxH - 24;
      let drawW = drawH * ratio;
      if (drawW > imgBoxW - 24) {
        drawW = imgBoxW - 24;
        drawH = drawW / ratio;
      }
      ctx.drawImage(
        qrisImg,
        ix + (imgBoxW - drawW) / 2,
        iy + (imgBoxH - drawH) / 2,
        drawW,
        drawH
      );
    }

    // Animated green scan beam over QRIS
    const scanY = iy + 60 + ((Math.sin(localT * 2.5) + 1) / 2) * (imgBoxH - 120);
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 91, 42, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ix + 40, scanY);
    ctx.lineTo(ix + imgBoxW - 40, scanY);
    ctx.stroke();
    ctx.restore();

    // Buttons below QRIS
    const btnW = (cw - 96) / 2;
    drawRoundedRect(ctx, cx + 40, cy + 568, btnW, 64, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('Perbesar QRIS', cx + 40 + btnW / 2, cy + 607);

    drawRoundedRect(ctx, cx + 56 + btnW, cy + 568, btnW, 64, 16);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText('⬇ Unduh QRIS', cx + 56 + btnW + btnW / 2, cy + 607);
  } else {
    // SCENE 5: KIRIM & KONFIRMASI PENGURUS
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 38px ${FONT_SANS}`;
    wrapText(ctx, 'Terakhir: Kirim & Tunggu ACC Pengurus', W / 2, 275, W - 90, 48);

    ctx.fillStyle = '#475569';
    ctx.font = `500 22px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Saldo tidak langsung berubah sebelum dicek oleh Admin atau Bendahara agar pembukuan aman.',
      W / 2,
      374,
      W - 96,
      32
    );
    ctx.restore();

    const cards = [
      {
        num: '1',
        title: 'Anggota Kirim Konfirmasi',
        desc: 'Status tercatat: "Menunggu Konfirmasi" di riwayat Anda.',
        bg: '#FFFBEB',
        border: '#FCD34D',
        accent: '#B45309',
        delay: 0.1,
      },
      {
        num: '2',
        title: 'Admin / Bendahara Cek Mutasi',
        desc: 'Pengurus mencocokkan transfer SeaBank / QRIS lalu klik ACC.',
        bg: '#EAF4EC',
        border: '#86EFAC',
        accent: '#1E5B2A',
        delay: 0.65,
      },
      {
        num: '3',
        title: 'Saldo & Kwitansi Otomatis Masuk',
        desc: 'Simpanan bertambah, angsuran terpotong & info masuk Grup WA!',
        bg: '#ECFDF5',
        border: '#34D399',
        accent: '#047857',
        delay: 1.2,
      },
    ];

    cards.forEach((c, idx) => {
      const a = easeOutCubic((localT - c.delay) / 0.55);
      ctx.save();
      ctx.globalAlpha = a;
      const y = 468 + idx * 184 + (1 - a) * 20;
      drawRoundedRect(ctx, 56, y, W - 112, 154, 24);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      drawRoundedRect(ctx, 80, y + 42, 68, 68, 20);
      ctx.fillStyle = c.accent;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 30px ${FONT_SANS}`;
      ctx.fillText(c.num, 114, y + 87);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `800 24px ${FONT_SANS}`;
      ctx.fillText(c.title, 170, y + 66);

      ctx.fillStyle = '#475569';
      ctx.font = `500 20px ${FONT_SANS}`;
      wrapText(ctx, c.desc, 170, y + 102, W - 252, 27, 'left');
      ctx.restore();
    });

    // Closing CTA pill
    const ctaAnim = easeOutCubic((localT - 1.8) / 0.5);
    ctx.save();
    ctx.globalAlpha = ctaAnim;
    drawRoundedRect(ctx, 86, 1035, W - 172, 92, 24);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText('KSP SENTRA · BERSAMA MEMBANGUN UMAT', W / 2, 1075);
    ctx.fillStyle = '#D1FAE5';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('Transparan, Tertib, dan Mudah Dipantau dari HP', W / 2, 1106);
    ctx.restore();
  }

  drawFooterProgress(ctx, timeSec, sceneIdx);
}

function getPreferredVideoMimeType(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', ext: 'webm' };
  }
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: '', ext: 'webm' };
}

function scheduleBackgroundChimes(
  audioCtx: AudioContext,
  destination: AudioNode,
  startTime: number
) {
  // Pleasant soft pentatonic chord arpeggio across the 30-second video
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
  const triggerTimes = [
    0.1, 0.5, 0.9, 1.3,
    4.3, 4.7,
    8.9, 9.3, 9.7,
    14.5, 14.9,
    19.7, 20.1,
    24.7, 25.1, 25.5, 25.9,
  ];

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.14;
  masterGain.connect(destination);

  triggerTimes.forEach((offset, idx) => {
    const t = startTime + offset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[idx % notes.length], t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
  });
}

export const VideoPanduanModal: React.FC<VideoPanduanModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const qrisRef = useRef<HTMLImageElement | null>(null);
  const animRafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [assetsReady, setAssetsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [recordedVideo, setRecordedVideo] = useState<{
    url: string;
    blob: Blob;
    filename: string;
  } | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const waCaption = useMemo(
    () =>
      [
        '*PANDUAN CARA SETOR IURAN & ANGSURAN KSP SENTRA*',
        '',
        'Assalamu’alaikum / Selamat sejahtera Bapak/Ibu anggota KSP SENTRA.',
        'Berikut video singkat panduan setor iuran & bayar angsuran lewat aplikasi:',
        '1. Login aplikasi lalu pilih menu *Setor*.',
        '2. Jika transfer sekaligus (misal Rp 500.000), pilih tab *Gabungan* agar otomatis terbagi untuk Iuran Wajib (Rp 100.000) & Angsuran (Rp 400.000).',
        '3. Pilih metode *Transfer Bank (SeaBank 901551447687 a.n. Adi Supriyanto)* atau *QRIS*.',
        '4. Klik *Kirim Konfirmasi*, lalu tunggu persetujuan Admin/Bendahara.',
        '',
        'Terima kasih atas kedisiplinan dan kerja sama seluruh anggota.',
      ].join('\n'),
    []
  );

  // Load images on open
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    Promise.allSettled([loadImage(LOGO_SRC), loadImage(QRIS_SRC)]).then(([logoRes, qrisRes]) => {
      if (!active) return;
      logoRef.current = logoRes.status === 'fulfilled' ? logoRes.value : null;
      qrisRef.current = qrisRes.status === 'fulfilled' ? qrisRes.value : null;
      setAssetsReady(true);
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setIsPlaying(true);
      setIsRecording(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
    };
  }, [recordedVideo]);

  // Draw current frame whenever time updates or assets load
  useEffect(() => {
    if (!isOpen || !assetsReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderVideoFrame(ctx, currentTime, logoRef.current, qrisRef.current);
  }, [isOpen, assetsReady, currentTime]);

  // Preview playback loop (when not recording)
  useEffect(() => {
    if (!isOpen || !assetsReady || !isPlaying || isRecording) return;

    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        return next >= TOTAL_DURATION_SEC ? 0 : next;
      });
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    };
  }, [isOpen, assetsReady, isPlaying, isRecording]);

  const handleExportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecording) return;

    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      onNotify?.(
        'error',
        'Browser ini belum mendukung perekaman video otomatis. Gunakan Chrome/Edge versi terbaru.'
      );
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsPlaying(false);
    setIsRecording(true);
    setCurrentTime(0);

    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
      setRecordedVideo(null);
    }

    const { mimeType, ext } = getPreferredVideoMimeType();
    const videoStream = canvas.captureStream(30);
    const combinedTracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    let audioCtx: AudioContext | null = null;
    if (includeAudio && typeof AudioContext !== 'undefined') {
      try {
        audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();
        scheduleBackgroundChimes(audioCtx, dest, audioCtx.currentTime + 0.1);
        dest.stream.getAudioTracks().forEach((t) => combinedTracks.push(t));
      } catch {
        // Fallback to video-only if AudioContext blocked
      }
    }

    const finalStream = new MediaStream(combinedTracks);
    const chunks: BlobPart[] = [];
    const recorder = mimeType
      ? new MediaRecorder(finalStream, { mimeType, videoBitsPerSecond: 3_500_000 })
      : new MediaRecorder(finalStream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const filename = `Panduan-Setor-KSP-SENTRA.${ext}`;
      setRecordedVideo({ url, blob, filename });
      setIsRecording(false);
      setIsPlaying(false);

      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      // Auto-trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onNotify?.('success', `Video presentasi (${filename}) selesai dibuat dan diunduh!`);
    };

    recorder.start(250);
    const startMs = performance.now();

    const recordFrame = (now: number) => {
      const elapsedSec = (now - startMs) / 1000;
      if (elapsedSec >= TOTAL_DURATION_SEC) {
        renderVideoFrame(ctx, TOTAL_DURATION_SEC - 0.01, logoRef.current, qrisRef.current);
        setCurrentTime(TOTAL_DURATION_SEC);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }
      renderVideoFrame(ctx, elapsedSec, logoRef.current, qrisRef.current);
      setCurrentTime(elapsedSec);
      animRafRef.current = requestAnimationFrame(recordFrame);
    };

    animRafRef.current = requestAnimationFrame(recordFrame);
  }, [isRecording, includeAudio, recordedVideo, onNotify]);

  const handleCancelRecording = () => {
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsPlaying(false);
  };

  if (!isOpen) return null;

  const activeSceneIdx = Math.max(
    0,
    SCENES.findIndex((s) => currentTime >= s.startSec && currentTime < s.endSec)
  );
  const progressPct = Math.round(clamp01(currentTime / TOTAL_DURATION_SEC) * 100);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-[#103D1B] via-[#1B5727] to-[#287336] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Film className="h-5 w-5 text-amber-300" />
            </span>
            <div>
              <h3 className="text-sm font-bold sm:text-base">
                Studio Video Presentasi · Cara Setor Anggota
              </h3>
              <p className="text-[11px] text-emerald-100">
                Format Vertikal 9:16 (30 detik) siap bagikan ke Grup WhatsApp Anggota
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isRecording) handleCancelRecording();
              onClose();
            }}
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15 hover:text-white"
            aria-label="Tutup studio video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-12">
          {/* Canvas Video Preview */}
          <div className="flex flex-col items-center lg:col-span-5">
            <div className="relative w-full max-w-[290px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900 shadow-lg">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="block aspect-[9/16] h-auto w-full"
              />
              {isRecording && (
                <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-xl bg-red-600/95 px-3 py-1.5 text-xs font-bold text-white shadow-md">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    Merekam Video...
                  </span>
                  <span className="font-mono">{progressPct}%</span>
                </div>
              )}
            </div>

            {/* Playback Controls */}
            <div className="mt-3 flex w-full max-w-[290px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E5B2A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#154620] disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? 'Jeda' : 'Putar'}
              </button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() => {
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ulang
              </button>
              <span className="font-mono text-xs font-semibold text-slate-600">
                {currentTime.toFixed(0)}s / {TOTAL_DURATION_SEC}s
              </span>
            </div>
          </div>

          {/* Right Controls & Scene Navigator */}
          <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Babak Presentasi (Klik untuk Loncat)
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {SCENES.map((sc, idx) => {
                    const active = idx === activeSceneIdx;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={isRecording}
                        onClick={() => {
                          setCurrentTime(sc.startSec + 0.05);
                          setIsPlaying(true);
                        }}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:opacity-60 ${
                          active
                            ? 'border-[#1E5B2A] bg-[#EAF4EC] text-[#1E5B2A]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{sc.title}</span>
                        <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-400">
                          {sc.startSec.toFixed(0)}s
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-[#F4FAF5] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeAudio}
                      disabled={isRecording}
                      onChange={(e) => setIncludeAudio(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#1E5B2A]"
                    />
                    {includeAudio ? (
                      <Volume2 className="h-4 w-4 text-[#1E5B2A]" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-slate-400" />
                    )}
                    Sertakan Efek Suara Transisi Halus
                  </label>
                  <span className="text-[11px] text-slate-500">Durasi: 30 detik (720×1280)</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2.5">
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={handleCancelRecording}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                      Batalkan Proses Render ({progressPct}%)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExportVideo}
                      disabled={!assetsReady}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#154620] disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Buat &amp; Unduh Video Presentasi (30 dtk)
                    </button>
                  )}
                </div>

                {recordedVideo && !isRecording && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-300 bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#1E5B2A]">
                        Video siap: {recordedVideo.filename}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Ukuran: {(recordedVideo.blob.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <a
                      href={recordedVideo.url}
                      download={recordedVideo.filename}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh Lagi
                    </a>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const file = new File([recordedVideo.blob], recordedVideo.filename, {
                              type: recordedVideo.blob.type || 'video/mp4',
                            });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                title: 'Panduan Setor KSP SENTRA',
                                text: waCaption,
                                files: [file],
                              });
                              return;
                            }
                            onNotify?.(
                              'error',
                              'Perangkat belum mendukung share file langsung. Kirim file yang sudah terunduh lewat WhatsApp.'
                            );
                          } catch (err) {
                            if ((err as { name?: string })?.name !== 'AbortError') {
                              onNotify?.('error', 'Gagal membuka menu berbagi sistem.');
                            }
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Bagikan Video
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Companion WhatsApp Caption */}
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800">
                    Teks Pengantar WhatsApp (Pendamping Video)
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(waCaption);
                      setCopiedCaption(true);
                      setTimeout(() => setCopiedCaption(false), 2000);
                      onNotify?.('success', 'Teks pengantar WhatsApp disalin!');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#1E5B2A]" />
                        Salin Teks
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 font-sans text-[11px] leading-relaxed text-slate-700">
                  {waCaption}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
