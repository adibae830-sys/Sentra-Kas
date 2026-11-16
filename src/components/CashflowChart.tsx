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

export const CashflowChart: React.FC<CashflowChartProps> = ({ series }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxValue = Math.max(
    100000,
    ...series.flatMap((d) => [d.masuk, d.keluar])
  );

  const chartHeight = 200;
  const chartWidth = 640;
  const paddingLeft = 16;
  const paddingRight = 16;
  const paddingTop = 18;
  const paddingBottom = 34;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const slotWidth = innerWidth / Math.max(series.length, 1);
  const barWidth = Math.min(24, Math.max(12, slotWidth * 0.24));

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Arus Kas 6 Bulan Terakhir
          </h3>
          <p className="text-xs text-slate-500">
            Perbandingan kas masuk dan pengeluaran kelompok per bulan
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
            <span>Kas Masuk</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
            <span>Kas Keluar</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-56 w-full overflow-visible"
          role="img"
          aria-label="Grafik arus kas masuk dan kas keluar 6 bulan terakhir"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + innerHeight * (1 - ratio);
            return (
              <line
                key={idx}
                x1={paddingLeft}
                x2={chartWidth - paddingRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={ratio === 0 ? undefined : '3 3'}
              />
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
                  fill="#059669"
                />

                <rect
                  x={cx + 3}
                  y={paddingTop + innerHeight - keluarHeight}
                  width={barWidth}
                  height={Math.max(keluarHeight, point.keluar > 0 ? 3 : 0)}
                  rx="3"
                  fill="#f59e0b"
                />

                <text
                  x={cx}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] font-medium"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          {activePoint ? (
            <>
              <span className="font-medium text-slate-900">
                Periode {activePoint.label}
              </span>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-700">
                  Masuk: {rupiah(activePoint.masuk)}
                </span>
                <span className="text-amber-700">
                  Keluar: {rupiah(activePoint.keluar)}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-400">
              Arahkan kursor ke batang bulan untuk melihat rincian nominal.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
