import React from 'react';
import { Modal } from './Modal';
import { Service, Technician } from '../types';
import { ConflictResolutionSuggestion, isoToBrDate } from '../utils';
import {
  AlertTriangle,
  UserCheck,
  Calendar,
  ArrowLeft,
  ArrowRight,
  X,
  Clock,
  Building2,
  Check
} from 'lucide-react';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | Partial<Service> | null;
  suggestions: ConflictResolutionSuggestion | null;
  onSelectTechSwap: (newTechId: string) => void;
  onSelectDateChange: (newStartDate: string, newEndDate: string, chosenTechId?: string) => void;
  onKeepOverlap?: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  service,
  suggestions,
  onSelectTechSwap,
  onSelectDateChange,
  onKeepOverlap
}) => {
  if (!isOpen || !suggestions || !suggestions.hasConflict) return null;

  const currentClient = service?.client || 'Cliente';
  const currentPeriod = service?.startDate && service?.endDate
    ? `${isoToBrDate(service.startDate)} a ${isoToBrDate(service.endDate)}`
    : 'Período selecionado';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-amber-200 bg-amber-50/70 flex items-start justify-between sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="bg-amber-500 text-white p-2.5 rounded-xl shadow-sm">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Sobreposição de Agenda Detectada
              </h2>
              <p className="text-xs text-amber-800 font-medium">
                O motor calculou sugestões automáticas para resolver este conflito:
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-white rounded-full transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Resumo do Conflito */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                Empresa: <strong className="text-slate-800">{currentClient}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                Duração: <strong className="text-slate-800">{suggestions.durationDays} dia(s)</strong>
              </span>
            </div>
            <div className="text-slate-600">
              Período pretendido: <span className="font-semibold text-slate-900 bg-amber-100/70 px-1.5 py-0.5 rounded">{currentPeriod}</span>
            </div>

            {/* Lista dos conflitos detectados */}
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                Conflito(s) em aberto ({suggestions.conflicts.length}):
              </span>
              {suggestions.conflicts.map(c => (
                <div key={c.id} className="text-[11px] text-slate-700 bg-white p-2 rounded border border-amber-200 flex items-start gap-2">
                  <span className="text-amber-600 shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <span className="font-semibold text-slate-900">{c.title}: </span>
                    <span>{c.summaryText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seção das Soluções Propostas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Escolha como deseja resolver:
            </h3>

            {/* Alternativa 1: Troca de Técnico */}
            {suggestions.techSwapOptions.length > 0 && (
              <div className="border-2 border-emerald-200 hover:border-emerald-400 bg-emerald-50/40 rounded-xl p-4 transition-all space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500 text-white p-2 rounded-lg shrink-0 mt-0.5">
                    <UserCheck size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Opção 1: Trocar de Técnico
                      </h4>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                        Mesmo Período ({currentPeriod})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Mantém a mesma data da visita e aloca automaticamente para um técnico 100% livre:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-11">
                  {suggestions.techSwapOptions.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTechSwap(t.id)}
                      className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-600 text-slate-800 hover:text-white rounded-lg border border-emerald-300 hover:border-emerald-600 shadow-2xs transition-all text-xs font-semibold cursor-pointer group text-left"
                    >
                      <span className="truncate">
                        {t.name} <span className="text-[11px] font-normal opacity-80">({t.fullName})</span>
                      </span>
                      <Check size={14} className="text-emerald-600 group-hover:text-white shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Alternativa 2: Antecipação da Data mais Próxima */}
            {suggestions.earlierOption && (
              <div className="border-2 border-sky-200 hover:border-sky-400 bg-sky-50/40 rounded-xl p-4 transition-all space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="bg-sky-500 text-white p-2 rounded-lg shrink-0 mt-0.5">
                    <ArrowLeft size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Opção 2: Antecipar para a Data mais Próxima
                      </h4>
                      <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-300">
                        {suggestions.earlierOption.daysShift} dia(s) antes
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Janela contínua livre mais próxima que atende o período ({suggestions.durationDays} dias), iniciando em dia útil:
                    </p>
                  </div>
                </div>

                <div className="pl-11 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs">
                    <div className="text-slate-500">Novo período sugerido:</div>
                    <div className="text-sm font-bold text-slate-900">
                      {suggestions.earlierOption.formattedRange}
                    </div>
                    <div className="text-[11px] text-sky-700 mt-0.5 font-medium">
                      Técnico disponível: <strong className="text-slate-800">{suggestions.earlierOption.availableTechs[0]?.name || 'Equipe livre'}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDateChange(
                      suggestions.earlierOption!.startDate,
                      suggestions.earlierOption!.endDate,
                      suggestions.earlierOption!.availableTechs[0]?.id
                    )}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Calendar size={14} />
                    Antecipar para esta Data
                  </button>
                </div>
              </div>
            )}

            {/* Alternativa 3: Adiamento da Data mais Próxima */}
            {suggestions.laterOption && (
              <div className="border-2 border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-xl p-4 transition-all space-y-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-500 text-white p-2 rounded-lg shrink-0 mt-0.5">
                    <ArrowRight size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Opção 3: Adiar para a Data Posterior mais Próxima
                      </h4>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-300">
                        {suggestions.laterOption.daysShift} dia(s) depois
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Próxima janela livre contínua ({suggestions.durationDays} dias), iniciando em dia útil:
                    </p>
                  </div>
                </div>

                <div className="pl-11 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs">
                    <div className="text-slate-500">Novo período sugerido:</div>
                    <div className="text-sm font-bold text-slate-900">
                      {suggestions.laterOption.formattedRange}
                    </div>
                    <div className="text-[11px] text-indigo-700 mt-0.5 font-medium">
                      Técnico disponível: <strong className="text-slate-800">{suggestions.laterOption.availableTechs[0]?.name || 'Equipe livre'}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDateChange(
                      suggestions.laterOption!.startDate,
                      suggestions.laterOption!.endDate,
                      suggestions.laterOption!.availableTechs[0]?.id
                    )}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Calendar size={14} />
                    Adiar para esta Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          {onKeepOverlap ? (
            <button
              type="button"
              onClick={onKeepOverlap}
              className="px-3 py-1.5 text-xs text-amber-800 hover:text-amber-950 font-semibold hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            >
              ⚠️ Manter com Sobreposição
            </button>
          ) : (
            <div></div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Cancelar Alteração
          </button>
        </div>

      </div>
    </Modal>
  );
};
