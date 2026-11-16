export type WhatsAppProvider = 'fonnte' | 'wablas' | 'meta' | 'webhook';

export interface RecipientPayload {
  idAnggota: string;
  nama: string;
  nohp: string;
  message: string;
}

export function isWhatsAppGroupTarget(raw: string): boolean {
  const trimmed = String(raw || '').trim();
  return trimmed.includes('@g.us') || /^\d+-\d+$/.test(trimmed);
}

export function normalizeWaNumber(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@g.us') || trimmed.includes('@c.us') || trimmed.includes('@s.whatsapp.net')) {
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

export function getGatewayConfig() {
  const provider = (
    cleanEnv(process.env.WHATSAPP_PROVIDER) || 'fonnte'
  ).toLowerCase() as WhatsAppProvider;
  const apiToken = cleanEnv(process.env.WHATSAPP_API_TOKEN);
  const apiUrl = cleanEnv(process.env.WHATSAPP_API_URL);
  const webhookUrl = cleanEnv(process.env.WHATSAPP_WEBHOOK_URL);
  const phoneNumberId = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const defaultGroupId = cleanEnv(process.env.WHATSAPP_GROUP_ID);

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
    defaultGroupId,
    isConfigured,
  };
}

export async function dispatchWhatsAppMessage(phone: string, message: string) {
  const cfg = getGatewayConfig();
  const rawInput = phone === 'GROUP' ? cfg.defaultGroupId : phone;
  const target = normalizeWaNumber(rawInput);
  const isGroup = isWhatsAppGroupTarget(target);

  if (!target || (!isGroup && target.length < 10)) {
    return {
      success: false,
      error: isGroup
        ? 'ID Grup WhatsApp tidak valid.'
        : 'Nomor HP atau ID Grup WhatsApp tidak valid.',
    };
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
