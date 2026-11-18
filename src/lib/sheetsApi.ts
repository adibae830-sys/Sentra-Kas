import {
  Anggota,
  Angsuran,
  AppUser,
  FinanceDataset,
  KasKeluar,
  KasMasuk,
  KonfirmasiSetoran,
  LaporanBulanan,
  LogWhatsApp,
  Pinjaman,
  RoleType,
} from '../types/finance';

export const DEFAULT_SPREADSHEET_ID = '1ktrWJ5YsED71cPxbo0Om_J-9f0PlAgsThEhKL-TTBSU';

export const STRUKTUR_SHEET: Record<string, string[]> = {
  Users: ['Username', 'Password', 'Nama', 'Role', 'Status', 'IdAnggota'],
  Anggota: ['IdAnggota', 'Nama', 'Alamat', 'NoHP', 'Tanggal', 'Status'],
  KasMasuk: ['IdKasMasuk', 'Tanggal', 'IdAnggota', 'Jenis', 'Jumlah', 'Keterangan', 'User'],
  KasKeluar: ['IdKasKeluar', 'Tanggal', 'Jenis', 'Jumlah', 'Keterangan', 'User'],
  Pinjaman: [
    'IdPinjaman',
    'Tanggal',
    'IdAnggota',
    'Jumlah',
    'Tenor',
    'AngsuranPerBulan',
    'TotalDibayar',
    'Sisa',
    'Status',
  ],
  Angsuran: [
    'IdAngsuran',
    'Tanggal',
    'IdPinjaman',
    'IdAnggota',
    'AngsuranKe',
    'Jumlah',
    'Sisa',
    'User',
  ],
  LaporanBulanan: [
    'IdLaporan',
    'Periode',
    'TotalMasuk',
    'TotalKeluar',
    'SurplusDefisit',
    'SaldoAkhir',
    'TotalPiutang',
    'JumlahAnggota',
    'DibuatPada',
    'StatusKirimWA',
  ],
  LogWhatsApp: [
    'IdLog',
    'Tanggal',
    'Periode',
    'IdAnggota',
    'Nama',
    'NoHP',
    'Tipe',
    'Status',
    'Ringkasan',
  ],
  KonfirmasiSetoran: [
    'IdSetoran',
    'Tanggal',
    'IdAnggota',
    'JenisSetoran',
    'IdPinjaman',
    'Jumlah',
    'MetodeBayar',
    'Keterangan',
    'Status',
    'DiprosesOleh',
    'JumlahSimpanan',
    'JumlahAngsuran',
  ],
};

export function extractSpreadsheetId(input: string): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return DEFAULT_SPREADSHEET_ID;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export class SheetsAuthExpiredError extends Error {
  constructor(message = 'Sesi token Google Sheets berakhir. Silakan sambungkan kembali akun Google Anda.') {
    super(message);
    this.name = 'SheetsAuthExpiredError';
  }
}

export const PORTAL_TOKEN_PREFIX = 'portal:';

export function isPortalToken(token: string | null | undefined): boolean {
  return Boolean(token && token.startsWith(PORTAL_TOKEN_PREFIX));
}

export function unwrapPortalToken(token: string): string {
  return token.startsWith(PORTAL_TOKEN_PREFIX) ? token.slice(PORTAL_TOKEN_PREFIX.length) : token;
}

async function portalFetch<T>(url: string, portalToken: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${unwrapPortalToken(portalToken)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401) {
      throw new SheetsAuthExpiredError(data.error || 'Sesi portal berakhir. Silakan login kembali.');
    }
    throw new Error(data.error || `Gagal memproses permintaan (${res.status}).`);
  }
  return data as T;
}

async function sheetsFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new SheetsAuthExpiredError();
    }
    const errBody = await res.json().catch(() => ({}));
    const msg =
      errBody?.error?.message ||
      `Google Sheets API error (${res.status}). Pastikan akun Google Anda memiliki akses edit ke spreadsheet ini.`;
    throw new Error(msg);
  }

  return res.json();
}

