import React, { useState, useRef, useEffect } from 'react';
import { Service, ServiceStatus, Technician, Client } from '../types';
import { calculateCalibration } from '../utils';
import { Trash2, AlertCircle, Check, ChevronDown } from 'lucide-react';
import { isFuture } from 'date-fns/isFuture';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';

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

export const ServiceGrid: React.FC<ServiceGridProps> = ({ services, technicians, clients, onUpdate, onDelete, canEdit = true }) => {

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

        return (
            <input
                type={type}
                className={`w-full h-full bg-transparent border border-transparent rounded-md px-2 focus:bg-white focus:border-abb-red/50 focus:ring-1 focus:ring-abb-red/50 outline-none transition-all text-${align} ${className} ${!canEdit ? 'cursor-default' : ''}`}
                value={tempValue}
                onChange={(e) => setTempValue(type === 'number' ? e.target.valueAsNumber || 0 : e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                list={list}
                readOnly={!canEdit}
            />
        );
    };

    const getStatusColor = (status: ServiceStatus) => {
        switch (status) {
            case ServiceStatus.TRAINING_FIELD: return 'bg-slate-400 text-white';
            case ServiceStatus.PREDICTED: return 'bg-yellow-400 text-yellow-900';
            case ServiceStatus.WITH_ORDER: return 'bg-orange-400 text-white';
            case ServiceStatus.CONFIRMED: return 'bg-green-600 text-white';
            case ServiceStatus.TRAINING: return 'bg-purple-500 text-white';
            case ServiceStatus.VACATION: return 'bg-blue-500 text-white';
            case ServiceStatus.NEGOTIATION: return 'bg-cyan-400 text-cyan-900';
            case ServiceStatus.HOLIDAY: return 'bg-slate-800 text-white';
            default: return 'bg-slate-200 text-slate-600';
        }
    };

    const renderRows = (list: Service[]) => {
        return list.map((service) => {
            const { nextCalText, forecastText, forecastDate } = calculateCalibration(service.lastCalibration, service.period);
            const statusClass = getStatusColor(service.status);
            const isFutureForecast = forecastDate ? isFuture(forecastDate) : false;
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

            return (
                <tr key={service.id} className={`${rowBgClass} transition-colors group`}>

                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <EditableCell value={service.week} type="number" align="center" onChange={(v) => onUpdate(service.id, 'week', Number(v))} className="font-medium text-slate-500" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100">
                        <EditableCell
                            value={service.client}
                            list="client-options"
                            onChange={(v) => onUpdate(service.id, 'client', v)}
                            className="font-semibold text-slate-800"
                        />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100">
                        <EditableCell value={service.manager} align="center" onChange={(v) => onUpdate(service.id, 'manager', v)} className="uppercase text-xs font-medium text-slate-500" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100">
                        <EditableCell value={service.os} onChange={(v) => onUpdate(service.id, 'os', v)} className="font-mono text-xs text-slate-600" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100">
                        <EditableCell value={service.description} onChange={(v) => onUpdate(service.id, 'description', v)} className="text-slate-600" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <EditableCell value={service.hp} type="number" align="center" onChange={(v) => onUpdate(service.id, 'hp', Number(v))} className="text-slate-500" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <EditableCell value={service.ht} type="number" align="center" onChange={(v) => onUpdate(service.id, 'ht', Number(v))} className="text-slate-500" />
                    </td>

                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <EditableCell value={service.hv} type="number" align="center" onChange={(v) => onUpdate(service.id, 'hv', Number(v))} className="text-slate-500" />
                    </td>

                    {/* Start Date Column */}
                    <td className="p-0 border-b border-slate-100 relative h-10">
                        <input
                            type="date"
                            className={`w-full h-full bg-transparent text-center text-xs text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none transition-colors ${!isStartDateValid ? 'bg-red-50 text-red-600 font-bold' : ''} ${!canEdit ? 'cursor-default' : ''}`}
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
                    <td className="p-0 border-b border-slate-100 relative h-10">
                        <input
                            type="date"
                            className={`w-full h-full bg-transparent text-center text-xs text-slate-700 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none transition-colors ${!isEndDateValid || isRangeInvalid ? 'bg-red-50 text-red-600 font-bold' : ''} ${!canEdit ? 'cursor-default' : ''}`}
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
                    <td className="p-0 h-10 border-b border-slate-100 text-center relative z-20">
                        <TechnicianMultiSelect
                            selectedIds={service.technicianIds || []}
                            technicians={technicians}
                            onChange={(newIds) => onUpdate(service.id, 'technicianIds', newIds)}
                            disabled={!canEdit}
                        />
                    </td>

                    <td className="p-0 border-b border-slate-100 relative h-10">
                        <input
                            type="date"
                            className={`w-full h-full bg-transparent text-center text-[10px] text-slate-500 cursor-pointer focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none ${!canEdit ? 'cursor-default' : ''}`}
                            value={service.lastCalibration || ''}
                            onChange={(e) => onUpdate(service.id, 'lastCalibration', e.target.value)}
                            readOnly={!canEdit}
                        />
                    </td>

                    {/* Period Column */}
                    <td className="p-0 h-10 border-b border-slate-100 text-center">
                        <input
                            type="number"
                            list="period-options"
                            className={`w-full h-full bg-transparent text-center text-slate-500 focus:bg-white focus:ring-1 focus:ring-abb-red/50 outline-none ${!canEdit ? 'cursor-default' : ''}`}
                            value={service.period ?? ''}
                            onChange={(e) => onUpdate(service.id, 'period', e.target.value === '' ? 0 : Number(e.target.value))}
                            readOnly={!canEdit}
                        />
                    </td>

                    <td className="px-2 py-1 border-b border-slate-100 text-center overflow-hidden">
                        <span className="text-xs font-medium text-slate-600 truncate">{nextCalText}</span>
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
        <div className="flex flex-col h-full bg-white">
            <datalist id="client-options">
                {clients.map(c => <option key={c.id} value={c.name} />)}
            </datalist>

            <datalist id="period-options">
                <option value="0" />
                <option value="6" />
                <option value="12" />
                <option value="18" />
                <option value="24" />
                <option value="36" />
            </datalist>

            <div className="overflow-auto flex-grow pb-32"> {/* Added padding bottom for dropdown space */}
                <table className="w-full text-xs whitespace-nowrap border-collapse">
                    <thead className="sticky top-0 z-30">
                        <tr className="bg-slate-50 shadow-sm">
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-12">Sem.</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 min-w-[180px]">Cliente</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 w-20">Manager</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 w-20">OS</th>
                            <th className="px-2 py-3 text-left font-semibold uppercase text-slate-500 border-b border-slate-200 min-w-[150px]">Descrição</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-10">HP</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-10">HT</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-10">HV</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-24">Início</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-24">Fim</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-24">Exec.</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-24">Últ. Cal.</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-16">Período</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-28">Próx. Calibração</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-32">Status</th>
                            <th className="px-2 py-3 text-center font-semibold uppercase text-slate-500 border-b border-slate-200 w-28">Previsão</th>
                            {canEdit && <th className="w-10 border-b border-slate-200"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {renderRows(services)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};