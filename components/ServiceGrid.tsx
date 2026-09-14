import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Service, ServiceStatus, Technician, Client } from '../types';
import { calculateCalibration, calculateServiceForecast, getCalibrationStatus, getClientConflicts, checkPeriodExceeded } from '../utils';
import { STATUS_STYLE } from '../constants';
import { Trash2, AlertCircle, Check, ChevronDown, MessageSquare, X, ArrowUp, ArrowDown, ListFilter, Filter, Repeat, Pencil } from 'lucide-react';
import { isFuture } from 'date-fns/isFuture';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { getISOWeek } from 'date-fns/getISOWeek';

interface ServiceGridProps {
    services: Service[];
    technicians: Technician[];
    clients: Client[];
    onUpdate: (id: string, field: keyof Service, value: any) => void;
    onDelete: (id: string) => void;
    onBatchStatusUpdate?: (ids: string[], newStatus: ServiceStatus) => void;
    onBatchUpdate?: (ids: string[], updates: { status?: ServiceStatus; realized?: 'sim' | 'nao' }) => void;
    onBatchDelete?: (ids: string[]) => void;
    onGenerateRecurrence?: (serviceId: string) => void;
    onEdit?: (service: Service) => void;
    canEdit?: boolean;
}

// Internal component for handling multi-selection of technicians in a dropdown
const TechnicianMultiSelect = ({
    selectedIds,
    technicians,
    onChange,
    disabled = false
}: {
    selectedIds: string[],
    technicians: Technician[],
    onChange: (ids: string[]) => void,
    disabled?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const toggleTech = (techId: string) => {
        const newIds = selectedIds.includes(techId)
            ? selectedIds.filter(id => id !== techId)
            : [...selectedIds, techId];
        onChange(newIds);
    };

    const displayNames = selectedIds.length > 0
        ? selectedIds.map(id => technicians.find(t => t.id === id)?.name).filter(Boolean).join(', ')
        : '-';

    return (
        <div className="relative w-full h-full" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full h-full flex items-center justify-center transition-colors px-1 group/select ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100'}`}
            >
                <span className="font-bold text-abb-red text-xs truncate select-none flex-grow text-center">
                    {displayNames}
                </span>
                <ChevronDown size={10} className="text-slate-400 opacity-0 group-hover/select:opacity-100 absolute right-1" />
            </div>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">
                        Selecione os Técnicos
                    </div>
                    <div className="overflow-y-auto p-1">
                        {technicians.map(tech => {
                            const isSelected = selectedIds.includes(tech.id);
                            return (
                                <div
                                    key={tech.id}
                                    onClick={() => toggleTech(tech.id)}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${isSelected ? 'bg-abb-red/5 text-abb-red font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'bg-abb-red border-abb-red' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && <Check size={10} className="text-white" />}
                                    </div>
                                    <span>{tech.name}</span>
                                    <span className="text-[9px] text-slate-400 ml-auto font-normal">{tech.fullName.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Filtro e ordenacao por coluna ---

type SortDir = 'asc' | 'desc';

const NUMERIC_COLS = new Set(['week', 'hp', 'ht', 'hv', 'period']);

/**
 * Valor exibido/filtrado de cada coluna. Fonte unica compartilhada com sortValue:
 * se as duas divergissem, o popover listaria um valor e a ordenacao usaria outro.
 */
const cellValue = (s: Service, key: string, techs: Technician[]): string => {
    switch (key) {
        case 'week': {
            const d = s.startDate ? parseISO(s.startDate) : null;
            return String(d && isValid(d) ? getISOWeek(d) : (s.week || ''));
        }
        case 'client': return s.client || '';
        case 'manager': return s.manager || '';
        case 'os': return s.os || '';
        case 'description': return s.description || '';
        case 'hp': return String(s.hp ?? '');
        case 'ht': return String(s.ht ?? '');
        case 'hv': return String(s.hv ?? '');
        case 'startDate': return s.startDate || '';
        case 'endDate': return s.endDate || '';
        case 'technicianIds':
            return (s.technicianIds || [])
                .map(id => techs.find(t => t.id === id)?.name || '')
                .filter(Boolean)
                .join(', ');
        case 'realized':
            return s.realized === 'sim' ? 'Sim' : 'Não';
        case 'lastCalibration': return s.lastCalibration || '';
        case 'period': return String(s.period ?? 0);
        case 'nextCal': return calculateCalibration(s.startDate, s.lastCalibration, s.period, s.nextCalibration, s.realized).nextCalText;
        case 'status': return s.status;
        case 'forecast': {
            const nextCal = calculateCalibration(s.startDate, s.lastCalibration, s.period, s.nextCalibration, s.realized).nextCalText;
            return calculateServiceForecast(s.startDate, s.endDate, s.period, nextCal, s.realized).forecastText;
        }
        case 'comments': return (s.comments || '').trim();
        default: return '';
    }
};

/** Chave de ordenacao. Datas ISO ordenam bem como texto; dd/MM/yyyy nao, entao
 *  Prox. Calibracao e Previsao ordenam pela data computada, nao pelo texto. */
const sortValue = (s: Service, key: string, techs: Technician[]): string | number => {
    if (NUMERIC_COLS.has(key)) return Number(cellValue(s, key, techs)) || 0;
    if (key === 'nextCal') {
        const d = calculateCalibration(s.startDate, s.lastCalibration, s.period, s.nextCalibration, s.realized).forecastDate;
        return d ? d.getTime() : -Infinity;
    }
    if (key === 'forecast') {
        const nextCal = calculateCalibration(s.startDate, s.lastCalibration, s.period, s.nextCalibration, s.realized).nextCalText;
        const d = calculateServiceForecast(s.startDate, s.endDate, s.period, nextCal, s.realized).forecastStartDate;
        return d ? d.getTime() : -Infinity;
    }
    return cellValue(s, key, techs).toLowerCase();
};

const BLANK_LABEL = '(vazio)';

const ColumnFilter: React.FC<{
    label: string;
    options: string[];
    selected?: Set<string>;
    sortDir: SortDir | null;
    isOpen: boolean;
    onToggleOpen: () => void;
    onClose: () => void;
    onSort: () => void;
    onChange: (next?: Set<string>) => void;
    align?: 'left' | 'center';
    popoverAlign?: 'left' | 'right';
}> = ({ label, options, selected, sortDir, isOpen, onToggleOpen, onClose, onSort, onChange, align = 'left', popoverAlign = 'left' }) => {
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const isFiltered = selected !== undefined;
    const allChecked = !selected || selected.size === options.length;
    const shown = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    const toggleValue = (v: string) => {
        const base = selected ? new Set(selected) : new Set(options);
        if (base.has(v)) base.delete(v); else base.add(v);
        // Set completo === sem filtro: evita guardar filtro que nao filtra nada.
        onChange(base.size === options.length ? undefined : base);
    };

    return (
        <div className="relative" ref={ref}>
            <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                <button
                    type="button"
                    onClick={onSort}
                    className="font-semibold uppercase text-slate-500 hover:text-abb-red transition-colors truncate cursor-pointer select-none flex items-center gap-0.5"
                    title="Clique para ordenar (A-Z / Z-A)"
                >
                    <span>{label}</span>
                </button>
                {sortDir === 'asc' && <ArrowUp size={12} className="text-abb-red shrink-0" />}
                {sortDir === 'desc' && <ArrowDown size={12} className="text-abb-red shrink-0" />}
                <button
                    type="button"
                    onClick={onToggleOpen}
                    className={`p-1 rounded transition-all shrink-0 cursor-pointer ${
                        isFiltered 
                            ? 'text-abb-red bg-abb-red/15 border border-abb-red/30 shadow-xs' 
                            : 'text-slate-300 hover:text-slate-600 hover:bg-slate-200/60'
                    }`}
                    title={isFiltered ? `Filtro ativo (${selected?.size} selecionado(s))` : 'Filtrar coluna'}
                >
                    {isFiltered ? <Filter size={11} className="fill-abb-red/20" /> : <ListFilter size={11} />}
                </button>
            </div>

            {isOpen && (
                <div className={`absolute top-full ${popoverAlign === 'right' ? 'right-0' : 'left-0'} mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex flex-col normal-case text-left`}>
                    <div className="p-2 border-b border-slate-100">
                        <input
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full px-2 py-1 text-xs font-normal border border-slate-200 rounded focus:outline-none focus:border-abb-red/50"
                        />
                    </div>

                    <label className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-slate-700 border-b border-slate-100 cursor-pointer hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={() => onChange(allChecked ? new Set<string>() : undefined)}
                            className="w-3.5 h-3.5 accent-abb-red cursor-pointer"
                        />
                        (Selecionar tudo)
                    </label>

                    <div className="overflow-y-auto max-h-52 py-1">
                        {shown.map(opt => (
                            <label
                                key={opt}
                                className="flex items-center gap-2 px-2 py-1 text-xs font-normal text-slate-700 cursor-pointer hover:bg-slate-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={!selected || selected.has(opt)}
                                    onChange={() => toggleValue(opt)}
                                    className="w-3.5 h-3.5 accent-abb-red cursor-pointer shrink-0"
                                />
                                <span className="truncate" title={opt}>{opt}</span>
                            </label>
                        ))}
                        {shown.length === 0 && (
                            <div className="px-2 py-3 text-center text-[11px] font-normal text-slate-400">
                                Nenhum valor
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 p-2 border-t border-slate-100 bg-slate-50">
                        <button
                            type="button"
                            onClick={() => { onChange(undefined); setSearch(''); }}
                            className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                        >
                            Limpar
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 text-[11px] font-bold text-white bg-abb-red hover:brightness-110 rounded transition-all cursor-pointer"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const PERIOD_OPTIONS = [0, 6, 12, 18, 24, 30, 36];

const PeriodCell = ({
    value,
    onChange,
    disabled = false
}: {
    value: number,
    onChange: (val: number) => void,
    disabled?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempValue, setTempValue] = useState<string>(value !== undefined && value !== null ? String(value) : '0');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTempValue(value !== undefined && value !== null ? String(value) : '0');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleBlur = () => {
        const num = tempValue === '' ? 0 : Number(tempValue);
        if (num !== value) {
            onChange(num);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
            setIsOpen(false);
        }
    };

    const handleSelect = (opt: number) => {
        setTempValue(String(opt));
        onChange(opt);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center group/period" ref={containerRef}>
            <input
                type="number"
                disabled={disabled}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`w-full h-full bg-transparent text-center text-slate-700 font-semibold focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none pl-1 pr-4 text-xs transition-colors ${disabled ? 'cursor-default' : ''}`}
            />
            {!disabled && (
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title="Selecionar período (0, 6, 12, 18, 24, 30, 36)"
                >
                    <ChevronDown size={12} />
                </button>
            )}

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-24 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase text-center">
                        Período
                    </div>
                    {PERIOD_OPTIONS.map((opt) => {
                        const isSelected = Number(tempValue) === opt;
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleSelect(opt)}
                                className={`w-full text-center px-2 py-1.5 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected
                                        ? 'bg-abb-red text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span className="flex-1 text-center">{opt}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const ServiceGrid: React.FC<ServiceGridProps> = ({
    services,
    technicians,
    clients,
    onUpdate,
    onDelete,
    onBatchStatusUpdate,
    onBatchUpdate,
    onBatchDelete,
    onGenerateRecurrence,
    onEdit,
    canEdit = true
}) => {
    const [activeCommentService, setActiveCommentService] = useState<{ id: string; client: string; os: string; comments: string } | null>(null);

    // --- Selecao em massa ---
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<ServiceStatus | 'KEEP'>('KEEP');
    const [bulkRealized, setBulkRealized] = useState<'KEEP' | 'sim' | 'nao'>('KEEP');
    const headerCheckboxRef = useRef<HTMLInputElement>(null);

    // --- Filtro e ordenacao por coluna ---
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir | null>(null);
    const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
    const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);

    // Ciclo do clique no cabecalho: asc -> desc -> sem ordenacao (volta ao padrao do App).
    const cycleSort = (key: string) => {
        if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
        if (sortDir === 'asc') { setSortDir('desc'); return; }
        setSortKey(null);
        setSortDir(null);
    };

    const setColumnFilter = (key: string, next?: Set<string>) => {
        setColFilters(prev => {
            const copy = { ...prev };
            if (next === undefined) delete copy[key]; else copy[key] = next;
            return copy;
        });
    };

    const optionsFor = (key: string): string[] =>
        Array.from(new Set(services.map(s => cellValue(s, key, technicians) || BLANK_LABEL))).sort((a, b) =>
            a.localeCompare(b, 'pt-BR', { numeric: true })
        );

    const displayedServices = useMemo(() => {
        const activeKeys = Object.keys(colFilters);
        const filtered = activeKeys.length === 0
            ? services
            : services.filter(s =>
                activeKeys.every(k => colFilters[k].has(cellValue(s, k, technicians) || BLANK_LABEL))
            );

        if (!sortKey || !sortDir) return filtered;

        const dir = sortDir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const va = sortValue(a, sortKey, technicians);
            const vb = sortValue(b, sortKey, technicians);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    }, [services, technicians, colFilters, sortKey, sortDir]);

    // A selecao efetiva e derivada da lista JA filtrada por coluna: sem isso, o checkbox
    // do cabecalho marcaria linhas escondidas e a acao em massa mudaria o status de
    // atividades que o usuario nem esta vendo.
    const selectedVisibleIds = displayedServices.filter(s => selectedIds.has(s.id)).map(s => s.id);
    const allVisibleSelected = displayedServices.length > 0 && selectedVisibleIds.length === displayedServices.length;
    const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected;

    // indeterminate so existe via DOM, nao ha atributo JSX equivalente.
    useEffect(() => {
        if (headerCheckboxRef.current) {
            headerCheckboxRef.current.indeterminate = someVisibleSelected;
        }
    }, [someVisibleSelected]);

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleAllVisible = () => {
        setSelectedIds(allVisibleSelected ? new Set() : new Set(displayedServices.map(s => s.id)));
    };

    const applyBulkUpdate = () => {
        if (selectedVisibleIds.length === 0) return;
        if (bulkStatus === 'KEEP' && bulkRealized === 'KEEP') return;

        const updates: { status?: ServiceStatus; realized?: 'sim' | 'nao' } = {};
        if (bulkStatus !== 'KEEP') updates.status = bulkStatus;
        if (bulkRealized !== 'KEEP') updates.realized = bulkRealized;

        if (onBatchUpdate) {
            onBatchUpdate(selectedVisibleIds, updates);
        } else if (onBatchStatusUpdate && updates.status) {
            onBatchStatusUpdate(selectedVisibleIds, updates.status);
            if (updates.realized) {
                selectedVisibleIds.forEach(id => onUpdate(id, 'realized', updates.realized));
            }
        } else {
            selectedVisibleIds.forEach(id => {
                if (updates.status) onUpdate(id, 'status', updates.status);
                if (updates.realized) onUpdate(id, 'realized', updates.realized);
            });
        }
        setSelectedIds(new Set());
        setBulkStatus('KEEP');
        setBulkRealized('KEEP');
    };

    const handleBulkDelete = () => {
        if (selectedVisibleIds.length === 0) return;
        if (onBatchDelete) {
            onBatchDelete(selectedVisibleIds);
            setSelectedIds(new Set());
        } else {
            const confirmDelete = window.confirm(`Tem certeza que deseja excluir ${selectedVisibleIds.length} atividade(s) selecionada(s)?`);
            if (confirmDelete) {
                selectedVisibleIds.forEach(id => onDelete(id));
                setSelectedIds(new Set());
            }
        }
    };

    // Reusable Input Cell Component for Text/Numbers
    const EditableCell = ({
        value,
        type = 'text',
        onChange,
        align = 'left',
        className = '',
        list
    }: {
        value: any,
        type?: string,
        onChange: (val: any) => void,
        align?: 'left' | 'center' | 'right',
        className?: string,
        list?: string
    }) => {
        const [tempValue, setTempValue] = React.useState(value);

        // Sync with prop if it changes externally
        React.useEffect(() => setTempValue(value), [value]);

        const handleBlur = () => {
            if (tempValue != value) { // Loose equality for number/string diffs
                onChange(tempValue);
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.currentTarget.blur();
            }
        };

        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

        return (
            <input
                type={type}
                className={`w-full h-full bg-transparent border border-transparent rounded-md px-1.5 focus:bg-white focus:border-abb-red/50 focus:ring-1 focus:ring-abb-red/50 outline-none transition-all ${alignClass} ${className} ${!canEdit ? 'cursor-default' : ''}`}
                value={tempValue}
                onChange={(e) => setTempValue(type === 'number' ? (e.target.value === '' ? '' : e.target.valueAsNumber || 0) : e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                list={list}
                readOnly={!canEdit}
            />
        );
    };

    const getStatusColor = (status: ServiceStatus) => {
        const style = STATUS_STYLE[status];
        return style ? `${style.bg} ${style.text}` : 'bg-slate-200 text-slate-600';
    };

    const renderRows = (list: Service[]) => {
        return list.map((service) => {
            const { nextCalText, isoDate } = calculateCalibration(service.startDate, service.lastCalibration, service.period, service.nextCalibration, service.realized);
            const { forecastText, forecastStartDate } = calculateServiceForecast(service.startDate, service.endDate, service.period, nextCalText, service.realized);
            const statusClass = getStatusColor(service.status);
            const isFutureForecast = forecastStartDate ? isFuture(forecastStartDate) : false;
            const forecastColor = isFutureForecast ? 'text-abb-red font-bold' : 'text-slate-600';

            // Validation for Dates
            const startObj = parseISO(service.startDate);
            const endObj = parseISO(service.endDate);
            const isStartDateValid = service.startDate && isValid(startObj);
            const isEndDateValid = service.endDate && isValid(endObj);

            // Logical Validation: End date before start date
            const isRangeInvalid = isStartDateValid && isEndDateValid && endObj < startObj;

            const isSelected = selectedIds.has(service.id);
            // Erro de data vence o destaque de selecao: e um estado que precisa continuar visivel.
            const rowBgClass = isRangeInvalid
                ? 'bg-red-50/80 hover:bg-red-100'
                : isSelected
                    ? 'bg-abb-red/10 hover:bg-abb-red/15'
                    : 'hover:bg-abb-red/5';

            const clientConflicts = getClientConflicts(services, service.client, service.startDate, service.endDate, service.id);
            const hasClientOverlap = clientConflicts.length > 0;
            const calStatus = getCalibrationStatus(service);
            // Badge de vencimento só aparece quando há uma próxima calibração de fato prevista
            const showCalBadge = calStatus.isForecast && !!(service.nextCalibration || (service.period && service.period > 0 && isoDate));

            return (
                <tr key={service.id} className={`${rowBgClass} transition-colors group`}>

                    {canEdit && (
                        <td className="p-0 h-10 border-b border-slate-100 text-center w-10 min-w-[40px]">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(service.id)}
                                className="w-3.5 h-3.5 accent-abb-red cursor-pointer align-middle"
                                title="Selecionar atividade"
                            />
                        </td>
                    )}

                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <span className="font-medium text-slate-500 text-xs">
                            {service.startDate && isValid(parseISO(service.startDate)) ? getISOWeek(parseISO(service.startDate)) : service.week || '-'}
                        </span>
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 relative">
                        <div className="flex items-center h-full">
                            {hasClientOverlap && (
                                <span className="pl-1 text-amber-500 font-bold" title={`Sobreposição: ${clientConflicts.length} outra(s) visita(s) para ${service.client} neste mesmo intervalo de datas!`}>
                                    ⚠️
                                </span>
                            )}
                            <EditableCell
                                value={service.client}
                                list="client-options"
                                onChange={(v) => onUpdate(service.id, 'client', v)}
                                className="font-semibold text-slate-800"
                            />
                        </div>
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100">
                        <EditableCell
                            value={service.manager}
                            onChange={(v) => onUpdate(service.id, 'manager', v)}
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 w-28 min-w-[100px]">
                        <EditableCell
                            value={service.os}
                            onChange={(v) => onUpdate(service.id, 'os', v)}
                            className="font-mono text-slate-600 font-medium"
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 min-w-[160px]">
                        <EditableCell
                            value={service.description}
                            onChange={(v) => onUpdate(service.id, 'description', v)}
                            className="text-slate-600"
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center w-16 min-w-[60px]">
                        <EditableCell
                            type="number"
                            value={service.hp}
                            onChange={(v) => onUpdate(service.id, 'hp', v)}
                            align="center"
                            className="text-slate-600 font-medium"
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center w-16 min-w-[60px]">
                        <EditableCell
                            type="number"
                            value={service.ht}
                            onChange={(v) => onUpdate(service.id, 'ht', v)}
                            align="center"
                            className="text-slate-600 font-medium"
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center w-16 min-w-[60px]">
                        <EditableCell
                            type="number"
                            value={service.hv}
                            onChange={(v) => onUpdate(service.id, 'hv', v)}
                            align="center"
                            className="text-slate-600 font-medium"
                        />
                    </td>

                    {/* Start Date Column */}
                    <td className="p-0 border-b border-slate-100 relative h-10 w-36 min-w-[135px]">
                        <div className="flex items-center justify-center gap-1 h-full px-1">
                            {service.realized !== 'sim' && calStatus.level === 'EXPIRED' && (
                                <span
                                    className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-[9px] rounded shadow-sm shrink-0"
                                    title={`Visita Vencida (${calStatus.targetDateText})`}
                                >
                                    VENC
                                </span>
                            )}
                            {service.realized !== 'sim' && calStatus.level === 'EXPIRING_SOON' && (
                                <span
                                    className="px-1.5 py-0.5 bg-amber-400 text-amber-950 font-bold text-[9px] rounded animate-pulse shadow-sm ring-1 ring-amber-300 shrink-0"
                                    title={`Atenção: Vence em ${calStatus.daysRemaining} dias (${calStatus.targetDateText})`}
                                >
                                    {calStatus.daysRemaining}d
                                </span>
                            )}
                            <input
                                type="date"
                                className={`grid-date-input flex-1 h-full bg-transparent text-center text-xs text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none transition-colors px-1 ${!isStartDateValid ? 'bg-red-50 text-red-600 font-bold' : ''} ${!canEdit ? 'cursor-default' : ''}`}
                                value={service.startDate}
                                onChange={(e) => onUpdate(service.id, 'startDate', e.target.value)}
                                readOnly={!canEdit}
                            />
                        </div>
                        {!isStartDateValid && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" title="Data Inválida">
                                <AlertCircle size={12} />
                            </div>
                        )}
                    </td>

                    {/* End Date Column */}
                    <td className="p-0 border-b border-slate-100 relative h-10 w-32 min-w-[125px]">
                        <input
                            type="date"
                            className={`grid-date-input w-full h-full bg-transparent text-center text-xs text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none transition-colors px-1 ${!isEndDateValid || isRangeInvalid ? 'bg-red-50 text-red-600 font-bold' : ''} ${!canEdit ? 'cursor-default' : ''}`}
                            value={service.endDate}
                            onChange={(e) => onUpdate(service.id, 'endDate', e.target.value)}
                            readOnly={!canEdit}
                        />
                        {(!isEndDateValid || isRangeInvalid) && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" title={isRangeInvalid ? "Data final menor que inicial" : "Data Inválida"}>
                                <AlertCircle size={12} />
                            </div>
                        )}
                    </td>

                    {/* Technician Multi-Select Column */}
                    <td className="p-0 h-10 border-b border-slate-100 text-center relative z-20 w-28 min-w-[100px]">
                        <TechnicianMultiSelect
                            selectedIds={service.technicianIds || []}
                            technicians={technicians}
                            onChange={(newIds) => onUpdate(service.id, 'technicianIds', newIds)}
                            disabled={!canEdit}
                        />
                    </td>

                    {/* Realizado Column */}
                    <td className="p-1 border-b border-slate-100 text-center w-24 min-w-[90px]">
                        <select
                            disabled={!canEdit}
                            value={service.realized === 'sim' ? 'sim' : 'nao'}
                            onChange={(e) => {
                                const val = e.target.value as 'sim' | 'nao';
                                if (val === 'sim' && !service.endDate) {
                                    e.target.value = 'nao';
                                }
                                onUpdate(service.id, 'realized', val);
                            }}
                            className={`w-full text-xs font-bold py-1 px-1.5 rounded-md border text-center transition-all outline-none cursor-pointer ${
                                service.realized === 'sim'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 focus:ring-1 focus:ring-emerald-400'
                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 focus:ring-1 focus:ring-slate-400'
                            } ${!canEdit ? 'cursor-default opacity-80' : ''}`}
                            title="Indica se a atividade foi realizada (Sim / Não)"
                        >
                            <option value="sim" className="bg-white text-emerald-700 font-bold">Sim</option>
                            <option value="nao" className="bg-white text-slate-700 font-medium">Não</option>
                        </select>
                    </td>

                    <td className="p-0 border-b border-slate-100 relative h-10 w-32 min-w-[125px]">
                        <input
                            type="date"
                            className={`grid-date-input w-full h-full bg-transparent text-center text-xs text-slate-500 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none px-1 ${!canEdit ? 'cursor-default' : ''}`}
                            value={service.lastCalibration || ''}
                            onChange={(e) => onUpdate(service.id, 'lastCalibration', e.target.value)}
                            readOnly={!canEdit}
                        />
                    </td>

                    {/* Period Column */}
                    <td className="p-0 h-10 border-b border-slate-100 text-center w-28 min-w-[110px]">
                        <div className="flex items-center h-full w-full px-1 gap-1">
                            <div className="flex-1 h-full min-w-0">
                                <PeriodCell
                                    value={service.period ?? 0}
                                    onChange={(val) => onUpdate(service.id, 'period', val)}
                                    disabled={!canEdit}
                                />
                            </div>
                            {canEdit && onGenerateRecurrence && (
                                <button
                                    type="button"
                                    onClick={() => onGenerateRecurrence(service.id)}
                                    title="⚡ Configurar e gerar recorrência de calibração"
                                    className="flex items-center justify-center p-1.5 rounded transition-all shrink-0 cursor-pointer bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 shadow-2xs active:scale-95"
                                >
                                    <Repeat size={13} className="text-amber-700" />
                                </button>
                            )}
                        </div>
                    </td>

                    <td className="p-0 border-b border-slate-100 relative h-10 w-36 min-w-[145px]">
                        <div className="flex items-center justify-center gap-1 h-full px-1">
                            {showCalBadge && calStatus.level === 'EXPIRED' && (
                                <span
                                    className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-[9px] rounded shadow-sm shrink-0"
                                    title={`Calibração Vencida (${calStatus.targetDateText})`}
                                >
                                    VENC
                                </span>
                            )}
                            {showCalBadge && calStatus.level === 'EXPIRING_SOON' && (
                                <span
                                    className="px-1.5 py-0.5 bg-amber-400 text-amber-950 font-bold text-[9px] rounded animate-pulse shadow-sm ring-1 ring-amber-300 shrink-0"
                                    title={`Atenção: Vence em ${calStatus.daysRemaining} dias (${calStatus.targetDateText})`}
                                >
                                    {calStatus.daysRemaining}d
                                </span>
                            )}
                            <input
                                type="date"
                                className={`grid-date-input flex-1 h-full bg-transparent text-center text-xs font-medium text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none px-1 ${!canEdit ? 'cursor-default' : ''}`}
                                value={service.nextCalibration || isoDate || ''}
                                onChange={(e) => onUpdate(service.id, 'nextCalibration', e.target.value)}
                                readOnly={!canEdit}
                                title={nextCalText}
                            />
                        </div>
                    </td>

                    <td className="px-2 py-1 border-b border-slate-100 text-center">
                        <select
                            value={service.status}
                            onChange={(e) => onUpdate(service.id, 'status', e.target.value)}
                            className={`w-full py-1.5 px-1 rounded-md text-[10px] font-bold uppercase text-center cursor-pointer focus:outline-none border-none ${statusClass} ${!canEdit ? 'pointer-events-none' : ''}`}
                            disabled={!canEdit}
                        >
                            {Object.values(ServiceStatus).map(s => (
                                <option key={s} value={s} className="bg-white text-black font-medium normal-case">{s}</option>
                            ))}
                        </select>
                    </td>

                    <td className="px-2 py-1 border-b border-slate-100 text-center overflow-hidden">
                        <span className={`text-xs truncate ${forecastColor}`}>{forecastText}</span>
                    </td>

                    {/* Comments Column */}
                    <td className="px-2 py-1 border-b border-slate-100 text-left w-40 min-w-[150px]">
                        <button
                            type="button"
                            onClick={() => setActiveCommentService({
                                id: service.id,
                                client: service.client,
                                os: service.os,
                                comments: service.comments || ''
                            })}
                            className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all text-left group/btn ${
                                service.comments && service.comments.trim()
                                    ? 'bg-amber-50 hover:bg-amber-100/90 text-slate-800 border border-amber-200 shadow-2xs'
                                    : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600 border border-transparent'
                            }`}
                            title={service.comments ? service.comments : 'Adicionar anotação'}
                        >
                            <MessageSquare
                                size={13}
                                className={`shrink-0 ${
                                    service.comments && service.comments.trim()
                                        ? 'text-amber-600 fill-amber-500/20'
                                        : 'text-slate-400 group-hover/btn:text-slate-600'
                                }`}
                            />
                            <span className="truncate flex-1">
                                {service.comments && service.comments.trim() ? service.comments : '+ Obs'}
                            </span>
                        </button>
                    </td>

                    {canEdit && (
                        <td className="px-1.5 w-16 text-center border-b border-slate-200">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEdit && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(service);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                                        title="Editar Atividade Completa"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Excluir linha?')) onDelete(service.id);
                                    }}
                                    className="p-1 text-slate-400 hover:text-abb-red hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Excluir Linha"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </td>
                    )}
                </tr>
            );
        });
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            <datalist id="client-options">
                {clients.map(c => <option key={c.id} value={c.name} />)}
            </datalist>

            <div className="overflow-auto flex-grow pb-32"> {/* Added padding bottom for dropdown space */}
                <table className="w-full min-w-[1800px] text-xs whitespace-nowrap border-collapse">
                    <thead className="sticky top-0 z-30">
                        <tr className="bg-slate-50 shadow-sm">
                            {canEdit && (
                                <th className="px-2 py-3 text-center border-b border-slate-200 w-10 min-w-[40px]">
                                    <input
                                        ref={headerCheckboxRef}
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleAllVisible}
                                        disabled={displayedServices.length === 0}
                                        className="w-3.5 h-3.5 accent-abb-red cursor-pointer align-middle disabled:cursor-not-allowed disabled:opacity-40"
                                        title="Selecionar todas as atividades visíveis"
                                    />
                                </th>
                            )}
                            {([
                                { key: 'week', label: 'Sem.', cls: 'w-12 min-w-[48px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'client', label: 'Cliente', cls: 'min-w-[200px]', align: 'left' as const, popoverAlign: 'left' as const },
                                { key: 'manager', label: 'Manager', cls: 'w-24 min-w-[85px]', align: 'left' as const, popoverAlign: 'left' as const },
                                { key: 'os', label: 'OS', cls: 'w-28 min-w-[100px]', align: 'left' as const, popoverAlign: 'left' as const },
                                { key: 'description', label: 'Descrição', cls: 'min-w-[160px]', align: 'left' as const, popoverAlign: 'left' as const },
                                { key: 'hp', label: 'HP', cls: 'w-16 min-w-[60px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'ht', label: 'HT', cls: 'w-16 min-w-[60px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'hv', label: 'HV', cls: 'w-16 min-w-[60px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'startDate', label: 'Início', cls: 'w-32 min-w-[125px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'endDate', label: 'Fim', cls: 'w-32 min-w-[125px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'technicianIds', label: 'Exec.', cls: 'w-28 min-w-[100px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'realized', label: 'Realizado', cls: 'w-24 min-w-[90px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'lastCalibration', label: 'Últ. Cal.', cls: 'w-32 min-w-[125px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'period', label: 'Período', cls: 'w-28 min-w-[110px]', align: 'center' as const, popoverAlign: 'left' as const },
                                { key: 'nextCal', label: 'Próx. Calibração', cls: 'w-36 min-w-[145px]', align: 'center' as const, popoverAlign: 'right' as const },
                                { key: 'status', label: 'Status', cls: 'w-36 min-w-[140px]', align: 'center' as const, popoverAlign: 'right' as const },
                                { key: 'forecast', label: 'Previsão', cls: 'w-44 min-w-[170px]', align: 'center' as const, popoverAlign: 'right' as const },
                                { key: 'comments', label: 'Comentários', cls: 'w-40 min-w-[150px]', align: 'left' as const, popoverAlign: 'right' as const },
                            ]).map(col => (
                                <th key={col.key} className={`px-2 py-3 text-xs border-b border-slate-200 ${col.cls}`}>
                                    <ColumnFilter
                                        label={col.label}
                                        align={col.align}
                                        popoverAlign={col.popoverAlign}
                                        options={optionsFor(col.key)}
                                        selected={colFilters[col.key]}
                                        sortDir={sortKey === col.key ? sortDir : null}
                                        isOpen={openFilterKey === col.key}
                                        onToggleOpen={() => setOpenFilterKey(openFilterKey === col.key ? null : col.key)}
                                        onClose={() => setOpenFilterKey(null)}
                                        onSort={() => cycleSort(col.key)}
                                        onChange={(next) => setColumnFilter(col.key, next)}
                                    />
                                </th>
                            ))}
                            {canEdit && <th className="w-12 min-w-[48px] border-b border-slate-200"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {renderRows(displayedServices)}
                    </tbody>
                </table>
            </div>

            {/* Comments Modal */}
            {activeCommentService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                                    <MessageSquare size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Comentários da Atividade</h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {activeCommentService.client} {activeCommentService.os ? `• OS ${activeCommentService.os}` : ''}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveCommentService(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                title="Fechar"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 space-y-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Observações e Notas Técnicas
                            </label>
                            <textarea
                                rows={6}
                                value={activeCommentService.comments}
                                onChange={(e) => setActiveCommentService({ ...activeCommentService, comments: e.target.value })}
                                readOnly={!canEdit}
                                placeholder="Digite anotações, detalhes da calibração, contato do cliente, orientações para os técnicos..."
                                className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none resize-y transition-all placeholder:text-slate-400 leading-relaxed"
                            />
                            <p className="text-[11px] text-slate-400 text-right">
                                {activeCommentService.comments.length} caractere(s)
                            </p>
                        </div>
                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setActiveCommentService(null)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                            {canEdit && (
                                <button
                                    onClick={() => {
                                        onUpdate(activeCommentService.id, 'comments', activeCommentService.comments);
                                        setActiveCommentService(null);
                                    }}
                                    className="px-4 py-2 text-xs font-semibold bg-abb-red hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                                >
                                    Salvar Anotação
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Barra Flutuante de Ações em Massa no Rodapé */}
            {canEdit && selectedVisibleIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center flex-wrap gap-3 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-5 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-abb-red text-white font-bold text-xs rounded-full shadow-sm">
                            {selectedVisibleIds.length}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                            {selectedVisibleIds.length === 1 ? 'atividade selecionada' : 'atividades selecionadas'}
                        </span>
                        <span className="text-[11px] text-slate-400 hidden sm:inline whitespace-nowrap">
                            (de {displayedServices.length} visíveis)
                        </span>
                    </div>

                    <div className="h-5 w-px bg-slate-700 mx-0.5" />

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-300 whitespace-nowrap">
                            Status:
                        </label>
                        <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value as ServiceStatus | 'KEEP')}
                            className="bg-slate-800 border border-slate-600 text-white rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-abb-red focus:ring-1 focus:ring-abb-red transition-all cursor-pointer font-medium"
                        >
                            <option value="KEEP" className="bg-slate-800 text-slate-400 italic">
                                (Não alterar)
                            </option>
                            {Object.values(ServiceStatus).map(s => (
                                <option key={s} value={s} className="bg-slate-800 text-white font-medium not-italic">
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-300 whitespace-nowrap">
                            Realizado:
                        </label>
                        <select
                            value={bulkRealized}
                            onChange={(e) => setBulkRealized(e.target.value as 'KEEP' | 'sim' | 'nao')}
                            className="bg-slate-800 border border-slate-600 text-white rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-abb-red focus:ring-1 focus:ring-abb-red transition-all cursor-pointer font-medium"
                        >
                            <option value="KEEP" className="bg-slate-800 text-slate-400 italic">
                                (Não alterar)
                            </option>
                            <option value="sim" className="bg-slate-800 text-white font-medium not-italic">
                                Sim
                            </option>
                            <option value="nao" className="bg-slate-800 text-white font-medium not-italic">
                                Não
                            </option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={applyBulkUpdate}
                        disabled={bulkStatus === 'KEEP' && bulkRealized === 'KEEP'}
                        className={`px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 active:scale-95 ${
                            bulkStatus === 'KEEP' && bulkRealized === 'KEEP'
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-abb-red hover:bg-red-700 cursor-pointer'
                        }`}
                        title={
                            bulkStatus === 'KEEP' && bulkRealized === 'KEEP'
                                ? 'Selecione uma alteração para Status ou Realizado'
                                : 'Aplicar alterações às atividades selecionadas'
                        }
                    >
                        <Check size={14} /> Aplicar
                    </button>

                    <div className="h-5 w-px bg-slate-700 mx-0.5" />

                    <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white hover:bg-red-600/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Excluir todas as atividades selecionadas"
                    >
                        <Trash2 size={13} /> Excluir
                    </button>

                    <div className="h-5 w-px bg-slate-700 mx-0.5" />

                    <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Desmarcar todas as seleções"
                    >
                        <X size={14} /> Limpar
                    </button>
                </div>
            )}
        </div>
    );
};