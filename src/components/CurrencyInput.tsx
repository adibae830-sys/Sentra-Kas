import React, { useLayoutEffect, useRef } from 'react';

interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  value: string | number;
  onValueChange: (rawDigits: string, numericValue: number) => void;
  showPrefix?: boolean;
}

export function formatRibuanId(raw: string | number): string {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return '';
    return Math.round(raw)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onValueChange,
  showPrefix = true,
  className = '',
  placeholder = '0',
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextCaretDigitsRef = useRef<number | null>(null);

  const displayValue = formatRibuanId(value);

  useLayoutEffect(() => {
    const targetDigitsBeforeCaret = nextCaretDigitsRef.current;
    if (targetDigitsBeforeCaret === null) return;
    nextCaretDigitsRef.current = null;

    const el = inputRef.current;
    if (!el || document.activeElement !== el) return;

    const formatted = el.value;
    let digitsSeen = 0;
    let newPos = formatted.length;

    if (targetDigitsBeforeCaret === 0) {
      newPos = 0;
    } else {
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          digitsSeen += 1;
          if (digitsSeen >= targetDigitsBeforeCaret) {
            newPos = i + 1;
            break;
          }
        }
      }
    }

    try {
      el.setSelectionRange(newPos, newPos);
    } catch {
      // Ignore selection range errors on unsupported inputs
    }
  }, [displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const caret = e.target.selectionStart ?? rawInput.length;
    const digitsBeforeCaret = rawInput.slice(0, caret).replace(/\D/g, '').length;
    nextCaretDigitsRef.current = digitsBeforeCaret;

    const digitsOnly = rawInput.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const numeric = digitsOnly ? Number(digitsOnly) : 0;
    onValueChange(digitsOnly, numeric);
  };

  if (!showPrefix) {
    return (
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 select-none font-mono text-xs font-semibold text-slate-400">
        Rp
      </span>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className} pl-9`}
      />
    </div>
  );
};
