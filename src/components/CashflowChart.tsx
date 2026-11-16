import React, { useState } from 'react';
import { rupiah } from '../lib/financeEngine';

interface CashflowPoint {
  periode: string;
  label: string;
  masuk: number;
  keluar: number;
}

interface CashflowChartProps {
  series: CashflowPoint[];
}

function formatCompactRupiah(val: number): string {
  if (val >= 1_000_000) {
    const jt = val / 1_000_000;
    return `${jt % 1 === 0 ? jt.toFixed(0) : jt.toFixed(1)} jt`;
  }
  if (val >= 1_000) {
    return `${Math.round(val / 1_000)} rb`;
  }
  return String(val);
}

export const CashflowChart: React.FC<CashflowChartProps> = ({ series }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = Math.max(
    100000,
    ...series.flatMap((d) => [d.masuk, d.keluar])
  );

  const chartHeight = 220;
  const chartWidth = 640;
  const paddingLeft = 52;
  const paddingRight = 14;
  const paddingTop = 18;
  const paddingBottom = 34;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const slotWidth = innerWidth / Math.max(series.length, 1);
  const barWidth = Math.min(22, Math.max(12, slotWidth * 0.23));

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">
            Grafik Mutasi Arus Kas (6 Bulan)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Perbandingan dana masuk (kredit) dan pengeluaran (debit) per periode
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#00529C]" />
            <span>Dana Masuk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#F59E0B]" />
            <span>Dana Keluar</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-60 w-full overflow-visible"
          role="img"
          aria-label="Grafik mutasi dana masuk dan dana keluar 6 bulan terakhir"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + innerHeight * (1 - ratio);
            const labelVal = Math.round(maxValue * ratio);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  x2={chartWidth - paddingRight}
                  y1={y}
                  y2={y}
                  stroke={ratio === 0 ? '#cbd5e1' : '#e2e8f0'}
                  strokeWidth="1"
                  strokeDasharray={ratio === 0 ? undefined : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[10px]"
                >
                  {formatCompactRupiah(labelVal)}
                </text>
              </g>
            );
          })}

          {series.map((point, idx) => {
            const cx = paddingLeft + slotWidth * idx + slotWidth / 2;
            const masukHeight = (point.masuk / maxValue) * innerHeight;
            const keluarHeight = (point.keluar / maxValue) * innerHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={point.periode}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - slotWidth * 0.44}
                  y={paddingTop}
                  width={slotWidth * 0.88}
                  height={innerHeight}
                  rx="6"
                  fill={isHovered ? '#f1f5f9' : 'transparent'}
                />

                <rect
                  x={cx - barWidth - 3}
                  y={paddingTop + innerHeight - masukHeight}
                  width={barWidth}
                  height={Math.max(masukHeight, point.masuk > 0 ? 3 : 0)}
                  rx="3"
                  fill={isHovered ? '#003B73' : '#00529C'}
                />

                <rect
                  x={cx + 3}
                  y={paddingTop + innerHeight - keluarHeight}
                  width={barWidth}
                  height={Math.max(keluarHeight, point.keluar > 0 ? 3 : 0)}
                  rx="3"
                  fill={isHovered ? '#D97706' : '#F59E0B'}
                />

                <text
                  x={cx}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-semibold ${
                    isHovered ? 'fill-slate-900' : 'fill-slate-500'
                  }`}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs">
          {activePoint ? (
            <>
              <span className="font-semibold text-slate-900">
                Periode {activePoint.label}
              </span>
              <div className="flex items-center gap-5 font-mono tabular-nums">
                <span className="font-semibold text-[#00529C]">
                  Masuk: {rupiah(activePoint.masuk)}
                </span>
                <span className="font-semibold text-amber-600">
                  Keluar: {rupiah(activePoint.keluar)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-400">
              Arahkan kursor pada grafik untuk melihat rincian mutasi tiap bulan.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
