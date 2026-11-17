import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { ConfirmationState } from '../types/finance';

interface ConfirmActionModalProps {
  state: ConfirmationState;
  isSubmitting: boolean;
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  state,
  isSubmitting,
  onClose,
}) => {
  if (!state.isOpen) return null;

  const isDanger = state.variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isDanger
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-blue-200 bg-[#EBF3FC] text-[#004A8F]'
              }`}
            >
              {isDanger ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="confirm-modal-title"
                className="text-base font-bold text-slate-900"
              >
                {state.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {state.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.details && state.details.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
            <ul className="space-y-1.5 text-xs text-slate-700">
              {state.details.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00529C]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial whitespace-nowrap shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={state.onConfirm}
            disabled={isSubmitting}
            className={`flex-1 sm:flex-initial whitespace-nowrap shrink-0 rounded-xl px-4 py-2.5 sm:py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#004A8F] hover:bg-[#003870]'
            }`}
          >
            {isSubmitting ? 'Memproses...' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
