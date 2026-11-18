import crypto from 'crypto';

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
  ],
};

interface ServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
}

export interface PortalSessionPayload {
  username: string;
  nama: string;
  role: 'Administrator' | 'Bendahara' | 'Anggota';
  idAnggota: string;
  spreadsheetId: string;
  exp: number;
}

let cachedGoogleToken: { token: string; expiresAt: number } | null = null;

function cleanEnv(val: string | undefined): string {
  const trimmed = (val || '').trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
}

export function extractSpreadsheetId(input: string | undefined): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) return cleanEnv(process.env.GOOGLE_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function getServiceAccountConfig(): ServiceAccountConfig | null {
  const rawJson = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (rawJson) {
    try {
      const jsonText = rawJson.startsWith('{')
        ? rawJson
        : Buffer.from(rawJson, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonText) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email.trim(),
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Fall through to split env vars
    }
  }

  const email = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const key = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (email && key) {
    return {
      clientEmail: email,
      privateKey: key.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function getSessionSecret(cfg: ServiceAccountConfig): string {
  return (
    cleanEnv(process.env.PORTAL_SESSION_SECRET) ||
    crypto.createHash('sha256').update(cfg.privateKey).digest('hex')
  );
}

export function signPortalToken(
  payload: Omit<PortalSessionPayload, 'exp'>,
  ttlSeconds = 7 * 24 * 60 * 60
): string {
  const cfg = getServiceAccountConfig();
  if (!cfg) {
    throw new Error('Service Account belum dikonfigurasi di server.');
  }
  const fullPayload: PortalSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret(cfg))
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyPortalToken(authHeaderOrToken: string | null | undefined): PortalSessionPayload {
  const cfg = getServiceAccountConfig();
  if (!cfg) {
    throw new Error('Service Account belum dikonfigurasi di server.');
  }
  const raw = String(authHeaderOrToken || '').replace(/^Bearer\s+/i, '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new Error('Sesi login portal tidak valid.');
  }
  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret(cfg))
    .update(encoded)
    .digest('base64url');

  const bufA = Buffer.from(providedSig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    throw new Error('Tanda tangan sesi tidak valid. Silakan login ulang.');
  }

  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PortalSessionPayload;
  if (!parsed?.username || !parsed?.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Sesi login telah berakhir. Silakan masuk kembali.');
  }
  return parsed;
}

export async function getServiceAccountAccessToken(): Promise<string> {
  const cfg = getServiceAccountConfig();
  if (!cfg) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON belum dikonfigurasi.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedGoogleToken && cachedGoogleToken.expiresAt - 300 > nowSec) {
    return cachedGoogleToken.token;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  ).toString('base64url');

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(cfg.privateKey, 'base64url');
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams();
  body.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.append('assertion', assertion);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || 'Gagal mendapatkan token Service Account Google.'
    );
  }

  cachedGoogleToken = {
    token: data.access_token,
    expiresAt: nowSec + (data.expires_in || 3600),
  };
  return data.access_token;
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
    const errBody = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(
      errBody?.error?.message ||
        `Google Sheets API error (${res.status}). Pastikan Spreadsheet sudah dibagikan ke email Service Account.`
    );
  }

  return res.json();
}

