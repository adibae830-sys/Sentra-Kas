import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

type WhatsAppProvider = 'fonnte' | 'wablas' | 'meta' | 'webhook' | 'telegram';

interface RecipientPayload {
  idAnggota: string;
  nama: string;
  nohp: string;
  message: string;
}

function isWhatsAppGroupTarget(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  return (
    trimmed.includes('@g.us') ||
    /^\d+-\d+$/.test(trimmed) ||
    /^-\d+$/.test(trimmed) ||
    trimmed.startsWith('@')
  );
}

function normalizeWaNumber(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.includes('@g.us') ||
    trimmed.includes('@c.us') ||
    trimmed.includes('@s.whatsapp.net') ||
    /^-\d+$/.test(trimmed) ||
    trimmed.startsWith('@')
  ) {
    return trimmed;
  }
  if (/^\d+-\d+$/.test(trimmed)) {
    return `${trimmed}@g.us`;
  }
  let num = trimmed.replace(/\D/g, '');
  if (!num) return '';
  if (num.startsWith('0')) {
    num = '62' + num.slice(1);
  } else if (!num.startsWith('62')) {
    num = '62' + num;
  }
  return num;
}

function cleanEnv(val: string | undefined): string {
  const trimmed = (val || '').trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
}

function getGatewayConfig() {
  const provider = (cleanEnv(process.env.WHATSAPP_PROVIDER) || 'fonnte').toLowerCase() as WhatsAppProvider;
  const apiToken = cleanEnv(process.env.WHATSAPP_API_TOKEN);
  const apiUrl = cleanEnv(process.env.WHATSAPP_API_URL);
  const webhookUrl = cleanEnv(process.env.WHATSAPP_WEBHOOK_URL);
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const telegramBotToken = cleanEnv(process.env.TELEGRAM_BOT_TOKEN);
  const defaultGroupId =
    cleanEnv(process.env.WHATSAPP_GROUP_ID) || cleanEnv(process.env.TELEGRAM_CHAT_ID);

  const isConfigured =
    (provider === 'telegram' && Boolean(telegramBotToken)) ||
    (provider === 'webhook' && Boolean(webhookUrl)) ||
    (provider === 'meta' && Boolean(apiToken && phoneNumberId)) ||
    ((provider === 'fonnte' || provider === 'wablas') && Boolean(apiToken));

  return {
    provider,
    apiToken,
    apiUrl,
    webhookUrl,
    phoneNumberId,
    telegramBotToken,
    defaultGroupId,
    isConfigured,
  };
}

function formatTelegramHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/_([^_\n]+)_/g, '<i>$1</i>');
}

