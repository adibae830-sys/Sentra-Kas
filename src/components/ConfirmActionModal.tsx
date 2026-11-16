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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                isDanger
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-900/15 bg-emerald-50 text-[#065F46]'
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
                className="text-base font-semibold text-stone-900"
              >
                {state.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                {state.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="Tutup dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state.details && state.details.length > 0 && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <ul className="space-y-1.5 text-xs text-stone-700">
              {state.details.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
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
            className="whitespace-nowrap shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={state.onConfirm}
            disabled={isSubmitting}
            className={`whitespace-nowrap shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              isDanger
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-[#0B2821] hover:bg-[#12382E]'
            }`}
          >
            {isSubmitting ? 'Menyimpan...' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
