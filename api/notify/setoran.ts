import { sendSetoranEmailNotification, SetoranEmailPayload } from '../_email.js';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<SetoranEmailPayload>;
    if (!body.namaAnggota || !body.jumlah) {
      return Response.json(
        { ok: false, sent: false, error: 'Data setoran tidak lengkap.' },
        { status: 400 }
      );
    }

    const result = await sendSetoranEmailNotification({
      idSetoran: body.idSetoran || 'STR-' + Date.now(),
      idAnggota: body.idAnggota || '-',
      namaAnggota: body.namaAnggota,
      jenisSetoran: body.jenisSetoran || 'Simpanan',
      idPinjaman: body.idPinjaman,
      jumlah: Number(body.jumlah),
      jumlahSimpanan: Number(body.jumlahSimpanan || 0),
      jumlahAngsuran: Number(body.jumlahAngsuran || 0),
      metodeBayar: body.metodeBayar || 'Transfer Bank',
      keterangan: body.keterangan,
      tanggal: body.tanggal,
      appUrl: body.appUrl,
      isTest: Boolean(body.isTest),
      overrideRecipient: body.overrideRecipient,
    });

    if (!result.ok || (body.isTest && !result.sent)) {
      return Response.json(result, { status: 422 });
    }
    return Response.json(result);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        sent: false,
        error: err instanceof Error ? err.message : 'Gagal mengirim email notifikasi.',
      },
      { status: 500 }
    );
  }
}