export interface SpreadsheetMetadata {
  title: string;
  sheets: Array<{ title: string; sheetId: number }>;
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  token: string
): Promise<SpreadsheetMetadata> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets.properties(sheetId,title)`;
  const data = await sheetsFetch(url, token);

  return {
    title: data?.properties?.title || 'Spreadsheet Keuangan',
    sheets: (data?.sheets || []).map((s: { properties: { title: string; sheetId: number } }) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
    })),
  };
}

export async function ensureDatabaseStructure(
  spreadsheetId: string,
  token: string,
  options: { includeReportingTabs?: boolean } = { includeReportingTabs: true }
): Promise<{ createdTabs: string[]; initializedHeaders: string[] }> {
  if (isPortalToken(token)) {
    return portalFetch<{ createdTabs: string[]; initializedHeaders: string[] }>(
      '/api/sheets/mutate',
      token,
      {
        spreadsheetId,
        action: 'ensureSetup',
      }
    );
  }
  const meta = await getSpreadsheetMetadata(spreadsheetId, token);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));

  const targetTabs = Object.keys(STRUKTUR_SHEET).filter((name) => {
    if (!options.includeReportingTabs && (name === 'LaporanBulanan' || name === 'LogWhatsApp')) {
      return false;
    }
    return true;
  });

  const missingTabs = targetTabs.filter((name) => !existingTitles.has(name));

  if (missingTabs.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: {
              properties: { title },
            },
          })),
        }),
      }
    );
  }

  const rangesQuery = targetTabs
    .map((name) => `ranges=${encodeURIComponent(`${name}!A1:L1`)}`)
    .join('&');
  const headerCheck = await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}`,
    token
  );

  const initializedHeaders: string[] = [];
  const valueUpdates: Array<{ range: string; values: string[][] }> = [];

  (headerCheck?.valueRanges || []).forEach(
    (vr: { range?: string; values?: string[][] }, idx: number) => {
      const tabName = targetTabs[idx];
      const row = vr?.values?.[0] || [];
      const isEmpty = row.length === 0 || row.every((cell) => String(cell || '').trim() === '');
      if (isEmpty) {
        initializedHeaders.push(tabName);
        valueUpdates.push({
          range: `${tabName}!A1`,
          values: [STRUKTUR_SHEET[tabName]],
        });
      }
    }
  );

  if (valueUpdates.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: valueUpdates,
        }),
      }
    );
  }

  // Ensure default Administrator account exists in Users
  const usersRes = await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent('Users!A1:F')}`,
    token
  );
  const userRows: string[][] = usersRes?.values || [];
  const hasAdmin = userRows.slice(1).some((r) => {
    const role = String(r[3] || '').trim();
    return role === 'Admin' || role === 'Administrator';
  });

  if (!hasAdmin) {
    await appendRow(spreadsheetId, token, 'Users', [
      'admin',
      'admin123',
      'Administrator',
      'Admin',
      'Aktif',
      '',
    ]);
  }

  return { createdTabs: missingTabs, initializedHeaders };
}

function normalizeRole(raw: unknown): RoleType {
  const val = String(raw || '').trim();
  if (val === 'Admin' || val === 'Administrator') return 'Administrator';
  if (val === 'Bendahara') return 'Bendahara';
  return 'Anggota';
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val || '')
    .replace(/Rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadAllFinanceData(
  spreadsheetId: string,
  token: string
): Promise<FinanceDataset> {
  if (isPortalToken(token)) {
    const res = await portalFetch<{ dataset: FinanceDataset }>('/api/sheets/refresh', token, {
      spreadsheetId,
    });
    return res.dataset;
  }
  const meta = await getSpreadsheetMetadata(spreadsheetId, token);
  const sheetIds: Record<string, number> = {};
  const availableTabs: string[] = [];

  meta.sheets.forEach((s) => {
    sheetIds[s.title] = s.sheetId;
    availableTabs.push(s.title);
  });

  const knownTabs = Object.keys(STRUKTUR_SHEET).filter((tab) => availableTabs.includes(tab));

  if (knownTabs.length === 0) {
    return {
      spreadsheetTitle: meta.title,
      spreadsheetId,
      sheetIds,
      availableTabs,
      users: [],
      anggota: [],
      kasMasuk: [],
      kasKeluar: [],
      pinjaman: [],
      angsuran: [],
      laporanBulanan: [],
      logWhatsApp: [],
      konfirmasiSetoran: [],
    };
  }

  const rangesQuery = knownTabs
    .map((tab) => `ranges=${encodeURIComponent(`${tab}!A1:L`)}`)
    .join('&');

  const batchData = await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    token
  );

  const tabRows: Record<string, unknown[][]> = {};
  (batchData?.valueRanges || []).forEach(
    (vr: { values?: unknown[][] }, idx: number) => {
      const tabName = knownTabs[idx];
      tabRows[tabName] = vr?.values || [];
    }
  );

  const users: AppUser[] = (tabRows['Users'] || []).slice(1).map((r, idx) => ({
    username: String(r[0] || '').trim(),
    password: String(r[1] || '').trim(),
    nama: String(r[2] || '').trim(),
    role: normalizeRole(r[3]),
    status: String(r[4] || 'Aktif').trim(),
    idAnggota: String(r[5] || '').trim(),
    rowIndex: idx + 2,
  }));

  const anggota: Anggota[] = (tabRows['Anggota'] || [])
    .slice(1)
    .map((r, idx) => ({
      id: String(r[0] || '').trim(),
      nama: String(r[1] || '').trim(),
      alamat: String(r[2] || '').trim(),
      nohp: String(r[3] || '').trim(),
      tanggal: String(r[4] || '').trim(),
      status: String(r[5] || 'Aktif').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.id !== '');

  const kasMasuk: KasMasuk[] = (tabRows['KasMasuk'] || [])
    .slice(1)
    .map((r, idx) => ({
      id: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      idAnggota: String(r[2] || '').trim(),
      jenis: String(r[3] || '').trim(),
      jumlah: toNumber(r[4]),
      keterangan: String(r[5] || '').trim(),
      user: String(r[6] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.id !== '');

  const kasKeluar: KasKeluar[] = (tabRows['KasKeluar'] || [])
    .slice(1)
    .map((r, idx) => ({
      id: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      jenis: String(r[2] || '').trim(),
      jumlah: toNumber(r[3]),
      keterangan: String(r[4] || '').trim(),
      user: String(r[5] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.id !== '');

  const pinjaman: Pinjaman[] = (tabRows['Pinjaman'] || [])
    .slice(1)
    .map((r, idx) => ({
      idPinjaman: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      idAnggota: String(r[2] || '').trim(),
      jumlah: toNumber(r[3]),
      tenor: toNumber(r[4]),
      angsuranPerBulan: toNumber(r[5]),
      totalDibayar: toNumber(r[6]),
      sisa: toNumber(r[7]),
      status: String(r[8] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.idPinjaman !== '');

  const angsuran: Angsuran[] = (tabRows['Angsuran'] || [])
    .slice(1)
    .map((r, idx) => ({
      idAngsuran: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      idPinjaman: String(r[2] || '').trim(),
      idAnggota: String(r[3] || '').trim(),
      angsuranKe: toNumber(r[4]),
      jumlah: toNumber(r[5]),
      sisa: toNumber(r[6]),
      user: String(r[7] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.idAngsuran !== '');

  const laporanBulanan: LaporanBulanan[] = (tabRows['LaporanBulanan'] || [])
    .slice(1)
    .map((r, idx) => ({
      idLaporan: String(r[0] || '').trim(),
      periode: String(r[1] || '').trim(),
      totalMasuk: toNumber(r[2]),
      totalKeluar: toNumber(r[3]),
      surplusDefisit: toNumber(r[4]),
      saldoAkhir: toNumber(r[5]),
      totalPiutang: toNumber(r[6]),
      jumlahAnggota: toNumber(r[7]),
      dibuatPada: String(r[8] || '').trim(),
      statusKirimWa: String(r[9] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.idLaporan !== '');

  const logWhatsApp: LogWhatsApp[] = (tabRows['LogWhatsApp'] || [])
    .slice(1)
    .map((r, idx) => ({
      idLog: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      periode: String(r[2] || '').trim(),
      idAnggota: String(r[3] || '').trim(),
      nama: String(r[4] || '').trim(),
      nohp: String(r[5] || '').trim(),
      tipe: String(r[6] || '').trim(),
      status: String(r[7] || '').trim(),
      ringkasan: String(r[8] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.idLog !== '');

  const konfirmasiSetoran: KonfirmasiSetoran[] = (tabRows['KonfirmasiSetoran'] || [])
    .slice(1)
    .map((r, idx) => {
      const rawJenis = String(r[3] || '').trim();
      const jenisSetoran: KonfirmasiSetoran['jenisSetoran'] =
        rawJenis === 'Angsuran'
          ? 'Angsuran'
          : rawJenis === 'Gabungan'
            ? 'Gabungan'
            : 'Simpanan';
      const jumlah = toNumber(r[5]);
      const rawSimpanan = toNumber(r[10]);
      const rawAngsuran = toNumber(r[11]);
      return {
        idSetoran: String(r[0] || '').trim(),
        tanggal: String(r[1] || '').trim(),
        idAnggota: String(r[2] || '').trim(),
        jenisSetoran,
        idPinjaman: String(r[4] || '').trim(),
        jumlah,
        metodeBayar: String(r[6] || '').trim() || 'Transfer Bank',
        keterangan: String(r[7] || '').trim(),
        status: String(r[8] || 'Menunggu').trim(),
        diprosesOleh: String(r[9] || '').trim(),
        jumlahSimpanan:
          jenisSetoran === 'Simpanan'
            ? rawSimpanan || jumlah
            : jenisSetoran === 'Gabungan'
              ? rawSimpanan
              : 0,
        jumlahAngsuran:
          jenisSetoran === 'Angsuran'
            ? rawAngsuran || jumlah
            : jenisSetoran === 'Gabungan'
              ? rawAngsuran
              : 0,
        rowIndex: idx + 2,
      };
    })
    .filter((item) => item.idSetoran !== '');

  return {
    spreadsheetTitle: meta.title,
    spreadsheetId,
    sheetIds,
    availableTabs,
    users,
    anggota,
    kasMasuk,
    kasKeluar,
    pinjaman,
    angsuran,
    laporanBulanan,
    logWhatsApp,
    konfirmasiSetoran,
  };
}

export async function appendRow(
  spreadsheetId: string,
  token: string,
  sheetName: string,
  values: (string | number)[]
) {
  if (isPortalToken(token)) {
    return portalFetch('/api/sheets/mutate', token, {
      spreadsheetId,
      action: 'append',
      sheetName,
      values,
    });
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(`${sheetName}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsFetch(url, token, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  });
}

