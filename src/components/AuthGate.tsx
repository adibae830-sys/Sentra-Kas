import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { extractSpreadsheetId } from '../lib/sheetsApi';
import { AppUser, FinanceDataset } from '../types/finance';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

export interface SavedAppSessionHint {
  username: string;
  nama: string;
  role: string;
}

interface AuthGateProps {
  googleUser: User | null;
  needsGoogleAuth: boolean;
  isGoogleSigningIn: boolean;
  spreadsheetInput: string;
  onSpreadsheetInputChange: (val: string) => void;
  onGoogleLogin: (forceAccountPicker?: boolean) => void;
  onGoogleLogout: () => void;
  savedSession: SavedAppSessionHint | null;
  onClearSavedSession: () => void;
  dataset: FinanceDataset | null;
  isLoadingSheet: boolean;
  sheetError: string | null;
  onReloadSheet: () => void;
  onRequestSetupDatabase: () => void;
  onAppLogin: (username: string, password: string) => void;
  onRegisterMember: (payload: {
    nama: string;
    alamat: string;
    nohp: string;
    username: string;
    password: string;
  }) => void;
  loginError: string | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  googleUser,
  needsGoogleAuth,
  isGoogleSigningIn,
  spreadsheetInput,
  onSpreadsheetInputChange,
  onGoogleLogin,
  onGoogleLogout,
  savedSession,
  onClearSavedSession,
  dataset,
  isLoadingSheet,
  sheetError,
  onReloadSheet,
  onRequestSetupDatabase,
  onAppLogin,
  onRegisterMember,
  loginError,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [regNama, setRegNama] = useState('');
  const [regAlamat, setRegAlamat] = useState('');
  const [regNohp, setRegNohp] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const resolvedId = extractSpreadsheetId(spreadsheetInput);
  const missingCoreTabs = dataset
    ? ['Users', 'Anggota', 'KasMasuk', 'KasKeluar', 'Pinjaman', 'Angsuran'].filter(
        (t) => !dataset.availableTabs.includes(t)
      )
    : [];

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAppLogin(username, password);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterMember({
      nama: regNama,
      alamat: regAlamat,
      nohp: regNohp,
      username: regUsername,
      password: regPassword,
    });
  };

  const quickUsers: AppUser[] = dataset?.users.filter((u) => u.status === 'Aktif') || [];

  return (
    <div className="min-h-screen bg-[#F2F6FA] lg:grid lg:grid-cols-12">
      {/* Left Banking Cobalt Trust Panel (Compact App Header on Mobile) */}
      <aside className="relative flex flex-col justify-between overflow-hidden rounded-b-3xl bg-gradient-to-br from-[#002855] via-[#003F88] to-[#0059B3] px-5 py-6 text-blue-50 shadow-md lg:col-span-5 lg:rounded-none lg:px-12 lg:py-12 lg:shadow-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-28 h-96 w-96 rounded-full border border-white/10 bg-white/[0.03]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none hidden lg:block absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-white/10 bg-white/[0.03]"
        />

        <div className="relative">
          {/* Brand Emblem */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/40 bg-white/10 backdrop-blur-xs">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M3 20h18M5 20V10m14 10V10M3 10l9-6 9 6M9 20v-6h6v6" />
                </svg>
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-white lg:text-xl">
                  Sentra Kas
                </span>
                <p className="text-[10.5px] font-medium tracking-wider text-blue-200 uppercase lg:text-[11px]">
                  e-Treasury & Simpan Pinjam
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300 lg:hidden">
              <Lock className="h-3 w-3" />
              Terverifikasi
            </span>
          </div>

          <h1 className="mt-4 text-xl leading-snug font-extrabold tracking-tight text-balance text-white lg:mt-10 lg:max-w-md lg:text-4xl">
            Layanan Kas Kelompok Modern, Aman, dan Real-Time.
          </h1>
          <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-blue-100/85 lg:mt-4 lg:block">
            Pantau saldo rekening kas, mutasi masuk dan keluar, pengajuan pinjaman, angsuran digital, serta laporan bulanan via WhatsApp dalam satu sistem terpadu.
          </p>

          <div className="mt-10 hidden divide-y divide-white/15 border-y border-white/15 lg:block">
            <div className="py-4">
              <p className="text-xs font-bold tracking-wide text-amber-300">
                01. Mutasi & Rekening Terpusat
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-100/80">
                Setiap setoran simpanan, pengeluaran, pencairan pinjaman, dan angsuran tercatat otomatis layaknya mutasi rekening perbankan.
              </p>
            </div>
            <div className="py-4">
              <p className="text-xs font-bold tracking-wide text-amber-300">
                02. Laporan & e-Resi Digital
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-100/80">
                Rekapitulasi keuangan akhir bulan tersusun otomatis lengkap dengan bukti transaksi digital yang siap cetak atau simpan PDF.
              </p>
            </div>
            <div className="py-4">
              <p className="text-xs font-bold tracking-wide text-amber-300">
                03. Notifikasi WhatsApp Anggota
              </p>
              <p className="mt-1 text-xs leading-relaxed text-blue-100/80">
                Pengurus dapat mengirimkan ringkasan saldo, rincian pengeluaran, dan pengingat angsuran langsung ke WhatsApp anggota.
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-10 hidden items-center gap-2.5 text-xs text-blue-100/80 lg:flex">
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            Dilindungi otorisasi resmi Google & verifikasi akses berlapis per peran.
          </span>
        </div>
      </aside>

      {/* Right Interactive Workspace */}
      <main className="flex flex-col justify-between px-4 py-5 sm:px-8 lg:col-span-7 lg:px-14 lg:py-10">
        <div className="mx-auto w-full max-w-xl">
          {/* Top Utility Row */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3.5 lg:mb-8 lg:pb-4">
            <span className="text-xs font-bold tracking-wide text-[#004A8F] uppercase">
              Portal Akses e-Banking Kas
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <PWAInstallButton />
              <a
                href={`https://docs.google.com/spreadsheets/d/${resolvedId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#00529C]" />
                Buka Spreadsheet
              </a>
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1: Google Sheets Authorization */}
            <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-[#EBF3FC] text-[#004A8F]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Langkah 1 · Hubungkan Buku Rekening (Spreadsheet)
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Masuk menggunakan akun Google yang memiliki izin akses ke spreadsheet keuangan kelompok Anda.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="sheet-url-input"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Tautan atau ID Google Spreadsheet
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="sheet-url-input"
                      type="text"
                      value={spreadsheetInput}
                      onChange={(e) => onSpreadsheetInputChange(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-800"
                    />
                    {!needsGoogleAuth && (
                      <button
                        type="button"
                        onClick={onReloadSheet}
                        disabled={isLoadingSheet}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 text-[#00529C] ${isLoadingSheet ? 'animate-spin' : ''}`}
                        />
                        Sinkronkan
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                    ID aktif: {resolvedId}
                  </p>
                </div>

                {needsGoogleAuth ? (
                  <div className="space-y-3 pt-1">
                    {(googleUser || savedSession) && (
                      <div className="rounded-xl border border-blue-200 bg-[#EBF3FC]/70 p-4 text-xs">
                        <p className="font-bold text-[#00356B]">
                          Sesi Sebelumnya Dikenali
                          {savedSession ? ` · ${savedSession.nama} (${savedSession.role})` : ''}
                        </p>
                        <p className="mt-1 leading-relaxed text-slate-600">
                          {googleUser?.email
                            ? `Akun Google ${googleUser.email} tetap aktif. `
                            : ''}
                          Demi keamanan perbankan browser, token akses Google Sheets dibersihkan setiap halaman di-refresh. Klik tombol di bawah untuk langsung masuk kembali tanpa mengetik ulang password.
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-3">
                          {googleUser && (
                            <button
                              type="button"
                              onClick={() => onGoogleLogin(true)}
                              className="font-semibold text-[#004A8F] underline underline-offset-2 hover:text-[#002D5E]"
                            >
                              Ganti akun Google lain
                            </button>
                          )}
                          {savedSession && (
                            <button
                              type="button"
                              onClick={onClearSavedSession}
                              className="font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
                            >
                              Keluar dari sesi {savedSession.username}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <GoogleSignInButton
                      onClick={() => onGoogleLogin(false)}
                      disabled={isGoogleSigningIn}
                      label={
                        isGoogleSigningIn
                          ? 'Menyambungkan kembali...'
                          : savedSession
                            ? `Lanjutkan sebagai ${savedSession.role} via Google`
                            : googleUser?.email
                              ? `Lanjutkan dengan ${googleUser.email}`
                              : 'Sign in with Google'
                      }
                    />
                    {sheetError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                        {sheetError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-blue-200 bg-[#EBF3FC]/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="text-xs">
                          <p className="font-bold text-slate-900">
                            Terhubung · {googleUser?.displayName || googleUser?.email}
                          </p>
                          <p className="text-slate-600">{googleUser?.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onGoogleLogout}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Ganti Akun
                      </button>
                    </div>

                    {isLoadingSheet && (
                      <p className="text-xs font-medium text-slate-600">
                        Memverifikasi struktur tabel dan memuat transaksi...
                      </p>
                    )}

                    {sheetError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        {sheetError}
                      </div>
                    )}

                    {dataset && !isLoadingSheet && !sheetError && (
                      <div className="space-y-2 border-t border-blue-200/70 pt-3 text-xs text-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">Dokumen Terhubung:</span>
                          <span className="truncate font-bold text-slate-900">
                            {dataset.spreadsheetTitle}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">Rekap Data:</span>
                          <span className="font-mono tabular-nums text-slate-900">
                            {dataset.anggota.length} anggota · {dataset.kasMasuk.length} kas masuk ·{' '}
                            {dataset.kasKeluar.length} kas keluar
                          </span>
                        </div>

                        {(missingCoreTabs.length > 0 ||
                          !dataset.availableTabs.includes('LaporanBulanan') ||
                          dataset.users.length === 0) && (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="font-semibold text-amber-900">
                              Struktur tab sheet belum lengkap atau akun admin belum tersedia.
                            </p>
                            <button
                              type="button"
                              onClick={onRequestSetupDatabase}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                            >
                              Setup Struktur Sheet & Admin Otomatis
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Role Sign-In / Member Registration */}
            <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <div className="mb-5 flex items-center gap-3.5 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-[#F2F6FA] text-[#004A8F]">
                  {mode === 'login' ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {mode === 'login'
                      ? 'Langkah 2 · Masuk ke Akun Pengguna'
                      : 'Langkah 2 · Pendaftaran Anggota Baru'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {mode === 'login'
                      ? 'Masuk sebagai Administrator, Bendahara, atau Anggota sesuai sheet Users.'
                      : 'Data dan nomor anggota akan langsung tersimpan di buku besar.'}
                  </p>
                </div>
              </div>

              {needsGoogleAuth || !dataset ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-[#F8FAFC] p-7 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {savedSession
                      ? `Akun ${savedSession.nama} (${savedSession.role}) siap dipulihkan otomatis.`
                      : 'Menunggu otorisasi Google Spreadsheet pada Langkah 1.'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {savedSession
                      ? 'Klik tombol Google pada Langkah 1 untuk langsung masuk ke dashboard tanpa mengisi ulang password.'
                      : 'Setelah terhubung, formulir login peran akan aktif secara otomatis.'}
                  </p>
                </div>
              ) : mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        User ID / Username
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Contoh: admin"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                        PIN / Password
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003870]"
                  >
                    Masuk ke Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {quickUsers.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Akun aktif terdeteksi (klik untuk mengisi username):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickUsers.slice(0, 6).map((u) => (
                          <button
                            key={u.username}
                            type="button"
                            onClick={() => setUsername(u.username)}
                            className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#00529C]/40 hover:bg-[#EBF3FC]"
                          >
                            {u.nama} · <span className="text-slate-500">{u.role}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="text-xs font-semibold text-[#004A8F] hover:underline"
                    >
                      Belum memiliki akun anggota? Daftar Anggota Mandiri
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      value={regNama}
                      onChange={(e) => setRegNama(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        No HP / WhatsApp
                      </label>
                      <input
                        type="tel"
                        required
                        value={regNohp}
                        onChange={(e) => setRegNohp(e.target.value)}
                        placeholder="0812..."
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Alamat
                      </label>
                      <input
                        type="text"
                        value={regAlamat}
                        onChange={(e) => setRegAlamat(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {loginError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#003870]"
                    >
                      Daftar Sekarang
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>

        <footer className="mx-auto mt-8 w-full max-w-xl text-center text-[11px] text-slate-400">
          Sentra Kas · Sistem Manajemen Keuangan & Layanan Kas Kelompok Digital
        </footer>
      </main>
    </div>
  );
};
