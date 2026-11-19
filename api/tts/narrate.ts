import { executeGenerateTts } from '../_tts.js';

export function GET() {
  const configured = Boolean((process.env.GEMINI_API_KEY || '').trim());
  return Response.json({ configured });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      text?: string;
      voiceName?: string;
      cacheKey?: string;
    };
    const result = await executeGenerateTts(body);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Gagal membuat suara panduan.' },
      { status: 500 }
    );
  }
}