function normalizeRole(raw: unknown): 'Administrator' | 'Bendahara' | 'Anggota' {
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

export async function loadAllFinanceDataServer(spreadsheetIdInput?: string) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  const token = await getServiceAccountAccessToken();

  const meta = (await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,sheets.properties(sheetId,title)`,
    token
  )) as {
    properties?: { title?: string };
    sheets?: Array<{ properties: { title: string; sheetId: number } }>;
  };

  const sheetIds: Record<string, number> = {};
  const availableTabs: string[] = [];
  (meta.sheets || []).forEach((s) => {
    sheetIds[s.properties.title] = s.properties.sheetId;
    availableTabs.push(s.properties.title);
  });

  const knownTabs = Object.keys(STRUKTUR_SHEET).filter((tab) => availableTabs.includes(tab));

  if (knownTabs.length === 0) {
    return {
      spreadsheetTitle: meta.properties?.title || 'Spreadsheet Keuangan',
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
    .map((tab) => `ranges=${encodeURIComponent(`${tab}!A1:J`)}`)
    .join('&');

  const batchData = (await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    token
  )) as { valueRanges?: Array<{ values?: unknown[][] }> };

  const tabRows: Record<string, unknown[][]> = {};
  (batchData.valueRanges || []).forEach((vr, idx) => {
    tabRows[knownTabs[idx]] = vr?.values || [];
  });

  const users = (tabRows['Users'] || []).slice(1).map((r, idx) => ({
    username: String(r[0] || '').trim(),
    password: String(r[1] || '').trim(),
    nama: String(r[2] || '').trim(),
    role: normalizeRole(r[3]),
    status: String(r[4] || 'Aktif').trim(),
    idAnggota: String(r[5] || '').trim(),
    rowIndex: idx + 2,
  }));

  const anggota = (tabRows['Anggota'] || [])
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

  const kasMasuk = (tabRows['KasMasuk'] || [])
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

  const kasKeluar = (tabRows['KasKeluar'] || [])
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

  const pinjaman = (tabRows['Pinjaman'] || [])
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

  const angsuran = (tabRows['Angsuran'] || [])
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

  const laporanBulanan = (tabRows['LaporanBulanan'] || [])
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

  const logWhatsApp = (tabRows['LogWhatsApp'] || [])
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

  const konfirmasiSetoran = (tabRows['KonfirmasiSetoran'] || [])
    .slice(1)
    .map((r, idx) => ({
      idSetoran: String(r[0] || '').trim(),
      tanggal: String(r[1] || '').trim(),
      idAnggota: String(r[2] || '').trim(),
      jenisSetoran: String(r[3] || '').trim() === 'Angsuran' ? ('Angsuran' as const) : ('Simpanan' as const),
      idPinjaman: String(r[4] || '').trim(),
      jumlah: toNumber(r[5]),
      metodeBayar: String(r[6] || '').trim() || 'Transfer Bank',
      keterangan: String(r[7] || '').trim(),
      status: String(r[8] || 'Menunggu').trim(),
      diprosesOleh: String(r[9] || '').trim(),
      rowIndex: idx + 2,
    }))
    .filter((item) => item.idSetoran !== '');

  return {
    spreadsheetTitle: meta.properties?.title || 'Spreadsheet Keuangan',
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

export function sanitizeDatasetForPortal(
  dataset: Awaited<ReturnType<typeof loadAllFinanceDataServer>>,
  currentUser: { username: string; role: string }
) {
  const safeUsers = dataset.users
    .filter((u) => currentUser.role !== 'Anggota' || u.username === currentUser.username)
    .map((u) => ({ ...u, password: '' }));
  return {
    ...dataset,
    users: safeUsers,
  };
}

async function appendRowServer(
  spreadsheetId: string,
  token: string,
  sheetName: string,
  values: (string | number)[]
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(`${sheetName}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsFetch(url, token, {
    method: 'POST',
    body: JSON.stringify({ values: [values] }),
  });
}

async function updateRowValuesServer(
  spreadsheetId: string,
  token: string,
  sheetName: string,
  rowIndex1Based: number,
  values: (string | number)[]
) {
  const range = `${sheetName}!A${rowIndex1Based}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return sheetsFetch(url, token, {
    method: 'PUT',
    body: JSON.stringify({ values: [values] }),
  });
}

async function deleteRowServer(
  spreadsheetId: string,
  token: string,
  sheetId: number,
  rowIndex1Based: number
) {
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

async function ensureDatabaseStructureServer(spreadsheetId: string, token: string) {
  const meta = (await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,sheets.properties(sheetId,title)`,
    token
  )) as { sheets?: Array<{ properties: { title: string } }> };

  const existingTitles = new Set((meta.sheets || []).map((s) => s.properties.title));
  const targetTabs = Object.keys(STRUKTUR_SHEET);
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
          requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      }
    );
  }

  const rangesQuery = targetTabs
    .map((name) => `ranges=${encodeURIComponent(`${name}!A1:J1`)}`)
    .join('&');
  const headerCheck = (await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${rangesQuery}`,
    token
  )) as { valueRanges?: Array<{ values?: string[][] }> };

  const initializedHeaders: string[] = [];
  const valueUpdates: Array<{ range: string; values: string[][] }> = [];
  (headerCheck.valueRanges || []).forEach((vr, idx) => {
    const tabName = targetTabs[idx];
    const row = vr?.values?.[0] || [];
    const isEmpty = row.length === 0 || row.every((cell) => String(cell || '').trim() === '');
    if (isEmpty) {
      initializedHeaders.push(tabName);
      valueUpdates.push({ range: `${tabName}!A1`, values: [STRUKTUR_SHEET[tabName]] });
    }
  });

  if (valueUpdates.length > 0) {
    await sheetsFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueUpdates }),
      }
    );
  }

  return { createdTabs: missingTabs, initializedHeaders };
}

export async function executePortalLogin(params: {
  spreadsheetId?: string;
  username?: string;
  password?: string;
}) {
  const spreadsheetId = extractSpreadsheetId(params.spreadsheetId);
  const uTrim = String(params.username || '').trim();
  const pTrim = String(params.password || '').trim();

  if (!uTrim || !pTrim) {
    return { status: 400, body: { error: 'Username dan password wajib diisi.' } };
  }

  const dataset = await loadAllFinanceDataServer(spreadsheetId);
  const matched = dataset.users.find(
    (u) => u.username === uTrim && u.password === pTrim && u.status === 'Aktif'
  );

  if (!matched) {
    return {
      status: 401,
      body: { error: 'Username atau password salah, atau akun tidak aktif.' },
    };
  }

  let resolvedIdAnggota = matched.idAnggota;
  if (matched.role === 'Anggota' && !resolvedIdAnggota) {
    const byName = dataset.anggota.find(
      (a) => a.nama.toLowerCase() === matched.nama.toLowerCase()
    );
    if (byName) resolvedIdAnggota = byName.id;
  }

  const user = { ...matched, idAnggota: resolvedIdAnggota, password: '' };
  const portalToken = signPortalToken({
    username: user.username,
    nama: user.nama,
    role: user.role,
    idAnggota: user.idAnggota,
    spreadsheetId,
  });

  return {
    status: 200,
    body: {
      user,
      portalToken,
      dataset: sanitizeDatasetForPortal(dataset, user),
    },
  };
}

export async function executePortalRefresh(params: {
  spreadsheetId?: string;
  authHeader?: string | null;
}) {
  const session = verifyPortalToken(params.authHeader);
  const spreadsheetId = extractSpreadsheetId(params.spreadsheetId || session.spreadsheetId);
  const dataset = await loadAllFinanceDataServer(spreadsheetId);

  const matched = dataset.users.find(
    (u) => u.username === session.username && u.status === 'Aktif'
  );
  if (!matched) {
    return { status: 401, body: { error: 'Akun sudah tidak aktif di Google Sheets.' } };
  }

  let resolvedIdAnggota = matched.idAnggota;
  if (matched.role === 'Anggota' && !resolvedIdAnggota) {
    const byName = dataset.anggota.find(
      (a) => a.nama.toLowerCase() === matched.nama.toLowerCase()
    );
    if (byName) resolvedIdAnggota = byName.id;
  }

  const user = { ...matched, idAnggota: resolvedIdAnggota, password: '' };
  return {
    status: 200,
    body: {
      user,
      dataset: sanitizeDatasetForPortal(dataset, user),
    },
  };
}

export async function executePortalRegister(params: {
  spreadsheetId?: string;
  nama?: string;
  alamat?: string;
  nohp?: string;
  username?: string;
  password?: string;
}) {
  const spreadsheetId = extractSpreadsheetId(params.spreadsheetId);
  const nama = String(params.nama || '').trim();
  const alamat = String(params.alamat || '').trim();
  const nohp = String(params.nohp || '').trim();
  const username = String(params.username || '').trim();
  const password = String(params.password || '').trim();

  if (!nama || !nohp || !username || !password) {
    return { status: 400, body: { error: 'Nama, No HP, Username, dan Password wajib diisi.' } };
  }

  const dataset = await loadAllFinanceDataServer(spreadsheetId);
  const exists = dataset.users.some((u) => u.username === username);
  if (exists) {
    return { status: 409, body: { error: 'Username sudah digunakan. Pilih username lain.' } };
  }

  const token = await getServiceAccountAccessToken();
  const newId = 'AGT-' + Date.now();
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  await appendRowServer(spreadsheetId, token, 'Anggota', [
    newId,
    nama,
    alamat,
    nohp,
    now,
    'Aktif',
  ]);
  await appendRowServer(spreadsheetId, token, 'Users', [
    username,
    password,
    nama,
    'Anggota',
    'Aktif',
    newId,
  ]);

  return {
    status: 200,
    body: {
      success: true,
      idAnggota: newId,
      username,
    },
  };
}

export async function executePortalMutate(params: {
  spreadsheetId?: string;
  authHeader?: string | null;
  action: 'append' | 'update' | 'delete' | 'ensureSetup' | 'updateAccount';
  sheetName?: string;
  rowIndex?: number;
  values?: (string | number)[];
  sheetId?: number;
  oldPassword?: string;
  newUsername?: string;
  newPassword?: string;
}) {
  const session = verifyPortalToken(params.authHeader);
  const spreadsheetId = extractSpreadsheetId(params.spreadsheetId || session.spreadsheetId);
  const dataset = await loadAllFinanceDataServer(spreadsheetId);

  const currentUser = dataset.users.find(
    (u) => u.username === session.username && u.status === 'Aktif'
  );
  if (!currentUser) {
    return { status: 401, body: { error: 'Akun tidak aktif atau tidak ditemukan.' } };
  }

  const token = await getServiceAccountAccessToken();

  if (params.action === 'updateAccount') {
    const oldPwd = String(params.oldPassword || '').trim();
    const newUser = String(params.newUsername || '').trim();
    const newPwd = String(params.newPassword || '').trim();
    if (!oldPwd || !newUser || !newPwd) {
      return { status: 400, body: { error: 'Semua kolom akun wajib diisi.' } };
    }
    if (currentUser.password !== oldPwd) {
      return { status: 403, body: { error: 'Password lama tidak sesuai.' } };
    }
    await updateRowValuesServer(spreadsheetId, token, 'Users', currentUser.rowIndex, [
      newUser,
      newPwd,
      currentUser.nama,
      currentUser.role,
      currentUser.status,
      currentUser.idAnggota,
    ]);
    const refreshedToken = signPortalToken({
      username: newUser,
      nama: currentUser.nama,
      role: currentUser.role,
      idAnggota: currentUser.idAnggota,
      spreadsheetId,
    });
    return { status: 200, body: { success: true, portalToken: refreshedToken } };
  }

  if (params.action === 'append') {
    const sheetName = String(params.sheetName || '');
    const values = Array.isArray(params.values) ? params.values : [];
    if (!sheetName || values.length === 0) {
      return { status: 400, body: { error: 'Data baris tidak lengkap.' } };
    }
    if (currentUser.role === 'Anggota') {
      const ownId = currentUser.idAnggota || session.idAnggota;
      const isLoanRequest =
        sheetName === 'Pinjaman' &&
        String(values[2] || '') === ownId &&
        String(values[8] || '') === 'Menunggu' &&
        Number(values[3] || 0) > 0 &&
        Number(values[4] || 0) > 0;
      const jenisSetoran = String(values[3] || '').trim();
      const isDepositRequest =
        sheetName === 'KonfirmasiSetoran' &&
        String(values[2] || '') === ownId &&
        (jenisSetoran === 'Simpanan' || jenisSetoran === 'Angsuran') &&
        Number(values[5] || 0) > 0 &&
        String(values[8] || '') === 'Menunggu' &&
        (jenisSetoran === 'Simpanan' || String(values[4] || '').trim() !== '');

      if (!isLoanRequest && !isDepositRequest) {
        return {
          status: 403,
          body: {
            error:
              'Peran Anggota hanya diizinkan mengajukan pinjaman atau konfirmasi setoran iuran dan angsuran.',
          },
        };
      }
    }
    if (
      sheetName === 'KonfirmasiSetoran' &&
      !dataset.availableTabs.includes('KonfirmasiSetoran')
    ) {
      await ensureDatabaseStructureServer(spreadsheetId, token);
    }
    await appendRowServer(spreadsheetId, token, sheetName, values);
    return { status: 200, body: { success: true } };
  }

  if (currentUser.role === 'Anggota') {
    return { status: 403, body: { error: 'Akses ditolak untuk peran Anggota.' } };
  }

  if (params.action === 'update') {
    const sheetName = String(params.sheetName || '');
    const rowIndex = Number(params.rowIndex || 0);
    const values = Array.isArray(params.values) ? params.values : [];
    if (!sheetName || rowIndex < 2 || values.length === 0) {
      return { status: 400, body: { error: 'Parameter update tidak valid.' } };
    }
    await updateRowValuesServer(spreadsheetId, token, sheetName, rowIndex, values);
    return { status: 200, body: { success: true } };
  }

  if (params.action === 'delete') {
    const sheetId = Number(params.sheetId);
    const rowIndex = Number(params.rowIndex || 0);
    if (!Number.isFinite(sheetId) || rowIndex < 2) {
      return { status: 400, body: { error: 'Parameter hapus tidak valid.' } };
    }
    await deleteRowServer(spreadsheetId, token, sheetId, rowIndex);
    return { status: 200, body: { success: true } };
  }

  if (params.action === 'ensureSetup') {
    if (currentUser.role !== 'Administrator') {
      return { status: 403, body: { error: 'Setup database hanya untuk Administrator.' } };
    }
    const result = await ensureDatabaseStructureServer(spreadsheetId, token);
    return { status: 200, body: result };
  }

  return { status: 400, body: { error: 'Aksi tidak dikenali.' } };
}
