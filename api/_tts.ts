import { GoogleGenAI } from '@google/genai';

const DEFAULT_FEMALE_VOICE = 'Kore';
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';

// Server-side in-memory cache so repeated playback or export of standard guide clips is instant
const ttsCache = new Map<string, { audioBase64: string; mimeType: string }>();

export function isTtsConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1alpha',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Gagal membuat suara panduan.');
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'Akses Gemini API ditolak (403). Periksa GEMINI_API_KEY di Settings > Secrets.',
    };
  }
  if (raw.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'Konfigurasi Gemini API tidak valid. Periksa GEMINI_API_KEY di Settings > Secrets.',
    };
  }
  if (raw.includes('400') || raw.includes('INVALID_ARGUMENT')) {
    return {
      status: 400,
      message: raw,
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Batas permintaan suara Gemini TTS sedang penuh (429). Coba lagi beberapa saat.',
    };
  }
  return {
    status: 500,
    message: raw,
  };
}

export async function executeGenerateTts(input: {
  text?: string;
  voiceName?: string;
  cacheKey?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const text = String(input.text || '').trim();
  if (!text) {
    return { status: 400, body: { error: 'Teks narasi wajib diisi.' } };
  }
  if (text.length > 600) {
    return { status: 400, body: { error: 'Teks narasi terlalu panjang (maksimal 600 karakter).' } };
  }

  const voiceName = String(input.voiceName || DEFAULT_FEMALE_VOICE).trim() || DEFAULT_FEMALE_VOICE;
  const effectiveCacheKey = input.cacheKey ? `${voiceName}:${input.cacheKey}` : `${voiceName}:${text}`;

  const cached = ttsCache.get(effectiveCacheKey);
  if (cached) {
    return {
      status: 200,
      body: {
        audioBase64: cached.audioBase64,
        mimeType: cached.mimeType,
        cached: true,
      },
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: 503,
      body: {
        error:
          'GEMINI_API_KEY belum tersedia di server. Tambahkan GEMINI_API_KEY di Vercel Environment Variables (atau Settings > Secrets) lalu redeploy agar suara wanita ikut terekam di file video.',
      },
    };
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style:
                    'Wanita Indonesia yang ramah, lembut, artikulasi jelas, tempo sedang dan mudah dipahami anggota koperasi.',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      const mimeType = inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        throw new Error('Model TTS tidak mengembalikan data audio.');
      }

      if (ttsCache.size > 60) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(effectiveCacheKey, { audioBase64: base64Audio, mimeType });

      return {
        status: 200,
        body: {
          audioBase64: base64Audio,
          mimeType,
          cached: false,
        },
      };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = msg.includes('429') || msg.includes('503') || msg.includes('500');
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }

  const parsed = parseApiError(lastError);
  return {
    status: parsed.status,
    body: { error: parsed.message },
  };
}
