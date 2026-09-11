import React, { useState, useRef, useEffect } from 'react';
import { Service, ServiceStatus, Technician, Client } from '../types';
import { calculateCalibration, calculateServiceForecast, getCalibrationStatus, getClientConflicts, checkPeriodExceeded } from '../utils';
import { STATUS_STYLE } from '../constants';
import { Trash2, AlertCircle, Check, ChevronDown, MessageSquare, X } from 'lucide-react';
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

export const ServiceGrid: React.FC<ServiceGridProps> = ({ services, technicians, clients, onUpdate, onDelete, canEdit = true }) => {
    const [activeCommentService, setActiveCommentService] = useState<{ id: string; client: string; os: string; comments: string } | null>(null);

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
            const { nextCalText } = calculateCalibration(service.startDate, service.lastCalibration, service.period);
            const { forecastText, forecastStartDate } = calculateServiceForecast(service.startDate, service.endDate, service.period);
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

            const rowBgClass = isRangeInvalid
                ? 'bg-red-50/80 hover:bg-red-100'
                : 'hover:bg-abb-red/5';

            const clientConflicts = getClientConflicts(services, service.client, service.startDate, service.endDate, service.id);
            const hasClientOverlap = clientConflicts.length > 0;
            const calStatus = getCalibrationStatus(service);

            return (
                <tr key={service.id} className={`${rowBgClass} transition-colors group`}>

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
                    <td className="p-0 border-b border-slate-100 relative h-10 w-32 min-w-[125px]">
                        <input
                            type="date"
                            className={`grid-date-input w-full h-full bg-transparent text-center text-xs text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none transition-colors px-1 ${!isStartDateValid ? 'bg-red-50 text-red-600 font-bold' : ''} ${!canEdit ? 'cursor-default' : ''}`}
                            value={service.startDate}
                            onChange={(e) => onUpdate(service.id, 'startDate', e.target.value)}
                            readOnly={!canEdit}
                        />
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
                    <td className="p-0 h-10 border-b border-slate-100 text-center w-20 min-w-[70px]">
                        <PeriodCell
                            value={service.period ?? 0}
                            onChange={(val) => onUpdate(service.id, 'period', val)}
                            disabled={!canEdit}
                        />
                    </td>

                    <td className="px-2 py-1 border-b border-slate-100 text-center w-36 min-w-[145px]">
                        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            {calStatus.level === 'EXPIRED' && (
                                <span
                                    className="px-1.5 py-0.5 bg-red-600 text-white font-bold text-[9px] rounded shadow-sm shrink-0"
                                    title={`Calibração Vencida (${calStatus.targetDateText})`}
                                >
                                    VENC
                                </span>
                            )}
                            {calStatus.level === 'EXPIRING_SOON' && (
                                <span
                                    className="px-1.5 py-0.5 bg-amber-400 text-amber-950 font-bold text-[9px] rounded animate-pulse shadow-sm ring-1 ring-amber-300 shrink-0"
                                    title={`Atenção: Vence em ${calStatus.daysRemaining} dias (${calStatus.targetDateText})`}
                                >
                                    {calStatus.daysRemaining}d
                                </span>
                            )}
                            <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{nextCalText}</span>
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
                        <td className="px-2 w-10 text-center border-b border-slate-200">
                            <button
                                onClick={() => { if (window.confirm('Excluir linha?')) onDelete(service.id); }}
                                className="text-slate-300 hover:text-abb-red opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Excluir Linha"
                            >
                                <Trash2 size={14} />
                            </button>
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
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-12 min-w-[48px]">Sem.</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 min-w-[200px]">Cliente</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 w-24 min-w-[85px]">Manager</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 w-28 min-w-[100px]">OS</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 min-w-[160px]">Descrição</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-16 min-w-[60px]">HP</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-16 min-w-[60px]">HT</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-16 min-w-[60px]">HV</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-32 min-w-[125px]">Início</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-32 min-w-[125px]">Fim</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-28 min-w-[100px]">Exec.</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-32 min-w-[125px]">Últ. Cal.</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-20 min-w-[70px]">Período</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-36 min-w-[145px]">Próx. Calibração</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-36 min-w-[140px]">Status</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-44 min-w-[170px]">Previsão</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-40 min-w-[150px]">Comentários</th>
                            {canEdit && <th className="w-12 min-w-[48px] border-b border-slate-200"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {renderRows(services)}
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
        </div>
    );
};