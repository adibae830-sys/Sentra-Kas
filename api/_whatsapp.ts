export type WhatsAppProvider = 'fonnte' | 'wablas' | 'meta' | 'webhook';

export interface RecipientPayload {
  idAnggota: string;
  nama: string;
  nohp: string;
  message: string;
}

export function normalizeWaNumber(raw: string): string {
  let num = String(raw || '').replace(/\D/g, '');
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

export function getGatewayConfig() {
  const provider = (
    cleanEnv(process.env.WHATSAPP_PROVIDER) || 'fonnte'
  ).toLowerCase() as WhatsAppProvider;
  const apiToken = cleanEnv(process.env.WHATSAPP_API_TOKEN);
  const apiUrl = cleanEnv(process.env.WHATSAPP_API_URL);
  const webhookUrl = cleanEnv(process.env.WHATSAPP_WEBHOOK_URL);
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);

  const isConfigured =
    (provider === 'webhook' && Boolean(webhookUrl)) ||
    (provider === 'meta' && Boolean(apiToken && phoneNumberId)) ||
    ((provider === 'fonnte' || provider === 'wablas') && Boolean(apiToken));

  return {
    provider,
    apiToken,
    apiUrl,
    webhookUrl,
    phoneNumberId,
    isConfigured,
  };
}

export async function dispatchWhatsAppMessage(phone: string, message: string) {
  const cfg = getGatewayConfig();
  const target = normalizeWaNumber(phone);

  if (!target || target.length < 10) {
    return { success: false, error: 'Nomor WhatsApp tidak valid' };
  }

  if (!cfg.isConfigured) {
    return {
      success: false,
      error: 'Gateway WhatsApp server belum dikonfigurasi pada environment variables.',
    };
  }

  if (cfg.provider === 'fonnte') {
    const endpoint = cfg.apiUrl || 'https://api.fonnte.com/send';
    const formData = new URLSearchParams();
    formData.append('target', target);
    formData.append('message', message);
    formData.append('countryCode', '62');

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
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status === false) {
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { success: true, detail: data };
  }

  if (cfg.provider === 'meta') {
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

  const res = await fetch(cfg.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cfg.apiToken ? { Authorization: `Bearer ${cfg.apiToken}` } : {}),
    },
    body: JSON.stringify({
      phone: target,
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