async function dispatchWhatsAppMessage(phone: string, message: string) {
  const cfg = getGatewayConfig();
  const rawInput = phone === 'GROUP' ? cfg.defaultGroupId : phone;
  const target = normalizeWaNumber(rawInput);
  const isGroup = isWhatsAppGroupTarget(target);

  if (!target || (!isGroup && target.length < 10)) {
    return {
      success: false,
      error: isGroup
        ? 'ID Grup tidak valid.'
        : 'Nomor HP atau ID Grup tidak valid.',
    };
  }

  if (!cfg.isConfigured) {
    return {
      success: false,
      error: 'Gateway notifikasi server belum dikonfigurasi pada environment variables.',
    };
  }

  if (cfg.provider === 'telegram') {
    const endpoint = `https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: target,
        text: formatTelegramHtml(message),
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return {
        success: false,
        error: data?.description || `Telegram HTTP ${res.status}`,
      };
    }
    return { success: true, detail: data };
  }

  if (cfg.provider === 'fonnte') {
    const endpoint = cfg.apiUrl || 'https://api.fonnte.com/send';
    const formData = new URLSearchParams();
    formData.append('target', target);
    formData.append('message', message);
    if (!isGroup) {
      formData.append('countryCode', '62');
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: cfg.apiToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status === false) {
      return { success: false, error: data?.reason || data?.message || `HTTP ${res.status}` };
    }
    return { success: true, detail: data };
  }

  if (cfg.provider === 'wablas') {
    const endpoint = cfg.apiUrl || 'https://solo.wablas.com/api/send-message';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: cfg.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: target,
        message,
        ...(isGroup ? { isGroup: true } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status === false) {
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { success: true, detail: data };
  }

  if (cfg.provider === 'meta') {
    if (isGroup) {
      return {
        success: false,
        error:
          'Meta WhatsApp Cloud API tidak mendukung pengiriman langsung ke Grup WA. Gunakan Fonnte, Wablas, Webhook, atau mode Bagikan ke Grup WA.',
      };
    }
    const endpoint =
      cfg.apiUrl || `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: target,
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data?.error?.message || `HTTP ${res.status}`,
      };
    }
    return { success: true, detail: data };
  }

  // Generic webhook
  const res = await fetch(cfg.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiToken ? { Authorization: `Bearer ${cfg.apiToken}` } : {}),
    },
    body: JSON.stringify({
      phone: target,
      isGroup,
      message,
      sentAt: new Date().toISOString(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: `Webhook HTTP ${res.status}` };
  }
  return { success: true, detail: data };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'sentra-kas-server' });
  });

  app.get('/api/whatsapp/status', (_req, res) => {
    const cfg = getGatewayConfig();
    res.json({
      configured: cfg.isConfigured,
      provider: cfg.provider,
      hasDefaultGroup: Boolean(cfg.defaultGroupId),
    });
  });

  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { nohp, message } = req.body as { nohp?: string; message?: string };
      if (!nohp || !message) {
        return res.status(400).json({ success: false, error: 'Nomor HP dan pesan wajib diisi.' });
      }
      const result = await dispatchWhatsAppMessage(nohp, message);
      if (!result.success) {
        return res.status(422).json(result);
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Gagal mengirim pesan WhatsApp',
      });
    }
  });

  // Scheduled End-of-Month Auto-Broadcast state (in-memory for active server instance)
  let monthlySchedule: {
    enabled: boolean;
    hour: number;
    lastDispatchedPeriod: string;
    recipients: RecipientPayload[];
  } = {
    enabled: false,
    hour: 19,
    lastDispatchedPeriod: '',
    recipients: [],
  };

  setInterval(async () => {
    if (!monthlySchedule.enabled || monthlySchedule.recipients.length === 0) return;
    const cfg = getGatewayConfig();
    if (!cfg.isConfigured) return;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isLastDayOfMonth = tomorrow.getDate() === 1;
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (
      isLastDayOfMonth &&
      now.getHours() >= monthlySchedule.hour &&
      monthlySchedule.lastDispatchedPeriod !== currentPeriod
    ) {
      monthlySchedule.lastDispatchedPeriod = currentPeriod;
      for (const item of monthlySchedule.recipients) {
        await dispatchWhatsAppMessage(item.nohp, item.message).catch(() => {});
      }
    }
  }, 15 * 60 * 1000);

  app.get('/api/whatsapp/schedule', (_req, res) => {
    res.json({
      enabled: monthlySchedule.enabled,
      hour: monthlySchedule.hour,
      recipientCount: monthlySchedule.recipients.length,
      lastDispatchedPeriod: monthlySchedule.lastDispatchedPeriod,
    });
  });

  app.post('/api/whatsapp/schedule', (req, res) => {
    const { enabled, hour, recipients } = req.body as {
      enabled?: boolean;
      hour?: number;
      recipients?: RecipientPayload[];
    };
    monthlySchedule = {
      ...monthlySchedule,
      enabled: Boolean(enabled),
      hour: typeof hour === 'number' && hour >= 0 && hour <= 23 ? hour : 19,
      recipients: Array.isArray(recipients) ? recipients : monthlySchedule.recipients,
    };
    res.json({
      enabled: monthlySchedule.enabled,
      hour: monthlySchedule.hour,
      recipientCount: monthlySchedule.recipients.length,
      lastDispatchedPeriod: monthlySchedule.lastDispatchedPeriod,
    });
  });

  app.post('/api/whatsapp/broadcast-monthly', async (req, res) => {
    try {
      const { recipients } = req.body as { recipients?: RecipientPayload[] };
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, error: 'Daftar penerima kosong.' });
      }

      const cfg = getGatewayConfig();
      if (!cfg.isConfigured) {
        return res.status(422).json({
          success: false,
          error:
            'Gateway WhatsApp server belum dikonfigurasi. Gunakan tombol Kirim WA per anggota atau atur WHATSAPP_API_TOKEN pada Secrets server.',
        });
      }

      const results: Array<{
        idAnggota: string;
        nama: string;
        nohp: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const item of recipients) {
        const result = await dispatchWhatsAppMessage(item.nohp, item.message);
        results.push({
          idAnggota: item.idAnggota,
          nama: item.nama,
          nohp: item.nohp,
          success: result.success,
          error: result.error,
        });
      }

      const sentCount = results.filter((r) => r.success).length;
      return res.json({
        success: sentCount > 0,
        sentCount,
        total: results.length,
        results,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Gagal memproses broadcast bulanan',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sentra Kas server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
