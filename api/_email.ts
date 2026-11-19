import nodemailer from 'nodemailer';

export interface SetoranEmailPayload {
  idSetoran: string;
  idAnggota: string;
  namaAnggota: string;
  jenisSetoran: 'Simpanan' | 'Angsuran' | 'Gabungan' | string;
  idPinjaman?: string;
  jumlah: number;
  jumlahSimpanan?: number;
  jumlahAngsuran?: number;
  metodeBayar: string;
  keterangan?: string;
  tanggal?: string;
  appUrl?: string;
  isTest?: boolean;
  overrideRecipient?: string;
}

function cleanEnv(val: string | undefined): string {
  const trimmed = (val || '').trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRupiahServer(amount: number): string {
  const num = Number(amount) || 0;
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function maskEmail(email: string): string {
  const list = email
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list
    .map((e) => {
      const [local, domain] = e.split('@');
      if (!domain) return e;
      const head = local.slice(0, 2);
      return `${head}***@${domain}`;
    })
    .join(', ');
}

export function getEmailConfig() {
  const smtpUser = cleanEnv(process.env.SMTP_USER);
  const smtpPass = cleanEnv(process.env.SMTP_PASS).replace(/\s+/g, '');
  const smtpHost = cleanEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
  const smtpPort = Number(cleanEnv(process.env.SMTP_PORT)) || 465;
  const smtpSecureEnv = cleanEnv(process.env.SMTP_SECURE);
  const smtpSecure = smtpSecureEnv ? smtpSecureEnv.toLowerCase() === 'true' : smtpPort === 465;
  const smtpFrom = cleanEnv(process.env.SMTP_FROM) || (smtpUser ? `KSP SENTRA <${smtpUser}>` : '');

  const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
  const resendFrom = cleanEnv(process.env.RESEND_FROM) || 'KSP SENTRA <onboarding@resend.dev>';

  const adminNotifyEmail = cleanEnv(process.env.ADMIN_NOTIFY_EMAIL) || smtpUser;

  const hasSmtp = Boolean(smtpUser && smtpPass && adminNotifyEmail);
  const hasResend = Boolean(resendApiKey && adminNotifyEmail);
  const provider: 'smtp' | 'resend' | 'none' = hasSmtp
    ? 'smtp'
    : hasResend
      ? 'resend'
      : 'none';

  return {
    configured: provider !== 'none',
    provider,
    smtpUser,
    smtpPass,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpFrom,
    resendApiKey,
    resendFrom,
    adminNotifyEmail,
    recipientMasked: adminNotifyEmail ? maskEmail(adminNotifyEmail) : '',
  };
}

export async function sendSetoranEmailNotification(payload: SetoranEmailPayload): Promise<{
  ok: boolean;
  sent: boolean;
  provider: string;
  skipped?: boolean;
  error?: string;
}> {
  const cfg = getEmailConfig();
  const recipient = cleanEnv(payload.overrideRecipient) || cfg.adminNotifyEmail;

  if (!cfg.configured || !recipient) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      provider: cfg.provider,
      error:
        'Notifikasi email belum dikonfigurasi. Tambahkan SMTP_USER, SMTP_PASS, dan ADMIN_NOTIFY_EMAIL di Environment Variables server.',
    };
  }

  const jenisLabel =
    payload.jenisSetoran === 'Gabungan'
      ? `Gabungan (Iuran + Angsuran${payload.idPinjaman ? ` ${payload.idPinjaman}` : ''})`
      : payload.jenisSetoran === 'Angsuran'
        ? `Bayar Angsuran${payload.idPinjaman ? ` (${payload.idPinjaman})` : ''}`
        : 'Iuran Wajib / Simpanan';

  const totalFormatted = formatRupiahServer(payload.jumlah);
  const prefix = payload.isTest ? '[UJI COBA] ' : '';
  const subject = `${prefix}[KSP SENTRA] Setoran Baru Menunggu ACC · ${payload.namaAnggota} (${totalFormatted})`;

  const appUrlClean =
    cleanEnv(payload.appUrl) || cleanEnv(process.env.APP_URL) || 'https://sentra-kas.vercel.app';

  const waktuLabel =
    payload.tanggal ||
    new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'medium',
      timeStyle: 'short',
    }) + ' WIB';

  const textLines = [
    `${prefix}NOTIFIKASI SETORAN ANGGOTA BARU — KSP SENTRA`,
    '',
    `Ada pengajuan setoran baru yang masuk dan menunggu persetujuan (ACC) Admin / Bendahara:`,
    `• ID Pengajuan : ${payload.idSetoran}`,
    `• Waktu        : ${waktuLabel}`,
    `• Anggota      : ${payload.namaAnggota} (${payload.idAnggota})`,
    `• Jenis Setor  : ${jenisLabel}`,
    ...(payload.jenisSetoran === 'Gabungan'
      ? [
          `  - Iuran Wajib: ${formatRupiahServer(payload.jumlahSimpanan || 0)}`,
          `  - Angsuran   : ${formatRupiahServer(payload.jumlahAngsuran || 0)}`,
        ]
      : []),
    `• Total Nominal: ${totalFormatted}`,
    `• Metode Bayar : ${payload.metodeBayar}`,
    `• Keterangan   : ${payload.keterangan || '-'}`,
    '',
    `Silakan cek mutasi rekening/QRIS lalu lakukan ACC di aplikasi:`,
    appUrlClean,
  ];

  const html = `
<!DOCTYPE html>
<html lang="id">
  <body style="margin:0;padding:24px;background-color:#F4F6F3;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
      <tr>
        <td style="background:linear-gradient(135deg,#103D1B,#1E5B2A);padding:20px 24px;color:#FFFFFF;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#FCD34D;text-transform:uppercase;">
            ${escapeHtml(prefix)}Notifikasi Realtime KSP SENTRA
          </p>
          <h1 style="margin:6px 0 0;font-size:19px;font-weight:800;line-height:1.3;">
            Setoran Anggota Menunggu ACC
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 24px;">
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#334155;">
            Anggota baru saja mengirim konfirmasi pembayaran melalui aplikasi. Dana <strong>belum masuk ke saldo kas</strong> sebelum di-ACC oleh Admin atau Bendahara.
          </p>

          <div style="background:#F4FAF5;border:1px solid #BBF7D0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
            <p style="margin:0;font-size:11px;font-weight:700;color:#1E5B2A;text-transform:uppercase;">Total Nominal Ditransfer</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#103D1B;font-family:monospace;">
              ${escapeHtml(totalFormatted)}
            </p>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;border-collapse:collapse;">
            <tr>
              <td style="padding:7px 0;color:#64748B;width:38%;border-bottom:1px solid #F1F5F9;">Anggota</td>
              <td style="padding:7px 0;font-weight:700;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.namaAnggota)} (${escapeHtml(payload.idAnggota)})</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Jenis Setoran</td>
              <td style="padding:7px 0;font-weight:700;color:#1E5B2A;border-bottom:1px solid #F1F5F9;">${escapeHtml(jenisLabel)}</td>
            </tr>
            ${
              payload.jenisSetoran === 'Gabungan'
                ? `
            <tr>
              <td style="padding:7px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Rincian Pembagian</td>
              <td style="padding:7px 0;color:#0F172A;border-bottom:1px solid #F1F5F9;">Iuran ${escapeHtml(formatRupiahServer(payload.jumlahSimpanan || 0))} + Angsuran ${escapeHtml(formatRupiahServer(payload.jumlahAngsuran || 0))}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:7px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Metode Bayar</td>
              <td style="padding:7px 0;font-weight:600;color:#0F172A;border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.metodeBayar)}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Keterangan</td>
              <td style="padding:7px 0;color:#334155;border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.keterangan || '-')}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">ID Pengajuan</td>
              <td style="padding:7px 0;font-family:monospace;color:#334155;border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.idSetoran)}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#64748B;">Waktu Kirim</td>
              <td style="padding:7px 0;color:#334155;">${escapeHtml(waktuLabel)}</td>
            </tr>
          </table>

          <div style="margin-top:22px;text-align:center;">
            <a href="${escapeHtml(appUrlClean)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1E5B2A;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:12px 22px;border-radius:10px;">
              Buka Aplikasi &amp; ACC Sekarang →
            </a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#F8FAFC;padding:12px 24px;font-size:11px;color:#64748B;text-align:center;border-top:1px solid #E2E8F0;">
          KSP SENTRA · Bersama Membangun Umat
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  if (cfg.provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
    });

    await transporter.sendMail({
      from: cfg.smtpFrom,
      to: recipient,
      subject,
      text: textLines.join('\n'),
      html,
    });

    return { ok: true, sent: true, provider: 'smtp' };
  }

  // Resend API
  const recipients = recipient
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.resendFrom,
      to: recipients,
      subject,
      text: textLines.join('\n'),
      html,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    return {
      ok: false,
      sent: false,
      provider: 'resend',
      error: data.message || data.error || `Resend HTTP ${res.status}`,
    };
  }
  return { ok: true, sent: true, provider: 'resend' };
}
