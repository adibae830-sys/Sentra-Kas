import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

export type VideoTopic = 'setor' | 'pinjaman';

interface VideoPanduanModalProps {
  isOpen: boolean;
  initialTopic?: VideoTopic;
  onClose: () => void;
  onNotify?: (type: 'success' | 'error', message: string) => void;
}

interface BaseSceneDef {
  id: number;
  title: string;
  defaultDurationSec: number;
  narrationText: string;
}

interface TimelineScene extends BaseSceneDef {
  startSec: number;
  endSec: number;
  durationSec: number;
}

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;

const LOGO_SRC = '/assets/aistudio/image_1d167c98.png';
const QRIS_SRC = '/assets/aistudio/image_e0eba57e.png';

const FONT_SANS =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

const SETOR_SCENES: BaseSceneDef[] = [
  {
    id: 0,
    title: 'Intro KSP SENTRA',
    defaultDurationSec: 5.5,
    narrationText:
      'Halo Bapak dan Ibu anggota KSP SENTRA. Berikut panduan mudah cara setor iuran dan bayar angsuran langsung dari HP.',
  },
  {
    id: 1,
    title: '1. Buka Menu Setor',
    defaultDurationSec: 5.8,
    narrationText:
      'Pertama, silakan masuk ke akun Anda, lalu ketuk menu Setor di halaman utama atau di bagian bawah layar.',
  },
  {
    id: 2,
    title: '2. Tab Gabungan (500rb)',
    defaultDurationSec: 7.5,
    narrationText:
      'Jika transfer sekaligus, misalnya lima ratus ribu rupiah, pilih tab Gabungan. Sistem otomatis membagi seratus ribu iuran wajib dan empat ratus ribu angsuran.',
  },
  {
    id: 3,
    title: '3A. Transfer SeaBank',
    defaultDurationSec: 7.2,
    narrationText:
      'Untuk transfer bank, pilih Transfer Bank. Rekening SeaBank tujuan atas nama Adi Supriyanto akan muncul otomatis dan tinggal disalin.',
  },
  {
    id: 4,
    title: '3B. Scan / Unduh QRIS',
    defaultDurationSec: 6.2,
    narrationText:
      'Atau pilih metode QRIS, lalu scan langsung kode QR yang tampil, atau tekan Unduh QRIS untuk bayar lewat galeri HP.',
  },
  {
    id: 5,
    title: '4. ACC Pengurus & Saldo',
    defaultDurationSec: 7.0,
    narrationText:
      'Terakhir, tekan Kirim Konfirmasi dan tunggu persetujuan Admin atau Bendahara. Setelah di-ACC, saldo dan angsuran Anda otomatis tercatat.',
  },
];

const PINJAMAN_SCENES: BaseSceneDef[] = [
  {
    id: 0,
    title: 'Intro Pengajuan Pinjaman',
    defaultDurationSec: 5.5,
    narrationText:
      'Halo Bapak dan Ibu anggota KSP SENTRA. Berikut panduan singkat cara mengajukan pinjaman langsung dari aplikasi.',
  },
  {
    id: 1,
    title: '1. Buka Menu Pinjam',
    defaultDurationSec: 5.8,
    narrationText:
      'Pertama, setelah login ke akun anggota, ketuk menu Pinjam di bagian bawah layar atau pilih kartu Ajukan Pinjaman.',
  },
  {
    id: 2,
    title: '2. Isi Jumlah & Tenor',
    defaultDurationSec: 6.6,
    narrationText:
      'Kedua, masukkan jumlah pinjaman yang dibutuhkan dan lama tenor dalam bulan. Estimasi angsuran per bulan langsung tampil otomatis.',
  },
  {
    id: 3,
    title: '3. Kirim & Status Menunggu',
    defaultDurationSec: 6.2,
    narrationText:
      'Ketiga, periksa kembali rincian nominalnya lalu tekan Kirim Pengajuan Pinjaman. Pengajuan Anda masuk antrean dengan status Menunggu.',
  },
  {
    id: 4,
    title: '4. Verifikasi & ACC Pengurus',
    defaultDurationSec: 6.8,
    narrationText:
      'Keempat, Admin atau Bendahara akan memeriksa kelayakan dan saldo kas kelompok sebelum menyetujui serta mencairkan dana pinjaman.',
  },
  {
    id: 5,
    title: '5. Pantau & Bayar Angsuran',
    defaultDurationSec: 6.8,
    narrationText:
      'Setelah di-ACC pengurus, status berubah menjadi Berjalan di Fasilitas Pinjaman Saya. Angsuran bulanan nanti dibayar lewat menu Setor.',
  },
];

function buildTimeline(
  topic: VideoTopic,
  voiceDurations: Record<number, number>
): { scenes: TimelineScene[]; totalDurationSec: number } {
  const baseList = topic === 'setor' ? SETOR_SCENES : PINJAMAN_SCENES;
  let cursor = 0;
  const scenes: TimelineScene[] = baseList.map((b) => {
    const clipDur = voiceDurations[b.id];
    const durationSec = clipDur
      ? Math.max(b.defaultDurationSec, Math.ceil((clipDur + 0.9) * 10) / 10)
      : b.defaultDurationSec;
    const startSec = cursor;
    const endSec = cursor + durationSec;
    cursor = endSec;
    return {
      ...b,
      startSec,
      endSec,
      durationSec,
    };
  });
  return { scenes, totalDurationSec: cursor };
}

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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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

  const hdrGrad = ctx.createLinearGradient(0, 0, W, 200);
  hdrGrad.addColorStop(0, '#103D1B');
  hdrGrad.addColorStop(1, '#1E5B2A');
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(0, 0, W, 174);

  ctx.fillStyle = 'rgba(252, 211, 77, 0.16)';
  ctx.fillRect(0, 168, W, 6);
}

function drawHeaderBrand(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  stepLabel: string
) {
  const W = CANVAS_WIDTH;
  ctx.save();
  drawRoundedRect(ctx, 44, 42, 68, 68, 16);
  ctx.fillStyle = '#F7F5EE';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(252, 211, 77, 0.75)';
  ctx.stroke();
  drawRoundedRect(ctx, 47, 45, 62, 62, 14);
  ctx.clip();
  if (logoImg) {
    ctx.drawImage(logoImg, 47, 45, 62, 62);
  }
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 28px ${FONT_SANS}`;
  ctx.fillText('KSP SENTRA', 128, 74);

  ctx.fillStyle = '#D1FAE5';
  ctx.font = `500 17px ${FONT_SANS}`;
  ctx.fillText('Bersama Membangun Umat', 128, 102);

  ctx.save();
  ctx.font = `800 18px ${FONT_SANS}`;
  const pillW = Math.max(185, ctx.measureText(stepLabel).width + 42);
  const pillX = W - 44 - pillW;
  drawRoundedRect(ctx, pillX, 52, pillW, 46, 23);
  ctx.fillStyle = '#FCD34D';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#103D1B';
  ctx.fillText(stepLabel, pillX + pillW / 2, 81);
  ctx.restore();
}

function drawCaptionOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  darkScene: boolean
) {
  const W = CANVAS_WIDTH;
  const boxX = 44;
  const boxY = 1062;
  const boxW = W - 88;
  const boxH = 110;

  ctx.save();
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fillStyle = darkScene ? 'rgba(6, 26, 11, 0.72)' : 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = darkScene ? 'rgba(252, 211, 77, 0.4)' : 'rgba(30, 91, 42, 0.4)';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 19px ${FONT_SANS}`;
  wrapText(ctx, text, W / 2, boxY + 34, boxW - 44, 26, 'center');
  ctx.restore();
}

