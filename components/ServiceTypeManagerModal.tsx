import React, { useState } from 'react';
import { Modal } from './Modal';
import { ServiceType, Service } from '../types';
import { X, Plus, Trash2, Wrench, Pencil, Check, Sparkles, AlertCircle } from 'lucide-react';

interface ServiceTypeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceTypes: ServiceType[];
  services?: Service[];
  onAdd: (serviceType: ServiceType) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const ServiceTypeManagerModal: React.FC<ServiceTypeManagerModalProps> = ({
  isOpen,
  onClose,
  serviceTypes,
  services = [],
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Informe o nome do serviço.');
      return;
    }

    const exists = serviceTypes.some(
      st => st.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError('Já existe um serviço com esse nome.');
      return;
    }

    onAdd({
      id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: trimmed,
    });

    setNewName('');
    setError('');
  };

  const handleStartEdit = (st: ServiceType) => {
    setEditingId(st.id);
    setEditingName(st.name);
    setError('');
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError('O nome do serviço não pode ser vazio.');
      return;
    }

    const exists = serviceTypes.some(
      st => st.id !== id && st.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError('Já existe outro serviço com esse nome.');
      return;
    }

    onUpdate(id, trimmed);
    setEditingId(null);
    setEditingName('');
    setError('');
  };

  const handleDeleteClick = (st: ServiceType) => {
    const countUsed = services.filter(s =>
      (s.serviceTypes || []).some(
        name => name.trim().toLowerCase() === st.name.trim().toLowerCase()
      )
    ).length;

    if (countUsed > 0) {
      const confirmMsg = `O serviço "${st.name}" está vinculado a ${countUsed} atividade(s) no calendário.\n\nSe excluir, ele será removido da lista de seleção, mas as visitas que já o possuem continuarão com ele registrado.\n\nDeseja realmente excluir?`;
      if (!window.confirm(confirmMsg)) return;
    } else {
      if (!window.confirm(`Deseja excluir o serviço "${st.name}"?`)) return;
    }

    onDelete(st.id);
  };

  const inputClass =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red/50 outline-none transition-colors bg-white';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-800">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Gerenciar Serviços</h2>
              <p className="text-xs text-slate-500">
                Cadastre e personalize os tipos de serviços disponíveis nas atividades
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow space-y-5">
          {/* Form Novo Serviço */}
          <form
            onSubmit={handleAdd}
            className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Plus size={14} className="text-abb-red" />
              Adicionar Novo Serviço
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Calibração, Startup, Treinamento..."
                value={newName}
                onChange={e => {
                  setNewName(e.target.value);
                  if (error) setError('');
                }}
                className={inputClass}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-abb-red text-white text-xs font-bold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                Adicionar
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={13} />
                {error}
              </p>
            )}
          </form>

          {/* Lista de Serviços */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Serviços Cadastrados ({serviceTypes.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Disponíveis no formulário e no filtro
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
              {serviceTypes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum serviço cadastrado.
                </div>
              ) : (
                serviceTypes.map(st => {
                  const isEditing = editingId === st.id;
                  const countUsed = services.filter(s =>
                    (s.serviceTypes || []).some(
                      name => name.trim().toLowerCase() === st.name.trim().toLowerCase()
                    )
                  ).length;

                  return (
                    <div
                      key={st.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveEdit(st.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2.5 py-1 text-xs border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none font-semibold text-slate-800"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(st.id)}
                            className="p-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors shadow-2xs"
                            title="Salvar alteração"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-colors"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {st.name}
                          </span>
                          {countUsed > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                              {countUsed} {countUsed === 1 ? 'visita' : 'visitas'}
                            </span>
                          )}
                        </div>
                      )}

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(st)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar nome"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(st)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir serviço"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
