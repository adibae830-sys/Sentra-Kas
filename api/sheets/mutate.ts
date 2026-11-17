import { executePortalMutate } from '../_sheets.js';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      spreadsheetId?: string;
      action: 'append' | 'update' | 'delete' | 'ensureSetup' | 'updateAccount';
      sheetName?: string;
      rowIndex?: number;
      values?: (string | number)[];
      sheetId?: number;
      oldPassword?: string;
      newUsername?: string;
      newPassword?: string;
    };
    const result = await executePortalMutate({
      ...body,
      authHeader: req.headers.get('authorization'),
    });
    return Response.json(result.body, { status: result.status });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses perubahan data.' },
      { status: 500 }
    );
  }
}
