import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Repeat, ArrowRight, Clock, Users, Sparkles, AlertCircle } from 'lucide-react';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { isValid } from 'date-fns/isValid';
import { ptBR } from 'date-fns/locale/pt-BR';
import type { Service, Technician } from '../types';
import { createRecurringCalibrationForecasts } from '../utils';

interface RecurrenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: Service | null;
    technicians: Technician[];
    existingServices: Service[];
    onConfirm: (service: Service, period: number, horizonMonths: number) => void;
}

const COMMON_PERIODS = [3, 6, 12, 24, 36];
const COMMON_HORIZONS = [12, 24, 36, 48];

export const RecurrenceModal: React.FC<RecurrenceModalProps> = ({
    isOpen,
    onClose,
    service,
    technicians,
    existingServices,
    onConfirm,
}) => {
    const [period, setPeriod] = useState<number>(6);
    const [horizonMonths, setHorizonMonths] = useState<number>(36);

    // Inicializa valores ao abrir o modal com base no serviço selecionado
    useEffect(() => {
        if (service) {
            setPeriod(service.period && service.period > 0 ? service.period : 6);
            setHorizonMonths(36);
        }
    }, [service, isOpen]);

    // Fechar ao teclar Esc
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Prévia em tempo real das visitas futuras
    const previewForecasts = useMemo(() => {
        if (!service || period <= 0 || horizonMonths <= 0) return [];
        return createRecurringCalibrationForecasts(
            service,
            technicians,
            existingServices,
            horizonMonths,
            period
        );
    }, [service, technicians, existingServices, horizonMonths, period]);

    if (!isOpen || !service) return null;

    const formattedStartDate = service.startDate && isValid(parseISO(service.startDate))
        ? format(parseISO(service.startDate), 'dd/MM/yyyy', { locale: ptBR })
        : '-';
    const formattedEndDate = service.endDate && isValid(parseISO(service.endDate))
        ? format(parseISO(service.endDate), 'dd/MM/yyyy', { locale: ptBR })
        : '-';

    const handleConfirm = () => {
        if (previewForecasts.length === 0) return;
        onConfirm(service, period, horizonMonths);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 flex items-start justify-between relative">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-abb-red text-white rounded-xl shadow-md">
                            <Repeat size={22} className="animate-spin-slow" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                Gerar Recorrência de Calibração
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                                <span className="font-semibold text-white">{service.client}</span>
                                {service.os && <span>• OS: {service.os}</span>}
                                <span>• Base: {formattedStartDate} até {formattedEndDate}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="Fechar (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Conteúdo rolável */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
                    {/* Parâmetros em 2 colunas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Seletor de Periodicidade */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Clock size={14} className="text-abb-red" />
                                    Periodicidade (a cada X meses):
                                </label>
                                <span className="text-xs font-black text-abb-red bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                    {period} {period === 1 ? 'mês' : 'meses'}
                                </span>
                            </div>

                            {/* Botões rápidos de período */}
                            <div className="grid grid-cols-5 gap-1.5">
                                {COMMON_PERIODS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPeriod(p)}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                            period === p
                                                ? 'bg-abb-red text-white border-abb-red shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {p}m
                                    </button>
                                ))}
                            </div>

                            {/* Input manual de período */}
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-[11px] text-slate-500 font-medium">Personalizado:</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={period || ''}
                                    onChange={(e) => setPeriod(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none"
                                />
                                <span className="text-xs text-slate-500">meses</span>
                            </div>
                        </div>

                        {/* Seletor de Horizonte Futuro */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Calendar size={14} className="text-abb-red" />
                                    Horizonte Futuro (projetar até):
                                </label>
                                <span className="text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                    {horizonMonths} meses ({Math.round(horizonMonths / 12 * 10) / 10}a)
                                </span>
                            </div>

                            {/* Botões rápidos de horizonte */}
                            <div className="grid grid-cols-4 gap-1.5">
                                {COMMON_HORIZONS.map((h) => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => setHorizonMonths(h)}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition-all border ${
                                            horizonMonths === h
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {h}m ({h / 12}a)
                                    </button>
                                ))}
                            </div>

                            {/* Input manual de horizonte */}
                            <div className="flex items-center gap-2 pt-1">
                                <span className="text-[11px] text-slate-500 font-medium">Personalizado:</span>
                                <input
                                    type="number"
                                    min={period}
                                    max="120"
                                    value={horizonMonths || ''}
                                    onChange={(e) => setHorizonMonths(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none"
                                />
                                <span className="text-xs text-slate-500">meses à frente</span>
                            </div>
                        </div>
                    </div>

                    {/* Área de Prévia Dinâmica */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={14} className="text-amber-500" />
                                Prévia dos Ciclos Projetados
                            </h3>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {previewForecasts.length} {previewForecasts.length === 1 ? 'visita gerada' : 'visitas geradas'}
                            </span>
                        </div>

                        {previewForecasts.length === 0 ? (
                            <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-1">
                                <AlertCircle size={22} className="mx-auto text-slate-400" />
                                <p className="text-xs text-slate-600 font-medium">Nenhum ciclo pôde ser gerado com esses parâmetros.</p>
                                <p className="text-[11px] text-slate-400">Verifique se o horizonte futuro é maior ou igual à periodicidade.</p>
                            </div>
                        ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100 max-h-56 overflow-y-auto">
                                {previewForecasts.map((f, idx) => {
                                    const startStr = f.startDate ? format(parseISO(f.startDate), 'dd/MM/yyyy', { locale: ptBR }) : '-';
                                    const endStr = f.endDate ? format(parseISO(f.endDate), 'dd/MM/yyyy', { locale: ptBR }) : '-';
                                    const assignedTechs = (f.technicianIds || [])
                                        .map(tId => technicians.find(t => t.id === tId)?.name || tId)
                                        .filter(Boolean)
                                        .join(', ');

                                    return (
                                        <div key={f.id || idx} className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between text-xs gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                                                    #{idx + 1}
                                                </span>
                                                <div>
                                                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                        <span>{startStr}</span>
                                                        <ArrowRight size={12} className="text-slate-400 shrink-0" />
                                                        <span>{endStr}</span>
                                                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                                                            (Semana {f.week})
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        Últ. Cal: {f.lastCalibration ? format(parseISO(f.lastCalibration), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {assignedTechs && (
                                                    <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        <Users size={11} className="text-slate-400" />
                                                        {assignedTechs}
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                                    PREVISTO
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[11px] text-slate-400">
                            * Se a data calculada cair em sábado ou domingo, ela é ajustada automaticamente para a segunda-feira subsequente. A visita original na tabela não terá seu período alterado.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={previewForecasts.length === 0}
                        className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                            previewForecasts.length > 0
                                ? 'bg-abb-red text-white hover:bg-red-700 active:scale-98'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Repeat size={14} />
                        Gerar {previewForecasts.length} {previewForecasts.length === 1 ? 'Visita Futura' : 'Visitas Futuras'}
                    </button>
                </div>
            </div>
        </div>
    );
};
