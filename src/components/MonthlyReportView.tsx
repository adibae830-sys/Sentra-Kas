import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageCircle,
  Printer,
  Send,
  Share2,
} from 'lucide-react';
import {
  buildWhatsAppMonthlyMessage,
  computeMonthlyReport,
  formatNoWA,
  formatPeriodeLabel,
  formatTanggalId,
  getAvailablePeriods,
  rupiah,
} from '../lib/financeEngine';
import { dataUrlToBlob, generateRingkasanSaldoImage } from '../lib/reportImage';
import {
  FinanceDataset,
  MonthlyMemberBreakdown,
  RoleType,
} from '../types/finance';

interface MonthlyReportViewProps {
  dataset: FinanceDataset;
  role: RoleType;
  onArchiveReport: (reportData: {
    periode: string;
    totalMasuk: number;
    totalKeluar: number;
    surplusDefisit: number;
    saldoAkhir: number;
    totalPiutang: number;
    jumlahAnggota: number;
    statusKirimWa: string;
  }) => void;
  onLogWhatsAppDispatch: (
    entries: Array<{
      periode: string;
      idAnggota: string;
      nama: string;
      nohp: string;
      tipe: string;
      status: string;
      ringkasan: string;
    }>
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

interface GatewayStatus {
  configured: boolean;
  provider: string;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  dataset,
  role,
  onArchiveReport,
  onLogWhatsAppDispatch,
  onNotify,
}) => {
  const periods = useMemo(() => getAvailablePeriods(dataset), [dataset]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>(periods[0] || '');
  const [previewMemberId, setPreviewMemberId] = useState<string>('');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({
    configured: false,
    provider: 'fonnte',
  });
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [copiedGroupMsg, setCopiedGroupMsg] = useState(false);
  const [copiedSummaryImg, setCopiedSummaryImg] = useState(false);

  useEffect(() => {
    if (!periods.includes(selectedPeriode) && periods.length > 0) {
      setSelectedPeriode(periods[0]);
    }
  }, [periods, selectedPeriode]);

  useEffect(() => {
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((data) => setGatewayStatus(data))
      .catch(() => {});
  }, []);

  const report = useMemo(
    () => computeMonthlyReport(dataset, selectedPeriode),
    [dataset, selectedPeriode]
  );

  const selectedMember: MonthlyMemberBreakdown | undefined = useMemo(
    () => report.rekapAnggota.find((m) => m.idAnggota === previewMemberId),
    [report.rekapAnggota, previewMemberId]
  );

  const previewMessage = useMemo(
    () => buildWhatsAppMonthlyMessage(report, selectedMember),
    [report, selectedMember]
  );

  const summaryImage = useMemo(
    () =>
      generateRingkasanSaldoImage(dataset, {
        subtitle: `Rekapitulasi Periode ${report.periodeLabel}`,
      }),
    [dataset, report.periodeLabel]
  );

  const isAdminOrBendahara = role === 'Administrator' || role === 'Bendahara';

  const handleCopyGroupMessage = async () => {
    const groupText = buildWhatsAppMonthlyMessage(report);
    await navigator.clipboard.writeText(groupText);
    setCopiedGroupMsg(true);
    setTimeout(() => setCopiedGroupMsg(false), 2000);
    onNotify('success', 'Ringkasan pesan grup WhatsApp berhasil disalin.');
  };

  const handleDownloadSummaryImage = () => {
    if (!summaryImage.dataUrl) return;
    const link = document.createElement('a');
    link.href = summaryImage.dataUrl;
    link.download = summaryImage.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('success', 'Gambar rincian saldo & anggota berhasil diunduh.');
  };

  const handleCopySummaryImage = async () => {
    if (!summaryImage.dataUrl) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        onNotify('error', 'Browser belum mendukung salin gambar langsung. Silakan klik Unduh Gambar (.png).');
        return;
      }
      const blob = dataUrlToBlob(summaryImage.dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedSummaryImg(true);
      setTimeout(() => setCopiedSummaryImg(false), 2000);
      onNotify('success', 'Gambar rincian saldo disalin! Tinggal Ctrl+V di grup WhatsApp.');
    } catch {
      onNotify('error', 'Gagal menyalin gambar ke clipboard. Gunakan tombol Unduh Gambar (.png).');
    }
  };

  const handleShareImageAndText = async () => {
    if (!summaryImage.dataUrl) return;
    const groupText = buildWhatsAppMonthlyMessage(report);
    try {
      const blob = dataUrlToBlob(summaryImage.dataUrl);
      const file = new File([blob], summaryImage.filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Ringkasan Saldo Sentra Kas · ${report.periodeLabel}`,
          text: groupText,
          files: [file],
        });
        return;
      }
      onNotify('error', 'Perangkat tidak mendukung bagikan file langsung. Salin Gambar atau Unduh (.png).');
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        onNotify('error', 'Gagal membuka menu berbagi sistem.');
      }
    }
  };

  const handleServerBroadcast = async () => {
    const validMembers = report.rekapAnggota.filter(
      (m) => formatNoWA(m.nohp).length >= 10
    );
    if (validMembers.length === 0) {
      onNotify('error', 'Tidak ada anggota aktif dengan nomor WhatsApp yang valid.');
      return;
    }

    setIsBroadcasting(true);
    try {
      const payload = {
        recipients: validMembers.map((m) => ({
          idAnggota: m.idAnggota,
          nama: m.nama,
          nohp: m.nohp,
          message: buildWhatsAppMonthlyMessage(report, m),
        })),
      };

      const res = await fetch('/api/whatsapp/broadcast-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        onNotify('error', data?.error || 'Gagal mengirim broadcast WhatsApp.');
        return;
      }

      const logEntries = (data.results || []).map(
        (r: { idAnggota: string; nama: string; nohp: string; success: boolean }) => ({
          periode: report.periode,
          idAnggota: r.idAnggota,
          nama: r.nama,
          nohp: r.nohp,
          tipe: 'Laporan Bulanan Otomatis',
          status: r.success ? 'Terkirim' : 'Gagal',
          ringkasan: `Keluar: ${rupiah(report.totalKeluarBulan)} | Saldo: ${rupiah(
            report.saldoKasKumulatif
          )}`,
        })
      );

      if (logEntries.length > 0) {
        await onLogWhatsAppDispatch(logEntries);
      }

      onNotify(
        'success',
        `Broadcast selesai: ${data.sentCount} dari ${data.total} anggota berhasil dikirimi ringkasan WhatsApp.`
      );
    } catch (err) {
      onNotify(
        'error',
        err instanceof Error ? err.message : 'Gagal menghubungi server WhatsApp.'
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Laporan Bulanan & Rekapitulasi Mutasi
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Rekapitulasi otomatis kas masuk, pengeluaran per kategori, dan notifikasi WhatsApp akhir bulan.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <select
            value={selectedPeriode}
            onChange={(e) => setSelectedPeriode(e.target.value)}
            aria-label="Pilih periode bulan laporan"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {formatPeriodeLabel(p)} ({p})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5 text-[#00529C]" />
            Cetak PDF
          </button>

          {isAdminOrBendahara && (
            <button
              type="button"
              onClick={() =>
                onArchiveReport({
                  periode: report.periode,
                  totalMasuk: report.totalMasukBulan,
                  totalKeluar: report.totalKeluarBulan,
                  surplusDefisit: report.surplusDefisit,
                  saldoAkhir: report.saldoKasKumulatif,
                  totalPiutang: report.totalPiutangBerjalan,
                  jumlahAnggota: report.anggotaAktifCount,
                  statusKirimWa: gatewayStatus.configured ? 'Siap Kirim' : 'Manual WA',
                })
              }
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-[#004A8F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#003870]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Arsipkan ke Sheet
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip with Banking Cobalt Focal Card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#00356B] via-[#004A8F] to-[#0062BD] p-5 text-white shadow-xs">
          <p className="text-xs font-semibold text-blue-100">
            Saldo Akhir Rekening Kas
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
            {rupiah(report.saldoKasKumulatif)}
          </p>
          <p className="mt-1.5 text-xs font-medium text-amber-300">
            Piutang berjalan: {rupiah(report.totalPiutangBerjalan)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">
            Dana Masuk ({report.periodeLabel})
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-700">
            {rupiah(report.totalMasukBulan)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {report.transaksiMasukBulan.length} mutasi kredit tercatat
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">
            Dana Keluar ({report.periodeLabel})
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-600">
            {rupiah(report.totalKeluarBulan)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            {report.transaksiKeluarBulan.length} pos mutasi debit
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Surplus / Defisit Bulan Ini</p>
          <p
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              report.surplusDefisit >= 0 ? 'text-[#004A8F]' : 'text-red-600'
            }`}
          >
            {rupiah(report.surplusDefisit)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Selisih mutasi masuk & keluar bulan ini
          </p>
        </div>
      </div>

      {/* Expense Breakdown + WhatsApp Center */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Rincian Pengeluaran Kelompok */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rincian Pengeluaran Kelompok
                </h3>
                <p className="text-xs text-slate-500">
                  Distribusi biaya dan pencairan periode {report.periodeLabel}
                </p>
              </div>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                {rupiah(report.totalKeluarBulan)}
              </span>
            </div>

            {report.pengeluaranPerKategori.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-6 text-center text-sm text-slate-500">
                Belum ada pengeluaran tercatat pada periode {report.periodeLabel}.
              </div>
            ) : (
              <div className="space-y-4">
                {report.pengeluaranPerKategori.map((cat) => (
                  <div key={cat.jenis} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">
                        {cat.jenis} ·{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {cat.count} transaksi
                        </span>
                      </span>
                      <span className="font-mono font-bold tabular-nums text-slate-900">
                        {rupiah(cat.total)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#00529C] transition-all"
                        style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-3">Tanggal</th>
                    <th className="py-2.5 pr-3">Kategori</th>
                    <th className="py-2.5 pr-3">Keterangan</th>
                    <th className="py-2.5 text-right">Nominal Debit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.transaksiKeluarBulan.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                        Tidak ada baris kas keluar pada bulan ini.
                      </td>
                    </tr>
                  ) : (
                    report.transaksiKeluarBulan.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/90">
                        <td className="whitespace-nowrap py-3 pr-3 text-xs text-slate-500">
                          {formatTanggalId(tx.tanggal)}
                        </td>
                        <td className="py-3 pr-3 font-semibold text-slate-800">
                          {tx.jenis}
                        </td>
                        <td className="py-3 pr-3 text-slate-600">
                          {tx.keterangan || '-'}
                        </td>
                        <td className="whitespace-nowrap py-3 text-right font-mono font-semibold tabular-nums text-amber-600">
                          {rupiah(tx.jumlah)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pusat Notifikasi WhatsApp Akhir Bulan */}
        <div className="no-print space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Notifikasi WhatsApp Akhir Bulan
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Mode Pengiriman:{' '}
                <span className="font-semibold text-[#004A8F]">
                  {gatewayStatus.configured
                    ? `Gateway Server Aktif (${gatewayStatus.provider.toUpperCase()})`
                    : 'Tautan Langsung WhatsApp per Anggota'}
                </span>
              </p>
            </div>

            {isAdminOrBendahara && (
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Pratinjau Pesan (Grup atau Personal Anggota)
                </label>
                <select
                  value={previewMemberId}
                  onChange={(e) => setPreviewMemberId(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">Pesan Broadcast Grup (Ringkasan Umum)</option>
                  {report.rekapAnggota.map((m) => (
                    <option key={m.idAnggota} value={m.idAnggota}>
                      Personal: {m.nama} ({m.nohp || 'Tanpa No HP'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 font-sans text-xs leading-relaxed text-slate-800">
              {previewMessage}
            </pre>

            {summaryImage.dataUrl && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <ImageIcon className="h-3.5 w-3.5 text-[#004A8F]" />
                    Lampiran Gambar Rincian Saldo & Anggota
                  </span>
                  <span className="text-[11px] text-slate-500">PNG · Siap Tempel WA</span>
                </div>
                <img
                  src={summaryImage.dataUrl}
                  alt="Gambar Rincian Saldo Kelompok dan Anggota"
                  className="max-h-52 w-full rounded-lg border border-slate-200 bg-white object-contain"
                />
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummaryImage}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedSummaryImg ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-[#00529C]" />
                    )}
                    {copiedSummaryImg ? 'Gambar Disalin' : 'Salin Gambar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummaryImage}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-[#00529C]" />
                    Unduh (.png)
                  </button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={handleShareImageAndText}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[#004A8F] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#003870]"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Bagikan Gambar + Teks
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  buildWhatsAppMonthlyMessage(report)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                Bagikan ke Grup WA
              </a>

              <button
                type="button"
                onClick={handleCopyGroupMessage}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedGroupMsg ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 text-[#00529C]" />
                )}
                {copiedGroupMsg ? 'Tersalin' : 'Salin Pesan'}
              </button>

              {isAdminOrBendahara && (
                <button
                  type="button"
                  onClick={handleServerBroadcast}
                  disabled={isBroadcasting || !gatewayStatus.configured}
                  title={
                    gatewayStatus.configured
                      ? 'Kirim otomatis ke seluruh anggota via gateway server'
                      : 'Aktifkan WHATSAPP_API_TOKEN di environment server untuk kirim massal otomatis, atau gunakan tombol Bagikan ke Grup WA'
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#004A8F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#003870] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send className="h-4 w-4" />
                  {isBroadcasting
                    ? 'Mengirim...'
                    : gatewayStatus.configured
                    ? `Broadcast (${report.rekapAnggota.length})`
                    : 'Broadcast Server (Nonaktif)'}
                </button>
              )}
            </div>

            {!gatewayStatus.configured && isAdminOrBendahara && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Tip: Klik <strong>Salin Gambar</strong> lalu tempel (Ctrl+V) ke grup WhatsApp bersama ringkasan pesan, atau gunakan <strong>Bagikan Gambar + Teks</strong> di HP.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Daftar Penerima Anggota & Dispatch WhatsApp Langsung */}
      {isAdminOrBendahara && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Daftar Ringkasan & Pengiriman WhatsApp Anggota
              </h3>
              <p className="text-xs text-slate-500">
                Kirim ringkasan pengeluaran kelompok beserta catatan simpanan dan pinjaman masing-masing anggota.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {report.rekapAnggota.length} anggota aktif
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-3">Anggota</th>
                  <th className="py-2.5 pr-3">No WhatsApp</th>
                  <th className="py-2.5 pr-3 text-right">Simpanan Bulan Ini</th>
                  <th className="py-2.5 pr-3 text-right">Total Simpanan</th>
                  <th className="py-2.5 pr-3 text-right">Sisa Pinjaman</th>
                  <th className="py-2.5 pr-3">Status Iuran</th>
                  <th className="no-print py-2.5 text-right">Kirim WA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rekapAnggota.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                      Belum ada anggota aktif yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  report.rekapAnggota.map((m) => {
                    const waNum = formatNoWA(m.nohp);
                    const personalText = buildWhatsAppMonthlyMessage(report, m);
                    const waHref = `https://wa.me/${waNum}?text=${encodeURIComponent(
                      personalText
                    )}`;

                    return (
                      <tr key={m.idAnggota} className="hover:bg-slate-50/90">
                        <td className="py-3.5 pr-3">
                          <div className="font-semibold text-slate-900">{m.nama}</div>
                          <div className="font-mono text-xs text-slate-500">{m.idAnggota}</div>
                        </td>
                        <td className="py-3.5 pr-3 font-mono text-xs text-slate-700">
                          {m.nohp || '-'}
                        </td>
                        <td className="py-3.5 pr-3 text-right font-mono tabular-nums text-slate-800">
                          {rupiah(m.simpananBulanIni)}
                        </td>
                        <td className="py-3.5 pr-3 text-right font-mono tabular-nums text-slate-800">
                          {rupiah(m.totalSimpananKumulatif)}
                        </td>
                        <td className="py-3.5 pr-3 text-right font-mono tabular-nums text-slate-800">
                          {rupiah(m.sisaPinjamanAktif)}
                        </td>
                        <td className="py-3.5 pr-3 text-xs font-semibold">
                          <span
                            className={
                              m.statusIuranWajib === 'Lunas Bulan Ini'
                                ? 'text-emerald-700'
                                : 'text-amber-600'
                            }
                          >
                            {m.statusIuranWajib}
                          </span>
                        </td>
                        <td className="no-print py-3.5 text-right">
                          {waNum.length >= 10 ? (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-200 bg-[#EBF3FC] px-3 py-1.5 text-xs font-semibold text-[#004A8F] transition-colors hover:bg-blue-100"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Kirim WA
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">No HP kosong</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Riwayat Arsip & Log WhatsApp */}
      {isAdminOrBendahara &&
        (dataset.laporanBulanan.length > 0 || dataset.logWhatsApp.length > 0) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <h3 className="mb-3 text-base font-bold text-slate-900">
                Arsip Laporan Bulanan
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-2">Periode</th>
                      <th className="py-2 pr-2 text-right">Masuk</th>
                      <th className="py-2 pr-2 text-right">Keluar</th>
                      <th className="py-2 text-right">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataset.laporanBulanan
                      .slice(-6)
                      .reverse()
                      .map((lap) => (
                        <tr key={lap.idLaporan}>
                          <td className="py-2.5 pr-2 font-mono font-semibold text-slate-800">
                            {lap.periode}
                          </td>
                          <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-emerald-700">
                            {rupiah(lap.totalMasuk)}
                          </td>
                          <td className="py-2.5 pr-2 text-right font-mono tabular-nums text-amber-600">
                            {rupiah(lap.totalKeluar)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                            {rupiah(lap.saldoAkhir)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
              <h3 className="mb-3 text-base font-bold text-slate-900">
                Riwayat Pengiriman WhatsApp Terbaru
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-2">Periode</th>
                      <th className="py-2 pr-2">Anggota</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2">Ringkasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataset.logWhatsApp
                      .slice(-6)
                      .reverse()
                      .map((log) => (
                        <tr key={log.idLog}>
                          <td className="py-2.5 pr-2 font-mono text-slate-700">
                            {log.periode}
                          </td>
                          <td className="py-2.5 pr-2 font-medium text-slate-900">
                            {log.nama}
                          </td>
                          <td className="py-2.5 pr-2 font-semibold">
                            <span
                              className={
                                log.status === 'Terkirim'
                                  ? 'text-emerald-700'
                                  : 'text-red-600'
                              }
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-500">{log.ringkasan}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
