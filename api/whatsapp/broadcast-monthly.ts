import {
  dispatchWhatsAppMessage,
  getGatewayConfig,
  RecipientPayload,
} from '../_whatsapp.js';

export async function POST(req: Request) {
  try {
    const { recipients } = (await req.json()) as {
      recipients?: RecipientPayload[];
    };

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return Response.json(
        { success: false, error: 'Daftar penerima kosong.' },
        { status: 400 }
      );
    }

    const cfg = getGatewayConfig();
    if (!cfg.isConfigured) {
      return Response.json(
        {
          success: false,
          error:
            'Gateway WhatsApp server belum dikonfigurasi pada Environment Variables Vercel.',
        },
        { status: 422 }
      );
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
    return Response.json({
      success: sentCount > 0,
      sentCount,
      total: results.length,
      results,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Gagal memproses broadcast bulanan',
      },
      { status: 500 }
    );
  }
}