export async function updateRowValues(
  spreadsheetId: string,
  token: string,
  sheetName: string,
  rowIndex1Based: number,
  values: (string | number)[]
) {
  if (isPortalToken(token)) {
    return portalFetch('/api/sheets/mutate', token, {
      spreadsheetId,
      action: 'update',
      sheetName,
      rowIndex: rowIndex1Based,
      values,
    });
  }
  const range = `${sheetName}!A${rowIndex1Based}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, token, {
    method: 'PUT',
    body: JSON.stringify({ values: [values] }),
  });
}

export async function deleteRow(
  spreadsheetId: string,
  token: string,
  sheetId: number,
  rowIndex1Based: number
) {
  if (isPortalToken(token)) {
    return portalFetch('/api/sheets/mutate', token, {
      spreadsheetId,
      action: 'delete',
      sheetId,
      rowIndex: rowIndex1Based,
    });
  }
  const startIndex = rowIndex1Based - 1;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}:batchUpdate`;
  return sheetsFetch(url, token, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        },
      ],
    }),
  });
}

export async function portalUpdateAccount(
  spreadsheetId: string,
  token: string,
  payload: {
    oldPassword: string;
    newUsername: string;
    newPassword: string;
  }
): Promise<{ portalToken?: string }> {
  return portalFetch<{ success: boolean; portalToken?: string }>('/api/sheets/mutate', token, {
    spreadsheetId,
    action: 'updateAccount',
    oldPassword: payload.oldPassword,
    newUsername: payload.newUsername,
    newPassword: payload.newPassword,
  });
}
