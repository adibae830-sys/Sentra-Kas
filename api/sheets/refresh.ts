import { executePortalRefresh } from '../_sheets.js';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { spreadsheetId?: string };
    const result = await executePortalRefresh({
      spreadsheetId: body.spreadsheetId,
      authHeader: req.headers.get('authorization'),
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Sesi berakhir.' },
      { status: 401 }
    );
  }
}
