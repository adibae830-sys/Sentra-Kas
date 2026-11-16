import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
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

interface AuthGateProps {
  googleUser: User | null;
  needsGoogleAuth: boolean;
  isGoogleSigningIn: boolean;
  spreadsheetInput: string;
  onSpreadsheetInputChange: (val: string) => void;
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        {/* Clean Brand Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sentra Kas
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Sistem Keuangan Anggota · Laporan Bulanan Otomatis & Notifikasi WhatsApp
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton />
            <a
              href={`https://docs.google.com/spreadsheets/d/${resolvedId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka Spreadsheet
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Kolom Kiri: Koneksi Google Sheets */}
          <div className="space-y-5 lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    01. Hubungkan Google Spreadsheet
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Masuk dengan akun Google yang memiliki akses edit ke spreadsheet catatan keuangan kelompok Anda.
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
                    />
                    {!needsGoogleAuth && (
                      <button
                        type="button"
                        onClick={onReloadSheet}
                        disabled={isLoadingSheet}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isLoadingSheet ? 'animate-spin' : ''}`}
                        />
                        Sinkronkan
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-slate-500">
                    ID aktif: {resolvedId}
                  </p>
                </div>

                {needsGoogleAuth ? (
                  <div className="pt-1">
                    <GoogleSignInButton
                      onClick={onGoogleLogin}
                      disabled={isGoogleSigningIn}
                      label={
                        isGoogleSigningIn
                          ? 'Menghubungkan akun Google...'
                          : 'Sign in with Google'
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                        <div className="text-xs">
                          <p className="font-semibold text-slate-900">
                            Terhubung sebagai {googleUser?.displayName || googleUser?.email}
                          </p>
                          <p className="text-slate-600">{googleUser?.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onGoogleLogout}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Ganti Akun
                      </button>
                    </div>

                    {isLoadingSheet && (
                      <p className="text-xs font-medium text-slate-600">
                        Membaca struktur sheet dan data transaksi...
                      </p>
                    )}

                    {sheetError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        {sheetError}
                      </div>
                    )}

                    {dataset && !isLoadingSheet && !sheetError && (
                      <div className="space-y-2 border-t border-emerald-200/80 pt-3 text-xs text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Nama File:</span>
                          <span className="font-semibold text-slate-900">
                            {dataset.spreadsheetTitle}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Data Terbaca:</span>
                          <span className="font-mono tabular-nums text-slate-900">
                            {dataset.anggota.length} anggota · {dataset.kasMasuk.length} kas masuk ·{' '}
                            {dataset.kasKeluar.length} kas keluar
                          </span>
                        </div>

                        {(missingCoreTabs.length > 0 ||
                          !dataset.availableTabs.includes('LaporanBulanan') ||
                          dataset.users.length === 0) && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="font-medium text-amber-900">
                              Struktur tab sheet belum lengkap atau akun admin belum tersedia.
                            </p>
                            <button
                              type="button"
                              onClick={onRequestSetupDatabase}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
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
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-900">
                Fitur Utama Aplikasi Sentra Kas
              </p>
              <ul className="mt-2 space-y-1.5">
                <li>
                  • Sinkronisasi langsung dengan data kelompok (<code className="font-mono">Anggota</code>,{' '}
                  <code className="font-mono">KasMasuk</code>,{' '}
                  <code className="font-mono">KasKeluar</code>,{' '}
                  <code className="font-mono">Pinjaman</code>,{' '}
                  <code className="font-mono">Angsuran</code>,{' '}
                  <code className="font-mono">Users</code>).
                </li>
                <li>
                  • Laporan bulanan otomatis dengan rincian pengeluaran per kategori dan grafik arus kas 6 bulan.
                </li>
                <li>
                  • Pengiriman ringkasan pengeluaran akhir bulan langsung ke WhatsApp seluruh anggota.
                </li>
              </ul>
            </div>
          </div>

          {/* Kolom Kanan: Login Role / Daftar Anggota */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                    {mode === 'login' ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <UserPlus className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {mode === 'login'
                        ? '02. Masuk ke Sistem Keuangan'
                        : '02. Pendaftaran Anggota Baru'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {mode === 'login'
                        ? 'Gunakan akun Administrator, Bendahara, atau Anggota dari sheet Users.'
                        : 'Akun dan ID anggota akan ditambahkan ke Google Sheet.'}
                    </p>
                  </div>
                </div>
              </div>

              {needsGoogleAuth || !dataset ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    Hubungkan akun Google Anda terlebih dahulu di panel sebelah kiri.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Setelah spreadsheet terbaca, form login peran (Administrator / Bendahara / Anggota) akan aktif secara otomatis.
                  </p>
                </div>
              ) : mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Contoh: admin"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
                    />
                  </div>

                  {loginError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
                  >
                    Masuk ke Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {quickUsers.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        Akun aktif di sheet Users (klik untuk mengisi username):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {quickUsers.slice(0, 6).map((u) => (
                          <button
                            key={u.username}
                            type="button"
                            onClick={() => setUsername(u.username)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
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
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Belum punya akun anggota? Daftar Anggota Mandiri
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      value={regNama}
                      onChange={(e) => setRegNama(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {loginError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Daftar Sekarang
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
