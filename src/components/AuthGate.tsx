import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSpreadsheet,
  Lock,
  LogOut,
  MessageCircle,
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
  const [showSheetSettings, setShowSheetSettings] = useState(false);

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
    <div className="flex min-h-dvh flex-col justify-between bg-[#F2F6FA]">
      {/* Full-Bleed Cobalt Banking Top Backdrop (BRImo / myBCA style) */}
      <div>
        <header className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-[#00224A] via-[#003E85] to-[#005EB8] px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-16 text-white shadow-md sm:px-8 sm:pt-8 sm:pb-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/[0.06]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/[0.04]"
          />

          <div className="relative mx-auto flex w-full max-w-md items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-white/10 backdrop-blur-xs">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-amber-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M3 20h18M5 20V10m14 10V10M3 10l9-6 9 6M9 20v-6h6v6" />
                </svg>
              </div>
              <div>
                <p className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                  Sentra Kas
                </p>
                <p className="text-[11px] font-medium text-blue-100/80">
                  e-Treasury Anggota
                </p>
              </div>
            </div>

            <PWAInstallButton />
          </div>

          <div className="relative mx-auto mt-6 w-full max-w-md sm:mt-8">
            <p className="text-[11px] font-bold tracking-[0.14em] text-amber-300 uppercase">
              Portal Keuangan Kelompok
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {savedSession ? `Halo, ${savedSession.nama}` : 'Selamat Datang'}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-blue-100/85 sm:text-sm">
              {needsGoogleAuth
                ? 'Masuk dengan akun Google untuk mengakses buku kas & mutasi.'
                : 'Silakan masuk menggunakan akun peran Anda.'}
            </p>
          </div>
        </header>

        {/* Overlapping Floating Banking Card */}
        <main className="relative z-10 mx-auto -mt-10 w-full max-w-md px-4 sm:px-0">
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-[#002855]/8 sm:p-6">
            {needsGoogleAuth ? (
              <div className="space-y-4">
                {savedSession && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-[#EBF3FC]/70 px-3.5 py-2.5 text-xs">
                    <span className="font-semibold text-[#00356B]">
                      Sesi tersimpan: {savedSession.role}
                    </span>
                    <button
                      type="button"
                      onClick={onClearSavedSession}
                      className="font-medium text-slate-500 hover:text-slate-900 hover:underline"
                    >
                      Keluar
                    </button>
                  </div>
                )}

                <GoogleSignInButton
                  onClick={() => onGoogleLogin(false)}
                  disabled={isGoogleSigningIn}
                  label={
                    isGoogleSigningIn
                      ? 'Menyambungkan...'
                      : savedSession
                        ? `Lanjutkan sebagai ${savedSession.role}`
                        : googleUser?.email
                          ? `Masuk sebagai ${googleUser.email}`
                          : 'Masuk dengan Google'
                  }
                />

                {googleUser && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => onGoogleLogin(true)}
                      className="text-xs font-semibold text-[#004A8F] hover:underline"
                    >
                      Ganti akun Google lain
                    </button>
                  </div>
                )}

                {sheetError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                    {sheetError}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Compact Connected Google Bar */}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {dataset?.spreadsheetTitle || 'Buku Kas Terhubung'}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {googleUser?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={onReloadSheet}
                      disabled={isLoadingSheet}
                      title="Muat ulang data"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-[#004A8F]"
                      aria-label="Sinkronkan ulang"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isLoadingSheet ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={onGoogleLogout}
                      title="Ganti akun Google"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-red-600"
                      aria-label="Ganti akun Google"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isLoadingSheet && (
                  <div className="rounded-xl border border-blue-100 bg-[#EBF3FC]/60 py-6 text-center text-xs font-medium text-[#004A8F]">
                    Memuat data buku kas...
                  </div>
                )}

                {sheetError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {sheetError}
                  </div>
                )}

                {dataset &&
                  !isLoadingSheet &&
                  !sheetError &&
                  (missingCoreTabs.length > 0 ||
                    !dataset.availableTabs.includes('LaporanBulanan') ||
                    dataset.users.length === 0) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                      <p className="font-semibold text-amber-900">
                        Struktur tab sheet belum lengkap atau akun admin belum ada.
                      </p>
                      <button
                        type="button"
                        onClick={onRequestSetupDatabase}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Setup Sheet & Admin Otomatis
                      </button>
                    </div>
                  )}

                {/* Role Sign-In or Member Registration */}
                {dataset && !isLoadingSheet && (
                  <>
                    {mode === 'login' ? (
                      <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Username
                          </label>
                          <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Masukkan username"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            Password / PIN
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

                        {quickUsers.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                              Pilih cepat akun:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {quickUsers.slice(0, 6).map((u) => (
                                <button
                                  key={u.username}
                                  type="button"
                                  onClick={() => setUsername(u.username)}
                                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    username === u.username
                                      ? 'border-[#004A8F] bg-[#EBF3FC] text-[#004A8F]'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {u.nama}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {loginError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                            {loginError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#004A8F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003870]"
                        >
                          Masuk
                          <ArrowRight className="h-4 w-4" />
                        </button>

                        <div className="pt-1 text-center">
                          <button
                            type="button"
                            onClick={() => setMode('register')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004A8F] hover:underline"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Daftar Anggota Baru
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleRegisterSubmit} className="space-y-3">
                        <p className="text-sm font-bold text-slate-900">
                          Daftar Anggota Baru
                        </p>

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

                        <div className="flex items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setMode('login')}
                            className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Kembali
                          </button>
                          <button
                            type="submit"
                            className="min-h-[44px] flex-1 rounded-xl bg-[#004A8F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003870]"
                          >
                            Daftar
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Collapsible Spreadsheet Settings */}
            <div className="mt-5 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={() => setShowSheetSettings((prev) => !prev)}
                className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-[#004A8F]" />
                  Pengaturan Buku Kas (Spreadsheet)
                </span>
                {showSheetSettings ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showSheetSettings && (
                <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                  <label
                    htmlFor="sheet-url-input"
                    className="block text-[11px] font-semibold text-slate-600"
                  >
                    Tautan atau ID Google Spreadsheet
                  </label>
                  <input
                    id="sheet-url-input"
                    type="text"
                    value={spreadsheetInput}
                    onChange={(e) => onSpreadsheetInputChange(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800"
                  />
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate font-mono text-slate-400">
                      ID: {resolvedId}
                    </span>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${resolvedId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#004A8F] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Buka Sheet
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Balanced Bottom Feature Highlights & Security Footer */}
      <footer className="mx-auto mt-6 w-full max-w-md px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-0">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/80 px-2 py-3 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#004A8F]">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-800">Buku Kas Live</p>
            <p className="text-[10px] text-slate-500">Sinkron Sheets</p>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/80 px-2 py-3 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#004A8F]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-800">Akses Peran</p>
            <p className="text-[10px] text-slate-500">Admin & Anggota</p>
          </div>
          <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white/80 px-2 py-3 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EBF3FC] text-[#004A8F]">
              <MessageCircle className="h-4 w-4" />
            </span>
            <p className="mt-1.5 text-[11px] font-semibold text-slate-800">Info Grup WA</p>
            <p className="text-[10px] text-slate-500">Laporan & Gambar</p>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Lock className="h-3 w-3 text-[#004A8F]" />
          Dilindungi otorisasi Google · Sentra Kas
        </p>
      </footer>
    </div>
  );
};
