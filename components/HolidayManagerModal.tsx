import React, { useState } from 'react';
import { Modal } from './Modal';
import { RegionalHoliday } from '../types';
import { X, Plus, Trash2, Calendar, Pencil, Check, Sparkles, AlertCircle, Info } from 'lucide-react';

interface HolidayManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionalHolidays: RegionalHoliday[];
  onAdd: (holiday: RegionalHoliday) => void;
  onUpdate: (id: string, updated: Partial<RegionalHoliday>) => void;
  onDelete: (id: string) => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Feriados nacionais fixos para exibição informativa
const NATIONAL_FIXED_HOLIDAYS = [
  { day: 1, month: 1, name: 'Confraternização Universal' },
  { day: 21, month: 4, name: 'Tiradentes' },
  { day: 1, month: 5, name: 'Dia do Trabalho' },
  { day: 7, month: 9, name: 'Independência do Brasil' },
  { day: 12, month: 10, name: 'Nossa Senhora Aparecida' },
  { day: 2, month: 11, name: 'Finados' },
  { day: 15, month: 11, name: 'Proclamação da República' },
  { day: 20, month: 11, name: 'Dia da Consciência Negra' },
  { day: 25, month: 12, name: 'Natal' }
];

export const HolidayManagerModal: React.FC<HolidayManagerModalProps> = ({
  isOpen,
  onClose,
  regionalHolidays,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'regional' | 'national'>('regional');
  const [newName, setNewName] = useState('');
  const [newDay, setNewDay] = useState<number>(1);
  const [newMonth, setNewMonth] = useState<number>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDay, setEditingDay] = useState<number>(1);
  const [editingMonth, setEditingMonth] = useState<number>(1);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const validateDayMonth = (day: number, month: number): boolean => {
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
    const maxDays = new Date(2024, month, 0).getDate(); // 2024 é bissexto para permitir 29/02 se necessário
    return day <= maxDays;
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Informe o nome do feriado regional.');
      return;
    }
    if (!validateDayMonth(newDay, newMonth)) {
      setError(`O dia ${newDay} não é válido para ${MONTH_NAMES[newMonth - 1]}.`);
      return;
    }

    const exists = regionalHolidays.some(
      h => h.day === newDay && h.month === newMonth
    );
    if (exists) {
      setError(`Já existe um feriado regional cadastrado para o dia ${String(newDay).padStart(2, '0')}/${String(newMonth).padStart(2, '0')}.`);
      return;
    }

    onAdd({
      id: `hol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      day: newDay,
      month: newMonth,
    });

    setNewName('');
    setError('');
  };

  const handleStartEdit = (h: RegionalHoliday) => {
    setEditingId(h.id);
    setEditingName(h.name);
    setEditingDay(h.day);
    setEditingMonth(h.month);
    setError('');
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError('O nome do feriado não pode ficar vazio.');
      return;
    }
    if (!validateDayMonth(editingDay, editingMonth)) {
      setError(`O dia ${editingDay} não é válido para ${MONTH_NAMES[editingMonth - 1]}.`);
      return;
    }

    const duplicate = regionalHolidays.some(
      h => h.id !== id && h.day === editingDay && h.month === editingMonth
    );
    if (duplicate) {
      setError(`Já existe outro feriado cadastrado para o dia ${String(editingDay).padStart(2, '0')}/${String(editingMonth).padStart(2, '0')}.`);
      return;
    }

    onUpdate(id, {
      name: trimmed,
      day: editingDay,
      month: editingMonth,
    });
    setEditingId(null);
    setError('');
  };

  const sortedRegional = [...regionalHolidays].sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-abb-red/10 p-2.5 rounded-lg text-abb-red">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Gerenciador de Feriados</h2>
              <p className="text-xs text-slate-500">
                Feriados têm o mesmo status e visual de finais de semana na escala
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b bg-slate-50 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('regional')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'regional'
                ? 'border-abb-red text-abb-red bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={14} />
            Feriados Regionais ({regionalHolidays.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('national')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'national'
                ? 'border-abb-red text-abb-red bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Info size={14} />
            Feriados Nacionais (Automáticos)
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium animate-in fade-in duration-150">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'regional' && (
            <div className="space-y-5">
              {/* Formulário de Adicionar */}
              <form onSubmit={handleAdd} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus size={14} className="text-abb-red" />
                    Cadastrar Novo Feriado Regional
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Recorrente todo ano</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Nome do feriado (ex: Revolução Constitucionalista)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={newDay}
                      onChange={(e) => setNewDay(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-xs text-center font-bold focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none"
                      title="Dia do mês (1 a 31)"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={newMonth}
                      onChange={(e) => setNewMonth(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none cursor-pointer"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-abb-red hover:brightness-110 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    Adicionar Feriado Regional
                  </button>
                </div>
              </form>

              {/* Lista de Feriados Regionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Feriados Regionais Ativos ({regionalHolidays.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Aplicados a todos os clientes na Timeline
                  </span>
                </div>

                {sortedRegional.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    Nenhum feriado regional cadastrado. Adicione um feriado acima (ex: feriado estadual ou municipal).
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                    {sortedRegional.map((h) => {
                      const isEditing = editingId === h.id;
                      const formattedDate = `${String(h.day).padStart(2, '0')}/${String(h.month).padStart(2, '0')}`;

                      return (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                        >
                          {isEditing ? (
                            <div className="flex-1 grid grid-cols-12 gap-2 mr-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="col-span-6 bg-white border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-abb-red"
                              />
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={editingDay}
                                onChange={(e) => setEditingDay(Number(e.target.value))}
                                className="col-span-2 bg-white border border-slate-300 rounded px-1 py-1 text-xs text-center font-bold"
                              />
                              <select
                                value={editingMonth}
                                onChange={(e) => setEditingMonth(Number(e.target.value))}
                                className="col-span-4 bg-white border border-slate-300 rounded px-1 py-1 text-xs"
                              >
                                {MONTH_NAMES.map((name, idx) => (
                                  <option key={name} value={idx + 1}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-mono font-bold text-xs border border-red-200 shrink-0">
                                {formattedDate}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{h.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {h.day} de {MONTH_NAMES[h.month - 1]} (todo ano)
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(h.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title="Salvar alterações"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Cancelar edição"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(h)}
                                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Editar feriado"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Excluir o feriado regional "${h.name}" (${formattedDate})?`)) {
                                      onDelete(h.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="Excluir feriado"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'national' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Feriados Nacionais Identificados Automaticamente</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    O sistema reconhece todos os feriados nacionais fixos e móveis (Páscoa, Carnaval, Sexta-feira Santa e Corpus Christi). Eles são destacados com tarja vermelha e respeitados pelo motor de agendamento.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                {NATIONAL_FIXED_HOLIDAYS.map((nh) => (
                  <div key={nh.name} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono font-bold text-xs border border-slate-200 shrink-0">
                        {String(nh.day).padStart(2, '0')}/{String(nh.month).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{nh.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Nacional Fixo
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-amber-100 text-amber-900 rounded font-mono font-bold text-xs border border-amber-300 shrink-0">
                      Móveis
                    </span>
                    <span className="text-xs font-semibold text-slate-800">Carnaval, Sexta-feira Santa e Corpus Christi</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Calculados Anualmente
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
