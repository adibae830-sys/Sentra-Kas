import { executePortalLogin } from '../_sheets.js';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      spreadsheetId?: string;
      username?: string;
      password?: string;
    };
    const result = await executePortalLogin(body);
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Gagal login ke portal.' },
      { status: 500 }
    );
  }
}
