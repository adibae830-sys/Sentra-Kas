import { executePortalRegister } from '../_sheets.js';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      spreadsheetId?: string;
      nama?: string;
      alamat?: string;
      nohp?: string;
      username?: string;
      password?: string;
    };
    const result = await executePortalRegister(body);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Gagal mendaftarkan anggota.' },
      { status: 500 }
    );
  }
}
