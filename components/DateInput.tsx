import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { isoToBrDate, brDateToIso, formatDateMask } from '../utils';

export interface DateInputProps {
  value?: string | null; // ISO Date YYYY-MM-DD or empty
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string; // Container custom classes
  inputClassName?: string; // Input element custom classes
  align?: 'left' | 'center' | 'right';
  showCalendarButton?: boolean;
  calendarButtonTitle?: string;
  title?: string;
  isInvalid?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  'aria-label'?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
  placeholder = 'DD/MM/AAAA',
  className = '',
  inputClassName = '',
  align = 'center',
  showCalendarButton = true,
  calendarButtonTitle = 'Abrir seletor de calendário',
  title,
  isInvalid = false,
  onBlur,
  onKeyDown,
  id,
  'aria-label': ariaLabel,
}) => {
  const [displayText, setDisplayText] = useState<string>(() => isoToBrDate(value));
  const [localError, setLocalError] = useState<boolean>(false);
  const hiddenPickerRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const revertTimeoutRef = useRef<any>(null);

  // Sincroniza o texto visual sempre que o valor externo mudar
  useEffect(() => {
    setDisplayText(isoToBrDate(value));
    setLocalError(false);
  }, [value]);

  useEffect(() => {
    return () => {
      if (revertTimeoutRef.current) clearTimeout(revertTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    const raw = e.target.value;
    const masked = formatDateMask(raw);
    setDisplayText(masked);

    // Se o usuário apagou tudo
    if (masked === '') {
      setLocalError(false);
      onChange('');
      return;
    }

    // Se preencheu os 10 caracteres (DD/MM/AAAA)
    if (masked.length === 10) {
      const iso = brDateToIso(masked);
      if (iso) {
        setLocalError(false);
        onChange(iso);
      } else {
        setLocalError(true);
      }
    } else {
      setLocalError(false);
    }
  };

  const handleInputBlur = () => {
    if (disabled || readOnly) return;

    if (displayText === '') {
      setLocalError(false);
      if (value !== '') {
        onChange('');
      }
      onBlur?.();
      return;
    }

    if (displayText.length === 10) {
      const iso = brDateToIso(displayText);
      if (iso) {
        setLocalError(false);
        if (iso !== value) {
          onChange(iso);
        }
        onBlur?.();
        return;
      }
    }

    // Se a data ficou incompleta ou com dia/mês inválido:
    // Destaca em vermelho e reverte para a última data válida
    setLocalError(true);
    revertTimeoutRef.current = setTimeout(() => {
      setDisplayText(isoToBrDate(value));
      setLocalError(false);
    }, 450);

    onBlur?.();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    onKeyDown?.(e);
  };

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;

    if (hiddenPickerRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          hiddenPickerRef.current.showPicker();
        } else {
          hiddenPickerRef.current.focus();
          hiddenPickerRef.current.click();
        }
      } catch {
        hiddenPickerRef.current.focus();
        hiddenPickerRef.current.click();
      }
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (newIso) {
      setDisplayText(isoToBrDate(newIso));
      setLocalError(false);
      onChange(newIso);
    }
  };

  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const hasError = localError || isInvalid;

  return (
    <div
      className={`relative flex items-center w-full h-full group/date-input ${className}`}
      title={title}
    >
      <input
        ref={textInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        value={displayText}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        aria-label={ariaLabel || 'Data no formato DD/MM/AAAA'}
        maxLength={10}
        className={`w-full h-full bg-transparent outline-none transition-colors px-1 text-xs select-text ${alignClass} ${
          hasError
            ? 'bg-red-50 text-red-600 font-bold ring-1 ring-red-400'
            : 'text-slate-700 focus:bg-white focus:ring-1 focus:ring-abb-red/50'
        } ${disabled || readOnly ? 'cursor-default opacity-90' : 'cursor-pointer'} ${showCalendarButton && !disabled && !readOnly ? 'pr-6' : ''} ${inputClassName}`}
      />

      {/* Botão de calendário (ícone) */}
      {showCalendarButton && !disabled && !readOnly && (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpenPicker}
          title={calendarButtonTitle}
          aria-label={calendarButtonTitle}
          className="absolute right-1 text-slate-400 hover:text-abb-red p-0.5 rounded transition-colors opacity-70 group-hover/date-input:opacity-100 hover:opacity-100 cursor-pointer"
        >
          <Calendar size={12} />
        </button>
      )}

      {/* Input de date picker nativo oculto para invocar o popup de calendário de forma universal */}
      <input
        ref={hiddenPickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || readOnly}
        value={value && value.length === 10 ? value : ''}
        onChange={handlePickerChange}
        className="sr-only pointer-events-none"
      />
    </div>
  );
};
