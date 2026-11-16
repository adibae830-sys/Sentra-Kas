import { dispatchWhatsAppMessage } from '../_whatsapp.js';

export async function POST(req: Request) {
  try {
    const { nohp, message } = (await req.json()) as {
      nohp?: string;
      message?: string;
    };
    if (!nohp || !message) {
      return Response.json(
        { success: false, error: 'Nomor HP dan pesan wajib diisi.' },
        { status: 400 }
      );
    }
    const result = await dispatchWhatsAppMessage(nohp, message);
    return Response.json(result, { status: result.success ? 200 : 422 });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Gagal mengirim pesan WhatsApp',
      },
      { status: 500 }
    );
  }
}