function drawFooterProgress(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  totalDurationSec: number,
  activeSceneIdx: number,
  sceneCount: number,
  topicLabel: string,
  darkScene: boolean
) {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const pct = clamp01(timeSec / Math.max(totalDurationSec, 1));

  ctx.save();
  ctx.fillStyle = darkScene ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.1)';
  drawRoundedRect(ctx, 44, H - 46, W - 88, 12, 6);
  ctx.fill();

  ctx.fillStyle = darkScene ? '#FCD34D' : '#1E5B2A';
  drawRoundedRect(ctx, 44, H - 46, Math.max(12, (W - 88) * pct), 12, 6);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = darkScene ? '#D1FAE5' : '#64748B';
  ctx.font = `600 17px ${FONT_SANS}`;
  ctx.fillText(`Bagian ${activeSceneIdx + 1} dari ${sceneCount}`, 44, H - 64);

  ctx.textAlign = 'right';
  ctx.fillStyle = darkScene ? '#FCD34D' : '#1E5B2A';
  ctx.font = `700 17px ${FONT_SANS}`;
  ctx.fillText(topicLabel, W - 44, H - 64);
  ctx.restore();
}

function renderSetorFrame(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  scenes: TimelineScene[],
  totalDurationSec: number,
  logoImg: HTMLImageElement | null,
  qrisImg: HTMLImageElement | null
) {
  const W = CANVAS_WIDTH;
  const foundIdx = scenes.findIndex((s) => timeSec >= s.startSec && timeSec < s.endSec);
  const sceneIdx = foundIdx >= 0 ? foundIdx : scenes.length - 1;
  const currentScene = scenes[sceneIdx];
  const localT = Math.max(0, timeSec - currentScene.startSec);
  const dur = currentScene.durationSec;
  const enter = easeOutCubic(localT / 0.55);

  if (sceneIdx === 0) {
    drawBackground(ctx, timeSec, true);

    const logoScale = 0.88 + 0.12 * enter;
    const logoSize = 200 * logoScale;
    const lx = W / 2 - logoSize / 2;
    const ly = 136 + (1 - enter) * 24;

    ctx.save();
    ctx.globalAlpha = enter;
    drawRoundedRect(ctx, lx - 12, ly - 12, logoSize + 24, logoSize + 24, 38);
    ctx.fillStyle = '#F7F5EE';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    drawRoundedRect(ctx, lx, ly, logoSize, logoSize, 28);
    ctx.clip();
    if (logoImg) {
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = easeOutCubic((localT - 0.3) / 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('VIDEO PANDUAN ANGGOTA', W / 2, 405);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 44px ${FONT_SANS}`;
    wrapText(ctx, 'Cara Setor Iuran & Bayar Angsuran', W / 2, 470, W - 96, 56);

    ctx.fillStyle = '#D1FAE5';
    ctx.font = `500 23px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Transfer SeaBank atau QRIS dari HP, lalu diverifikasi Admin & Bendahara.',
      W / 2,
      608,
      W - 110,
      33
    );
    ctx.restore();

    const pills = [
      '✓ Bisa 1x Transfer Gabungan',
      '✓ Rekening SeaBank & QRIS Resmi',
      '✓ Aman Dicek Admin / Bendahara',
    ];
    pills.forEach((p, idx) => {
      const pAnim = easeOutCubic((localT - 0.75 - idx * 0.25) / 0.45);
      ctx.save();
      ctx.globalAlpha = pAnim;
      const py = 740 + idx * 78 + (1 - pAnim) * 16;
      drawRoundedRect(ctx, 106, py, W - 212, 56, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(252, 211, 77, 0.48)';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 22px ${FONT_SANS}`;
      ctx.fillText(p, W / 2, py + 36);
      ctx.restore();
    });

    drawCaptionOverlay(ctx, currentScene.narrationText, true);
    drawFooterProgress(
      ctx,
      timeSec,
      totalDurationSec,
      sceneIdx,
      scenes.length,
      'Panduan Setor Anggota',
      true
    );
    return;
  }

  drawBackground(ctx, timeSec, false);
  const stepTags = ['', 'LANGKAH 1', 'LANGKAH 2', 'LANGKAH 3A', 'LANGKAH 3B', 'LANGKAH 4'];
  drawHeaderBrand(ctx, logoImg, stepTags[sceneIdx] || 'PANDUAN');

  if (sceneIdx === 1) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 36px ${FONT_SANS}`;
    wrapText(ctx, 'Masuk Akun & Pilih Menu Setor', W / 2, 238, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 21px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Login dengan Username & Password Anda, lalu ketuk menu "Setor".',
      W / 2,
      332,
      W - 96,
      29
    );
    ctx.restore();

    const px = 115;
    const py = 412 + (1 - enter) * 20;
    const pw = W - 230;
    const ph = 618;
    ctx.save();
    drawRoundedRect(ctx, px, py, pw, ph, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1E293B';
    ctx.stroke();

    drawRoundedRect(ctx, px + 14, py + 16, pw - 28, 66, 20);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Saldo & Simpanan Saya', px + 36, py + 55);

    drawRoundedRect(ctx, px + 24, py + 98, pw - 48, 120, 20);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.fillStyle = '#FCD34D';
    ctx.font = `700 14px ${FONT_SANS}`;
    ctx.fillText('SALDO BERSIH SAYA', px + 44, py + 128);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText('Rp 1.000.000', px + 44, py + 174);

    const pulse = 0.5 + 0.5 * Math.sin(localT * 6);
    drawRoundedRect(ctx, px + 24, py + 236, pw - 48, 102, 20);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 3 + pulse * 3;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();

    drawRoundedRect(ctx, px + 42, py + 258, 58, 58, 15);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 24px ${FONT_SANS}`;
    ctx.fillText('✓', px + 71, py + 296);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('Setor Iuran / Angsuran', px + 116, py + 282);
    ctx.fillStyle = '#475569';
    ctx.font = `500 15px ${FONT_SANS}`;
    ctx.fillText('Kirim konfirmasi bayar ke pengurus', px + 116, py + 308);

    drawRoundedRect(ctx, px + 24, py + 356, pw - 48, 76, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('Ajukan Pinjaman', px + 46, py + 400);

    drawRoundedRect(ctx, px + 14, py + ph - 86, pw - 28, 70, 20);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    const tabs = ['Saldo', 'Setor', 'Pinjam', 'Laporan', 'Akun'];
    const tabW = (pw - 28) / tabs.length;
    tabs.forEach((t, i) => {
      const tx = px + 14 + i * tabW + tabW / 2;
      const isSetor = t === 'Setor';
      if (isSetor) {
        drawRoundedRect(ctx, tx - 36, py + ph - 78, 72, 54, 15);
        ctx.fillStyle = '#EAF4EC';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#D98218';
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = isSetor ? '#1E5B2A' : '#64748B';
      ctx.font = `${isSetor ? '800' : '600'} 15px ${FONT_SANS}`;
      ctx.fillText(t, tx, py + ph - 44);
    });

    ctx.beginPath();
    ctx.arc(px + 14 + tabW * 1.5, py + ph - 50, 22 + pulse * 13, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(217, 130, 24, ${0.85 - pulse * 0.45})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  } else if (sceneIdx === 2) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Transfer Banyak Sekaligus? Pilih Tab Gabungan!', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Misal transfer Rp 500.000 sekaligus: sistem otomatis memisahkan iuran & angsuran.',
      W / 2,
      332,
      W - 96,
      28
    );
    ctx.restore();

    const cx = 56;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    drawRoundedRect(ctx, cx + 28, cy + 24, cw - 56, 58, 15);
    ctx.fillStyle = '#F1F5F9';
    ctx.fill();
    const mTabs = ['Gabungan ✓', 'Iuran Saja', 'Angsuran'];
    const mTabW = (cw - 68) / 3;
    mTabs.forEach((mt, idx) => {
      const mx = cx + 34 + idx * mTabW;
      if (idx === 0) {
        drawRoundedRect(ctx, mx, cy + 30, mTabW, 46, 12);
        ctx.fillStyle = '#1E5B2A';
        ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = idx === 0 ? '#FFFFFF' : '#64748B';
      ctx.font = `700 19px ${FONT_SANS}`;
      ctx.fillText(mt, mx + mTabW / 2, cy + 60);
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('Total Uang Ditransfer Sekaligus', cx + 32, cy + 124);

    drawRoundedRect(ctx, cx + 32, cy + 140, cw - 64, 72, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 32px ${FONT_MONO}`;
    ctx.fillText('Rp 500.000', cx + 52, cy + 187);

    const splitAnim = easeOutCubic((localT - 0.65) / 0.7);
    ctx.save();
    ctx.globalAlpha = splitAnim;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#D98218';
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText('▼  Otomatis Dibagi oleh Sistem  ▼', W / 2, cy + 250);

    drawRoundedRect(ctx, cx + 32, cy + 274, cw - 64, 142, 20);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#166534';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('1. Porsi Iuran Wajib / Simpanan', cx + 54, cy + 314);
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 34px ${FONT_MONO}`;
    ctx.fillText('Rp 100.000', cx + 54, cy + 364);
    ctx.fillStyle = '#475569';
    ctx.font = `500 16px ${FONT_SANS}`;
    ctx.fillText('Bisa disesuaikan jika setor 2-3 bulan sekaligus', cx + 54, cy + 396);

    drawRoundedRect(ctx, cx + 32, cy + 436, cw - 64, 152, 20);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    ctx.fillStyle = '#92400E';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('2. Sisa Otomatis Masuk Angsuran', cx + 54, cy + 476);
    ctx.fillStyle = '#B45309';
    ctx.font = `800 34px ${FONT_MONO}`;
    ctx.fillText('Rp 400.000', cx + 54, cy + 528);
    ctx.fillStyle = '#78350F';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText('Langsung memotong sisa pinjaman Anda saat ACC!', cx + 54, cy + 564);
    ctx.restore();
  } else if (sceneIdx === 3) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 36px ${FONT_SANS}`;
    wrapText(ctx, 'Metode 1: Transfer Bank SeaBank', W / 2, 238, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 21px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Pilih "Transfer Bank", nomor rekening tujuan otomatis tampil dan siap disalin.',
      W / 2,
      328,
      W - 96,
      29
    );
    ctx.restore();

    const cx = 56;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    const halfW = (cw - 72) / 2;
    drawRoundedRect(ctx, cx + 28, cy + 24, halfW, 58, 15);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText('Transfer Bank ✓', cx + 28 + halfW / 2, cy + 60);

    drawRoundedRect(ctx, cx + 44 + halfW, cy + 24, halfW, 58, 15);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = `600 20px ${FONT_SANS}`;
    ctx.fillText('QRIS', cx + 44 + halfW + halfW / 2, cy + 60);

    drawRoundedRect(ctx, cx + 28, cy + 106, cw - 56, 348, 24);
    ctx.fillStyle = '#F4FAF5';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 17px ${FONT_SANS}`;
    ctx.fillText('REKENING TUJUAN TRANSFER', cx + 52, cy + 148);

    drawRoundedRect(ctx, cx + cw - 190, cy + 124, 134, 38, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 19px ${FONT_SANS}`;
    ctx.fillText('SeaBank', cx + cw - 123, cy + 150);

    drawRoundedRect(ctx, cx + 52, cy + 180, cw - 104, 124, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#BBF7D0';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText('Nomor Rekening', cx + 72, cy + 216);

    ctx.fillStyle = '#0F172A';
    ctx.font = `800 38px ${FONT_MONO}`;
    ctx.fillText('901551447687', cx + 72, cy + 272);

    const copiedPhase = localT > dur * 0.45;
    drawRoundedRect(ctx, cx + 52, cy + 326, cw - 104, 58, 15);
    ctx.fillStyle = copiedPhase ? '#059669' : '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText(copiedPhase ? '✓ Nomor Rekening Tersalin!' : 'Salin Nomor Rekening', W / 2, cy + 362);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `600 20px ${FONT_SANS}`;
    ctx.fillText('Atas Nama:', cx + 52, cy + 428);
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText('Adi Supriyanto', cx + 178, cy + 428);

    drawRoundedRect(ctx, cx + 28, cy + 474, cw - 56, 118, 18);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.font = `700 19px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Tips: Setelah transfer di SeaBank/m-Banking, tulis nama pengirim di kolom Keterangan.',
      W / 2,
      cy + 522,
      cw - 110,
      28
    );
  } else if (sceneIdx === 4) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 36px ${FONT_SANS}`;
    wrapText(ctx, 'Metode 2: Bayar Praktis via QRIS', W / 2, 238, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 21px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Pilih "QRIS", scan langsung atau tekan Unduh QRIS untuk bayar dari galeri HP.',
      W / 2,
      328,
      W - 96,
      29
    );
    ctx.restore();

    const cx = 76;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 152;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    const imgBoxW = cw - 80;
    const imgBoxH = 472;
    const ix = cx + 40;
    const iy = cy + 28;
    drawRoundedRect(ctx, ix, iy, imgBoxW, imgBoxH, 20);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();

    if (qrisImg) {
      const ratio = qrisImg.width / qrisImg.height;
      let drawH = imgBoxH - 22;
      let drawW = drawH * ratio;
      if (drawW > imgBoxW - 22) {
        drawW = imgBoxW - 22;
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

    const scanY = iy + 55 + ((Math.sin(localT * 2.5) + 1) / 2) * (imgBoxH - 110);
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 91, 42, 0.72)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ix + 40, scanY);
    ctx.lineTo(ix + imgBoxW - 40, scanY);
    ctx.stroke();
    ctx.restore();

    const btnW = (cw - 96) / 2;
    drawRoundedRect(ctx, cx + 40, cy + 524, btnW, 62, 15);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Perbesar QRIS', cx + 40 + btnW / 2, cy + 562);

    drawRoundedRect(ctx, cx + 56 + btnW, cy + 524, btnW, 62, 15);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 19px ${FONT_SANS}`;
    ctx.fillText('⬇ Unduh QRIS', cx + 56 + btnW + btnW / 2, cy + 562);
  } else {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Terakhir: Kirim & Tunggu ACC Pengurus', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Saldo tidak langsung berubah sebelum dicek Admin / Bendahara agar pembukuan aman.',
      W / 2,
      328,
      W - 96,
      28
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
      const y = 416 + idx * 164 + (1 - a) * 18;
      drawRoundedRect(ctx, 56, y, W - 112, 142, 22);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      drawRoundedRect(ctx, 78, y + 38, 64, 64, 18);
      ctx.fillStyle = c.accent;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 28px ${FONT_SANS}`;
      ctx.fillText(c.num, 110, y + 81);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `800 23px ${FONT_SANS}`;
      ctx.fillText(c.title, 162, y + 60);

      ctx.fillStyle = '#475569';
      ctx.font = `500 19px ${FONT_SANS}`;
      wrapText(ctx, c.desc, 162, y + 94, W - 242, 26, 'left');
      ctx.restore();
    });

    const ctaAnim = easeOutCubic((localT - 1.7) / 0.5);
    ctx.save();
    ctx.globalAlpha = ctaAnim;
    drawRoundedRect(ctx, 76, 922, W - 152, 92, 22);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('KSP SENTRA · BERSAMA MEMBANGUN UMAT', W / 2, 962);
    ctx.fillStyle = '#D1FAE5';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('Transparan, Tertib, dan Mudah Dipantau dari HP', W / 2, 993);
    ctx.restore();
  }

  drawCaptionOverlay(ctx, currentScene.narrationText, false);
  drawFooterProgress(
    ctx,
    timeSec,
    totalDurationSec,
    sceneIdx,
    scenes.length,
    'Panduan Setor Anggota',
    false
  );
}

function renderPinjamanFrame(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  scenes: TimelineScene[],
  totalDurationSec: number,
  logoImg: HTMLImageElement | null
) {
  const W = CANVAS_WIDTH;
  const foundIdx = scenes.findIndex((s) => timeSec >= s.startSec && timeSec < s.endSec);
  const sceneIdx = foundIdx >= 0 ? foundIdx : scenes.length - 1;
  const currentScene = scenes[sceneIdx];
  const localT = Math.max(0, timeSec - currentScene.startSec);
  const dur = currentScene.durationSec;
  const enter = easeOutCubic(localT / 0.55);

  if (sceneIdx === 0) {
    drawBackground(ctx, timeSec, true);

    const logoScale = 0.88 + 0.12 * enter;
    const logoSize = 200 * logoScale;
    const lx = W / 2 - logoSize / 2;
    const ly = 136 + (1 - enter) * 24;

    ctx.save();
    ctx.globalAlpha = enter;
    drawRoundedRect(ctx, lx - 12, ly - 12, logoSize + 24, logoSize + 24, 38);
    ctx.fillStyle = '#F7F5EE';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    drawRoundedRect(ctx, lx, ly, logoSize, logoSize, 28);
    ctx.clip();
    if (logoImg) {
      ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = easeOutCubic((localT - 0.3) / 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('VIDEO PANDUAN ANGGOTA', W / 2, 405);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 44px ${FONT_SANS}`;
    wrapText(ctx, 'Cara Pengajuan Pinjaman Anggota', W / 2, 470, W - 96, 56);

    ctx.fillStyle = '#D1FAE5';
    ctx.font = `500 23px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Ajukan pinjaman langsung dari HP, hitung estimasi cicilan otomatis, hingga cair.',
      W / 2,
      608,
      W - 110,
      33
    );
    ctx.restore();

    const pills = [
      '✓ Pengajuan Praktis dari Menu Pinjam',
      '✓ Hitung Estimasi Angsuran Otomatis',
      '✓ Dicek & Disetujui (ACC) Pengurus',
    ];
    pills.forEach((p, idx) => {
      const pAnim = easeOutCubic((localT - 0.75 - idx * 0.25) / 0.45);
      ctx.save();
      ctx.globalAlpha = pAnim;
      const py = 740 + idx * 78 + (1 - pAnim) * 16;
      drawRoundedRect(ctx, 100, py, W - 200, 56, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(252, 211, 77, 0.48)';
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 22px ${FONT_SANS}`;
      ctx.fillText(p, W / 2, py + 36);
      ctx.restore();
    });

    drawCaptionOverlay(ctx, currentScene.narrationText, true);
    drawFooterProgress(
      ctx,
      timeSec,
      totalDurationSec,
      sceneIdx,
      scenes.length,
      'Panduan Pengajuan Pinjaman',
      true
    );
    return;
  }

  drawBackground(ctx, timeSec, false);
  const stepTags = ['', 'LANGKAH 1', 'LANGKAH 2', 'LANGKAH 3', 'LANGKAH 4', 'LANGKAH 5'];
  drawHeaderBrand(ctx, logoImg, stepTags[sceneIdx] || 'PANDUAN');

  if (sceneIdx === 1) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 36px ${FONT_SANS}`;
    wrapText(ctx, 'Masuk Akun & Pilih Menu Pinjam', W / 2, 238, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 21px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Ketuk tombol "Ajukan Pinjaman" atau tab "Pinjam" di menu bagian bawah.',
      W / 2,
      332,
      W - 96,
      29
    );
    ctx.restore();

    const px = 115;
    const py = 412 + (1 - enter) * 20;
    const pw = W - 230;
    const ph = 618;
    ctx.save();
    drawRoundedRect(ctx, px, py, pw, ph, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1E293B';
    ctx.stroke();

    drawRoundedRect(ctx, px + 14, py + 16, pw - 28, 66, 20);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Saldo & Simpanan Saya', px + 36, py + 55);

    drawRoundedRect(ctx, px + 24, py + 98, pw - 48, 120, 20);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.fillStyle = '#FCD34D';
    ctx.font = `700 14px ${FONT_SANS}`;
    ctx.fillText('TOTAL SIMPANAN SAYA', px + 44, py + 128);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText('Rp 3.000.000', px + 44, py + 174);

    drawRoundedRect(ctx, px + 24, py + 236, pw - 48, 76, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('Setor Iuran / Angsuran', px + 46, py + 280);

    // Highlighted Ajukan Pinjaman card
    const pulse = 0.5 + 0.5 * Math.sin(localT * 6);
    drawRoundedRect(ctx, px + 24, py + 328, pw - 48, 102, 20);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 3 + pulse * 3;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();

    drawRoundedRect(ctx, px + 42, py + 350, 58, 58, 15);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 22px ${FONT_SANS}`;
    ctx.fillText('Rp', px + 71, py + 387);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('Ajukan Pinjaman', px + 116, py + 374);
    ctx.fillStyle = '#475569';
    ctx.font = `500 15px ${FONT_SANS}`;
    ctx.fillText('Kirim pengajuan baru ke pengurus', px + 116, py + 400);

    drawRoundedRect(ctx, px + 14, py + ph - 86, pw - 28, 70, 20);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    const tabs = ['Saldo', 'Setor', 'Pinjam', 'Laporan', 'Akun'];
    const tabW = (pw - 28) / tabs.length;
    tabs.forEach((t, i) => {
      const tx = px + 14 + i * tabW + tabW / 2;
      const isPinjam = t === 'Pinjam';
      if (isPinjam) {
        drawRoundedRect(ctx, tx - 38, py + ph - 78, 76, 54, 15);
        ctx.fillStyle = '#EAF4EC';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#D98218';
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = isPinjam ? '#1E5B2A' : '#64748B';
      ctx.font = `${isPinjam ? '800' : '600'} 15px ${FONT_SANS}`;
      ctx.fillText(t, tx, py + ph - 44);
    });

    ctx.beginPath();
    ctx.arc(px + 14 + tabW * 2.5, py + ph - 50, 22 + pulse * 13, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(217, 130, 24, ${0.85 - pulse * 0.45})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  } else if (sceneIdx === 2) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Isi Jumlah Pinjaman & Tenor Bulan', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Sistem otomatis menghitung perkiraan angsuran bulanan agar cicilan terasa ringan.',
      W / 2,
      328,
      W - 96,
      28
    );
    ctx.restore();

    const cx = 56;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 24px ${FONT_SANS}`;
    ctx.fillText('Form Pengajuan Pinjaman Anggota', cx + 34, cy + 52);
    ctx.fillStyle = '#64748B';
    ctx.font = `500 17px ${FONT_SANS}`;
    ctx.fillText('Contoh simulasi pengajuan Rp 2.000.000 untuk 10 bulan', cx + 34, cy + 82);

    // Input 1
    ctx.fillStyle = '#334155';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('Jumlah Pinjaman (Rp)', cx + 34, cy + 132);
    drawRoundedRect(ctx, cx + 34, cy + 148, cw - 68, 72, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1E5B2A';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 32px ${FONT_MONO}`;
    ctx.fillText('Rp 2.000.000', cx + 56, cy + 196);

    // Input 2
    ctx.fillStyle = '#334155';
    ctx.font = `700 18px ${FONT_SANS}`;
    ctx.fillText('Tenor (Jumlah Bulan Angsuran)', cx + 34, cy + 260);
    drawRoundedRect(ctx, cx + 34, cy + 276, cw - 68, 72, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#94A3B8';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText('10 Bulan', cx + 56, cy + 324);

    // Estimasi box reveal
    const estAnim = easeOutCubic((localT - 0.65) / 0.65);
    ctx.save();
    ctx.globalAlpha = estAnim;
    drawRoundedRect(ctx, cx + 34, cy + 382, cw - 68, 132, 20);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.fillStyle = '#166534';
    ctx.font = `700 19px ${FONT_SANS}`;
    ctx.fillText('Estimasi Angsuran / Bulan (Otomatis)', cx + 56, cy + 422);

    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 36px ${FONT_MONO}`;
    ctx.fillText('Rp 200.000 / bulan', cx + 56, cy + 474);

    ctx.fillStyle = '#475569';
    ctx.font = `600 16px ${FONT_SANS}`;
    ctx.fillText('Dihitung otomatis: Rp 2.000.000 ÷ 10 bulan', cx + 56, cy + 502);
    ctx.restore();

    drawRoundedRect(ctx, cx + 34, cy + 536, cw - 68, 56, 15);
    ctx.fillStyle = '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 20px ${FONT_SANS}`;
    ctx.fillText('Kirim Pengajuan Pinjaman', W / 2, cy + 571);
  } else if (sceneIdx === 3) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Kirim Pengajuan & Cek Konfirmasi', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Setelah klik Kirim, pengajuan tercatat aman dengan status Menunggu persetujuan.',
      W / 2,
      328,
      W - 96,
      28
    );
    ctx.restore();

    const cx = 56;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    // Summary dialog card
    drawRoundedRect(ctx, cx + 34, cy + 32, cw - 68, 286, 22);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 23px ${FONT_SANS}`;
    ctx.fillText('Kirim Pengajuan Pinjaman?', cx + 60, cy + 78);

    ctx.fillStyle = '#475569';
    ctx.font = `500 18px ${FONT_SANS}`;
    ctx.fillText('Rincian pengajuan Anda siap dikirim ke Administrator:', cx + 60, cy + 112);

    const rows = [
      ['Plafon Pinjaman', 'Rp 2.000.000'],
      ['Tenor', '10 Bulan'],
      ['Angsuran / Bulan', 'Rp 200.000'],
    ];
    rows.forEach(([label, val], idx) => {
      const ry = cy + 152 + idx * 46;
      ctx.fillStyle = '#64748B';
      ctx.font = `600 18px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.fillText(label, cx + 60, ry);
      ctx.fillStyle = '#0F172A';
      ctx.font = `800 19px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(val, cx + cw - 60, ry);
    });

    const sentPhase = localT > dur * 0.42;
    drawRoundedRect(ctx, cx + 60, cy + 252, cw - 120, 48, 14);
    ctx.fillStyle = sentPhase ? '#059669' : '#1E5B2A';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 19px ${FONT_SANS}`;
    ctx.fillText(sentPhase ? '✓ Pengajuan Terkirim!' : 'Kirim Pengajuan', W / 2, cy + 283);

    // Status Card below
    const statusAnim = easeOutCubic((localT - 0.8) / 0.6);
    ctx.save();
    ctx.globalAlpha = statusAnim;
    drawRoundedRect(ctx, cx + 34, cy + 344, cw - 68, 240, 22);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FCD34D';
    ctx.stroke();

    drawRoundedRect(ctx, cx + 58, cy + 372, 236, 40, 20);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 17px ${FONT_SANS}`;
    ctx.fillText('STATUS: MENUNGGU ACC', cx + 176, cy + 398);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#78350F';
    ctx.font = `700 20px ${FONT_SANS}`;
    ctx.fillText('Masuk Antrean Administrator', cx + 58, cy + 448);

    ctx.fillStyle = '#92400E';
    ctx.font = `500 18px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Dana belum dicairkan dan kewajiban angsuran belum berjalan sebelum disetujui (ACC) pengurus.',
      cx + 58,
      cy + 486,
      cw - 116,
      27,
      'left'
    );
    ctx.restore();
  } else if (sceneIdx === 4) {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Verifikasi & Pencairan oleh Pengurus', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Admin dan Bendahara meninjau pengajuan demi keamanan kas seluruh kelompok.',
      W / 2,
      328,
      W - 96,
      28
    );
    ctx.restore();

    const cards = [
      {
        num: '1',
        title: 'Tinjau Kelayakan Anggota',
        desc: 'Pengurus mengecek data anggota, nominal pinjaman & tenor cicilan.',
        bg: '#FFFBEB',
        border: '#FCD34D',
        accent: '#B45309',
        delay: 0.1,
      },
      {
        num: '2',
        title: 'Cek Saldo Kas Kelompok',
        desc: 'Memastikan kas kelompok mencukupi untuk pencairan pinjaman.',
        bg: '#EAF4EC',
        border: '#86EFAC',
        accent: '#1E5B2A',
        delay: 0.65,
      },
      {
        num: '3',
        title: 'ACC & Dana Dicairkan',
        desc: 'Otomatis tercatat sebagai Kas Keluar & info masuk ke Grup WA.',
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
      const y = 416 + idx * 164 + (1 - a) * 18;
      drawRoundedRect(ctx, 56, y, W - 112, 142, 22);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.border;
      ctx.stroke();

      drawRoundedRect(ctx, 78, y + 38, 64, 64, 18);
      ctx.fillStyle = c.accent;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 28px ${FONT_SANS}`;
      ctx.fillText(c.num, 110, y + 81);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `800 23px ${FONT_SANS}`;
      ctx.fillText(c.title, 162, y + 60);

      ctx.fillStyle = '#475569';
      ctx.font = `500 19px ${FONT_SANS}`;
      wrapText(ctx, c.desc, 162, y + 94, W - 242, 26, 'left');
      ctx.restore();
    });

    const badgeAnim = easeOutCubic((localT - 1.7) / 0.5);
    ctx.save();
    ctx.globalAlpha = badgeAnim;
    drawRoundedRect(ctx, 76, 922, W - 152, 92, 22);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('STATUS: MENUNGGU  →  ✓ BERJALAN (CAIR)', W / 2, 962);
    ctx.fillStyle = '#D1FAE5';
    ctx.font = `600 18px ${FONT_SANS}`;
    ctx.fillText('Tercatat rapi & transparan di pembukuan KSP SENTRA', W / 2, 993);
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 35px ${FONT_SANS}`;
    wrapText(ctx, 'Pantau Pinjaman & Bayar Angsuran', W / 2, 234, W - 90, 44);

    ctx.fillStyle = '#475569';
    ctx.font = `500 20px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Sisa pinjaman tampil di beranda Anda. Bayar angsuran bulanan cukup lewat menu Setor.',
      W / 2,
      328,
      W - 96,
      28
    );
    ctx.restore();

    const cx = 56;
    const cy = 412 + (1 - enter) * 18;
    const cw = W - 112;
    drawRoundedRect(ctx, cx, cy, cw, 620, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = `800 24px ${FONT_SANS}`;
    ctx.fillText('Fasilitas Pinjaman Saya', cx + 34, cy + 54);

    // Active loan item card
    drawRoundedRect(ctx, cx + 34, cy + 84, cw - 68, 226, 20);
    ctx.fillStyle = '#F8FAF8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText('Rp 2.000.000', cx + 56, cy + 132);

    drawRoundedRect(ctx, cx + cw - 190, cy + 104, 134, 38, 19);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 17px ${FONT_SANS}`;
    ctx.fillText('● Berjalan', cx + cw - 123, cy + 129);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText('Tenor 10 Bulan · Angsuran Rp 200.000 / bln', cx + 56, cy + 170);

    drawRoundedRect(ctx, cx + 56, cy + 196, (cw - 124) / 2, 88, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.fillText('Total Dibayar', cx + 74, cy + 226);
    ctx.fillStyle = '#059669';
    ctx.font = `800 22px ${FONT_MONO}`;
    ctx.fillText('Rp 400.000', cx + 74, cy + 262);

    const rightBoxX = cx + 68 + (cw - 124) / 2;
    drawRoundedRect(ctx, rightBoxX, cy + 196, (cw - 124) / 2, 88, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.fillStyle = '#64748B';
    ctx.font = `600 15px ${FONT_SANS}`;
    ctx.fillText('Sisa Pinjaman', rightBoxX + 18, cy + 226);
    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 22px ${FONT_MONO}`;
    ctx.fillText('Rp 1.600.000', rightBoxX + 18, cy + 262);

    // Next step tip
    drawRoundedRect(ctx, cx + 34, cy + 338, cw - 68, 146, 20);
    ctx.fillStyle = '#EAF4EC';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#86EFAC';
    ctx.stroke();

    ctx.fillStyle = '#1E5B2A';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('Cara Bayar Cicilan Bulanan:', cx + 56, cy + 378);
    ctx.fillStyle = '#334155';
    ctx.font = `500 18px ${FONT_SANS}`;
    wrapText(
      ctx,
      'Buka menu Setor → pilih tab Gabungan (Iuran + Angsuran) → transfer SeaBank / QRIS → tunggu ACC.',
      cx + 56,
      cy + 414,
      cw - 112,
      27,
      'left'
    );

    drawRoundedRect(ctx, cx + 34, cy + 506, cw - 68, 86, 20);
    ctx.fillStyle = '#103D1B';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = `800 21px ${FONT_SANS}`;
    ctx.fillText('KSP SENTRA · BERSAMA MEMBANGUN UMAT', W / 2, cy + 544);
    ctx.fillStyle = '#D1FAE5';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText('Mudah Ajukan, Jelas Cicilannya, Aman Pembukuannya', W / 2, cy + 573);
  }

  drawCaptionOverlay(ctx, currentScene.narrationText, false);
  drawFooterProgress(
    ctx,
    timeSec,
    totalDurationSec,
    sceneIdx,
    scenes.length,
    'Panduan Pengajuan Pinjaman',
    false
  );
}

function renderVideoFrame(
  ctx: CanvasRenderingContext2D,
  topic: VideoTopic,
  timeSec: number,
  scenes: TimelineScene[],
  totalDurationSec: number,
  logoImg: HTMLImageElement | null,
  qrisImg: HTMLImageElement | null
) {
  if (topic === 'setor') {
    renderSetorFrame(ctx, timeSec, scenes, totalDurationSec, logoImg, qrisImg);
  } else {
    renderPinjamanFrame(ctx, timeSec, scenes, totalDurationSec, logoImg);
  }
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
  startTime: number,
  scenes: TimelineScene[],
  softForVoice: boolean
) {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = softForVoice ? 0.055 : 0.14;
  masterGain.connect(destination);

  scenes.forEach((sc, sIdx) => {
    const offsets = sIdx === 0 ? [0.05, 0.35] : [0.05];
    offsets.forEach((off, nIdx) => {
      const t = startTime + sc.startSec + off;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[(sIdx + nIdx) % notes.length], t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.32, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  });
}

function speakBrowserFemaleFallback(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'id-ID';
    utter.rate = 0.96;
    utter.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const idVoice =
      voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('id') &&
          /female|wanita|gadis|damayanti|arin|google bahasa/i.test(v.name)
      ) || voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utter.voice = idVoice;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore browser speech fallback errors
  }
}

function stopBrowserSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export const VideoPanduanModal: React.FC<VideoPanduanModalProps> = ({
  isOpen,
  initialTopic = 'setor',
  onClose,
  onNotify,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const qrisRef = useRef<HTMLImageElement | null>(null);
  const animRafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const exportAudioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastSpokenSceneRef = useRef<string>('');

  // Stores raw WAV ArrayBuffers per `${topic}:${sceneId}`
  const voiceRawCacheRef = useRef<Map<string, { wavBytes: ArrayBuffer; durationSec: number }>>(
    new Map()
  );

  const [topic, setTopic] = useState<VideoTopic>(initialTopic);
  const [assetsReady, setAssetsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeFemaleVoice, setIncludeFemaleVoice] = useState(true);

  const [voiceDurationsByTopic, setVoiceDurationsByTopic] = useState<
    Record<VideoTopic, Record<number, number>>
  >({
    setor: {},
    pinjaman: {},
  });
  const [voiceLoading, setVoiceLoading] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 6 });
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [recordedVideo, setRecordedVideo] = useState<{
    url: string;
    blob: Blob;
    filename: string;
    topic: VideoTopic;
  } | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const { scenes, totalDurationSec } = useMemo(
    () => buildTimeline(topic, voiceDurationsByTopic[topic] || {}),
    [topic, voiceDurationsByTopic]
  );

  const voiceReadyForTopic = useMemo(() => {
    const baseList = topic === 'setor' ? SETOR_SCENES : PINJAMAN_SCENES;
    return baseList.every((s) => voiceRawCacheRef.current.has(`${topic}:${s.id}`));
  }, [topic, voiceDurationsByTopic]);

  const waCaption = useMemo(() => {
    if (topic === 'pinjaman') {
      return [
        '*PANDUAN CARA PENGAJUAN PINJAMAN KSP SENTRA*',
        '',
        'Assalamu’alaikum / Selamat sejahtera Bapak/Ibu anggota KSP SENTRA.',
        'Berikut video singkat panduan cara mengajukan pinjaman melalui aplikasi:',
        '1. Login aplikasi lalu pilih menu *Pinjam* / *Ajukan Pinjaman*.',
        '2. Masukkan *Jumlah Pinjaman* dan *Tenor (Bulan)* — estimasi angsuran per bulan langsung tampil otomatis.',
        '3. Klik *Kirim Pengajuan Pinjaman* (status tercatat *Menunggu* ACC Administrator).',
        '4. Setelah disetujui & dicairkan pengurus, status berubah menjadi *Berjalan* dan cicilan dibayar lewat menu *Setor*.',
        '',
        'Terima kasih atas kerja sama seluruh anggota KSP SENTRA.',
      ].join('\n');
    }

    return [
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
    ].join('\n');
  }, [topic]);

  const stopPreviewVoice = useCallback(() => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {
        // already stopped
      }
      previewSourceRef.current.disconnect();
      previewSourceRef.current = null;
    }
    stopBrowserSpeech();
    lastSpokenSceneRef.current = '';
  }, []);

  const ensureVoiceClipsForTopic = useCallback(
    async (targetTopic: VideoTopic): Promise<boolean> => {
      const baseList = targetTopic === 'setor' ? SETOR_SCENES : PINJAMAN_SCENES;
      const missing = baseList.filter(
        (s) => !voiceRawCacheRef.current.has(`${targetTopic}:${s.id}`)
      );

      if (missing.length === 0) {
        setVoiceError(null);
        return true;
      }

      setVoiceError(null);
      setVoiceLoading({
        active: true,
        done: baseList.length - missing.length,
        total: baseList.length,
      });

      let tempCtx: AudioContext | null = null;
      try {
        if (typeof AudioContext !== 'undefined') {
          tempCtx = new AudioContext();
        }
        const durationsUpdate: Record<number, number> = {};

        for (const sc of missing) {
          const res = await fetch('/api/tts/narrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: sc.narrationText,
              voiceName: 'Kore',
              cacheKey: `${targetTopic}_v1_s${sc.id}`,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            audioBase64?: string;
            error?: string;
          };
          if (!res.ok || !data.audioBase64) {
            throw new Error(data.error || `Gagal membuat suara wanita (HTTP ${res.status}).`);
          }

          const wavBytes = base64ToArrayBuffer(data.audioBase64);
          let durationSec = sc.defaultDurationSec - 0.9;
          if (tempCtx) {
            const decoded = await tempCtx.decodeAudioData(wavBytes.slice(0));
            durationSec = decoded.duration;
          }

          voiceRawCacheRef.current.set(`${targetTopic}:${sc.id}`, {
            wavBytes,
            durationSec,
          });
          durationsUpdate[sc.id] = durationSec;

          setVoiceLoading((prev) => ({
            ...prev,
            done: Math.min(prev.total, prev.done + 1),
          }));
        }

        setVoiceDurationsByTopic((prev) => ({
          ...prev,
          [targetTopic]: {
            ...prev[targetTopic],
            ...durationsUpdate,
          },
        }));
        setVoiceLoading({ active: false, done: baseList.length, total: baseList.length });
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Gagal membuat suara panduan wanita.';
        setVoiceError(msg);
        setVoiceLoading({ active: false, done: 0, total: baseList.length });
        return false;
      } finally {
        if (tempCtx) {
          tempCtx.close().catch(() => {});
        }
      }
    },
    []
  );

  // Sync initial topic when modal opens
  useEffect(() => {
    if (isOpen) {
      setTopic(initialTopic);
      setCurrentTime(0);
      setIsPlaying(true);
      setVoiceError(null);
      stopPreviewVoice();
    }
  }, [isOpen, initialTopic, stopPreviewVoice]);

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

  // Auto-prepare Indonesian female voiceover when modal opens or topic switches
  useEffect(() => {
    if (!isOpen || !includeFemaleVoice) return;
    ensureVoiceClipsForTopic(topic);
  }, [isOpen, topic, includeFemaleVoice, ensureVoiceClipsForTopic]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (exportAudioCtxRef.current) {
        exportAudioCtxRef.current.close().catch(() => {});
        exportAudioCtxRef.current = null;
      }
      stopPreviewVoice();
      if (previewAudioCtxRef.current) {
        previewAudioCtxRef.current.close().catch(() => {});
        previewAudioCtxRef.current = null;
      }
      setIsPlaying(false);
      setIsRecording(false);
      setCurrentTime(0);
    }
  }, [isOpen, stopPreviewVoice]);

  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
    };
  }, [recordedVideo]);

  // Draw current frame whenever time, topic, or assets update
  useEffect(() => {
    if (!isOpen || !assetsReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderVideoFrame(
      ctx,
      topic,
      currentTime,
      scenes,
      totalDurationSec,
      logoRef.current,
      qrisRef.current
    );
  }, [isOpen, assetsReady, topic, currentTime, scenes, totalDurationSec]);

  // Live preview playback loop
  useEffect(() => {
    if (!isOpen || !assetsReady || !isPlaying || isRecording) return;

    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setCurrentTime((prev) => {
        const next = prev + dt;
        return next >= totalDurationSec ? 0 : next;
      });
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    };
  }, [isOpen, assetsReady, isPlaying, isRecording, totalDurationSec]);

  // Play scene narration audio in live preview when scene changes
  const activeSceneIdx = useMemo(() => {
    const idx = scenes.findIndex((s) => currentTime >= s.startSec && currentTime < s.endSec);
    return idx >= 0 ? idx : scenes.length - 1;
  }, [scenes, currentTime]);

  useEffect(() => {
    if (!isOpen || !isPlaying || isRecording || !includeFemaleVoice) {
      if (!isPlaying || !includeFemaleVoice) {
        stopPreviewVoice();
      }
      return;
    }

    const activeScene = scenes[activeSceneIdx];
    if (!activeScene) return;
    const sceneKey = `${topic}:${activeScene.id}`;
    if (lastSpokenSceneRef.current === sceneKey) return;
    lastSpokenSceneRef.current = sceneKey;

    const cached = voiceRawCacheRef.current.get(sceneKey);
    if (cached && typeof AudioContext !== 'undefined') {
      (async () => {
        try {
          if (previewSourceRef.current) {
            try {
              previewSourceRef.current.stop();
            } catch {
              // ignore
            }
            previewSourceRef.current.disconnect();
            previewSourceRef.current = null;
          }
          if (!previewAudioCtxRef.current || previewAudioCtxRef.current.state === 'closed') {
            previewAudioCtxRef.current = new AudioContext();
          }
          const ctx = previewAudioCtxRef.current;
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
          const audioBuf = await ctx.decodeAudioData(cached.wavBytes.slice(0));
          if (lastSpokenSceneRef.current !== sceneKey) return;
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          src.start();
          previewSourceRef.current = src;
        } catch {
          // Ignore autoplay restriction before user gesture
        }
      })();
    } else if (voiceError) {
      speakBrowserFemaleFallback(activeScene.narrationText);
    }
  }, [
    isOpen,
    isPlaying,
    isRecording,
    includeFemaleVoice,
    topic,
    activeSceneIdx,
    scenes,
    voiceError,
    stopPreviewVoice,
    voiceReadyForTopic,
  ]);

  const handleSelectTopic = (nextTopic: VideoTopic) => {
    if (isRecording || nextTopic === topic) return;
    stopPreviewVoice();
    setTopic(nextTopic);
    setCurrentTime(0);
    setIsPlaying(true);
    setVoiceError(null);
  };

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

    stopPreviewVoice();
    setIsPlaying(false);

    // Ensure female voiceover clips are ready before starting the recorder
    let useVoiceInExport = includeFemaleVoice;
    let exportScenes = scenes;
    let exportTotalDur = totalDurationSec;

    if (useVoiceInExport) {
      const ok = await ensureVoiceClipsForTopic(topic);
      if (ok) {
        const durationsMap: Record<number, number> = {};
        const baseList = topic === 'setor' ? SETOR_SCENES : PINJAMAN_SCENES;
        baseList.forEach((s) => {
          const item = voiceRawCacheRef.current.get(`${topic}:${s.id}`);
          if (item) durationsMap[s.id] = item.durationSec;
        });
        const rebuilt = buildTimeline(topic, durationsMap);
        exportScenes = rebuilt.scenes;
        exportTotalDur = rebuilt.totalDurationSec;
      } else {
        useVoiceInExport = false;
      }
    }

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
    let audioStartTime = 0;

    if ((includeAudio || useVoiceInExport) && typeof AudioContext !== 'undefined') {
      try {
        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume().catch(() => {});
        }
        exportAudioCtxRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();
        audioStartTime = audioCtx.currentTime + 0.12;

        if (includeAudio) {
          scheduleBackgroundChimes(audioCtx, dest, audioStartTime, exportScenes, useVoiceInExport);
        }

        if (useVoiceInExport) {
          const voiceGain = audioCtx.createGain();
          voiceGain.gain.value = 1.05;
          voiceGain.connect(dest);

          for (const sc of exportScenes) {
            const raw = voiceRawCacheRef.current.get(`${topic}:${sc.id}`);
            if (!raw) continue;
            const decoded = await audioCtx.decodeAudioData(raw.wavBytes.slice(0));
            const src = audioCtx.createBufferSource();
            src.buffer = decoded;
            src.connect(voiceGain);
            src.start(audioStartTime + sc.startSec + 0.25);
          }
        }

        dest.stream.getAudioTracks().forEach((t) => combinedTracks.push(t));
      } catch {
        // Fallback if AudioContext creation fails
      }
    }

    const finalStream = new MediaStream(combinedTracks);
    const chunks: BlobPart[] = [];
    const recorder = mimeType
      ? new MediaRecorder(finalStream, { mimeType, videoBitsPerSecond: 3_500_000 })
      : new MediaRecorder(finalStream);
    recorderRef.current = recorder;

    const targetFilename =
      topic === 'pinjaman'
        ? `Panduan-Pinjaman-KSP-SENTRA.${ext}`
        : `Panduan-Setor-KSP-SENTRA.${ext}`;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideo({ url, blob, filename: targetFilename, topic });
      setIsRecording(false);
      setIsPlaying(false);

      if (exportAudioCtxRef.current) {
        exportAudioCtxRef.current.close().catch(() => {});
        exportAudioCtxRef.current = null;
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onNotify?.(
        'success',
        useVoiceInExport
          ? `Video bersuara wanita (${targetFilename}) selesai dibuat & diunduh!`
          : `Video presentasi (${targetFilename}) selesai dibuat & diunduh!`
      );
    };

    recorder.start(250);
    const startMs = performance.now();

    const recordFrame = (now: number) => {
      const elapsedSec =
        audioCtx && audioStartTime > 0
          ? Math.max(0, audioCtx.currentTime - audioStartTime)
          : (now - startMs) / 1000;

      if (elapsedSec >= exportTotalDur) {
        renderVideoFrame(
          ctx,
          topic,
          exportTotalDur - 0.01,
          exportScenes,
          exportTotalDur,
          logoRef.current,
          qrisRef.current
        );
        setCurrentTime(exportTotalDur);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }

      renderVideoFrame(
        ctx,
        topic,
        elapsedSec,
        exportScenes,
        exportTotalDur,
        logoRef.current,
        qrisRef.current
      );
      setCurrentTime(elapsedSec);
      animRafRef.current = requestAnimationFrame(recordFrame);
    };

    animRafRef.current = requestAnimationFrame(recordFrame);
  }, [
    isRecording,
    includeAudio,
    includeFemaleVoice,
    topic,
    scenes,
    totalDurationSec,
    recordedVideo,
    stopPreviewVoice,
    ensureVoiceClipsForTopic,
    onNotify,
  ]);

  const handleCancelRecording = () => {
    if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    if (exportAudioCtxRef.current) {
      exportAudioCtxRef.current.close().catch(() => {});
      exportAudioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsPlaying(false);
  };

  if (!isOpen) return null;

  const progressPct = Math.round(clamp01(currentTime / Math.max(totalDurationSec, 1)) * 100);

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
                Studio Video Presentasi · Suara Panduan Wanita
              </h3>
              <p className="text-[11px] text-emerald-100">
                Format Vertikal 9:16 lengkap dengan narasi suara wanita Indonesia &amp; teks panduan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isRecording) handleCancelRecording();
              stopPreviewVoice();
              onClose();
            }}
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15 hover:text-white"
            aria-label="Tutup studio video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Topic Switcher Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#F8FAF8] px-5 py-2.5">
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <button
              type="button"
              disabled={isRecording}
              onClick={() => handleSelectTopic('setor')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                topic === 'setor'
                  ? 'bg-[#1E5B2A] text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              1. Panduan Cara Setor &amp; Angsuran
            </button>
            <button
              type="button"
              disabled={isRecording}
              onClick={() => handleSelectTopic('pinjaman')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                topic === 'pinjaman'
                  ? 'bg-[#1E5B2A] text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              2. Panduan Pengajuan Pinjaman
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {voiceLoading.active ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyiapkan suara wanita ({voiceLoading.done}/{voiceLoading.total})...
              </span>
            ) : voiceReadyForTopic ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                <Mic className="h-3.5 w-3.5" />
                Suara Panduan Wanita Siap
              </span>
            ) : null}
          </div>
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
                    Merekam Video + Suara...
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
                onClick={() => {
                  if (isPlaying) {
                    stopPreviewVoice();
                  } else {
                    lastSpokenSceneRef.current = '';
                  }
                  setIsPlaying((p) => !p);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E5B2A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#154620] disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? 'Jeda' : 'Putar'}
              </button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() => {
                  stopPreviewVoice();
                  setCurrentTime(0);
                  setIsPlaying(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Ulang
              </button>
              <span className="font-mono text-xs font-semibold text-slate-600">
                {currentTime.toFixed(0)}s / {totalDurationSec.toFixed(0)}s
              </span>
            </div>
          </div>

          {/* Right Controls & Scene Navigator */}
          <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Babak Presentasi (Klik untuk Loncat &amp; Dengarkan Suara)
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {scenes.map((sc, idx) => {
                    const active = idx === activeSceneIdx;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={isRecording}
                        onClick={() => {
                          stopPreviewVoice();
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

              {/* Active scene narration script preview */}
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                <p className="text-[11px] font-bold tracking-wide text-[#1E5B2A] uppercase">
                  Teks Suara Wanita · {scenes[activeSceneIdx]?.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  “{scenes[activeSceneIdx]?.narrationText}”
                </p>
              </div>

              {voiceError && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="min-w-0 flex-1">{voiceError}</p>
                  <button
                    type="button"
                    disabled={voiceLoading.active}
                    onClick={() => ensureVoiceClipsForTopic(topic)}
                    className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    Coba Muat Suara
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-emerald-200 bg-[#F4FAF5] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={includeFemaleVoice}
                      disabled={isRecording}
                      onChange={(e) => setIncludeFemaleVoice(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#1E5B2A]"
                    />
                    <Mic
                      className={`h-4 w-4 ${
                        includeFemaleVoice ? 'text-[#1E5B2A]' : 'text-slate-400'
                      }`}
                    />
                    Sertakan Suara Panduan Wanita
                  </label>

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
                    Efek Suara Transisi
                  </label>
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
                      disabled={!assetsReady || voiceLoading.active}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E5B2A] px-4 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#154620] disabled:opacity-50"
                    >
                      {voiceLoading.active ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {voiceLoading.active
                        ? `Menyiapkan Suara Wanita (${voiceLoading.done}/${voiceLoading.total})...`
                        : `Buat & Unduh Video ${
                            topic === 'pinjaman' ? 'Pinjaman' : 'Setor'
                          } (${totalDurationSec.toFixed(0)} dtk)`}
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
                                title:
                                  recordedVideo.topic === 'pinjaman'
                                    ? 'Panduan Pengajuan Pinjaman KSP SENTRA'
                                    : 'Panduan Setor KSP SENTRA',
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
