import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Service, ServiceStatus, Technician, Client } from '../types';
import { X, PlusCircle, Pencil, Trash2, AlertTriangle, Repeat } from 'lucide-react';
import { format } from 'date-fns/format';
import { checkPeriodExceeded } from '../utils';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Omit<Service, 'id'>) => void;
  onDelete?: (id: string) => void;
  technicians: Technician[];
  clients: Client[];
  serviceToEdit?: Service | null;
  onGenerateRecurrence?: (serviceId: string) => void;
  canEdit?: boolean;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  technicians,
  clients,
  serviceToEdit,
  onGenerateRecurrence,
  canEdit = true
}) => {
  const getInitialFormData = () => ({
    week: parseInt(format(new Date(), 'w')),
    client: '',
    manager: '',
    os: '',
    description: '',
    hp: 0,
    ht: 0,
    hv: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    technicianIds: [] as string[],
    status: ServiceStatus.PREDICTED,
    period: 6,
    lastCalibration: '',
    comments: '',
    realized: 'nao' as 'sim' | 'nao'
  });

  const [formData, setFormData] = useState<Partial<Service>>(getInitialFormData());

  useEffect(() => {
    if (isOpen) {
      if (serviceToEdit) {
        setFormData({
          ...serviceToEdit,
          startDate: serviceToEdit.startDate,
          endDate: serviceToEdit.endDate,
          lastCalibration: serviceToEdit.lastCalibration || '',
          nextCalibration: serviceToEdit.nextCalibration || '',
          technicianIds: serviceToEdit.technicianIds || [],
          comments: serviceToEdit.comments || '',
          realized: serviceToEdit.realized || 'nao',
          previousLastCalibration: serviceToEdit.previousLastCalibration,
          previousStatus: serviceToEdit.previousStatus
        });
      } else {
        // Pre-select first tech if none
        const initial = getInitialFormData();
        if (technicians.length > 0) {
          initial.technicianIds = [technicians[0].id];
        }
        setFormData(initial);
      }
    }
  }, [isOpen, technicians, serviceToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return; // Prevention
    if (!formData.client || !formData.startDate || !formData.endDate || !formData.technicianIds || formData.technicianIds.length === 0) {
      alert('Preencha os campos obrigatórios (Cliente, Datas, pelo menos um Técnico).');
      return;
    }
    onSave(formData as Omit<Service, 'id'>);
  };

  const handleChange = (field: keyof Service, value: any) => {
    if (!canEdit) return;

    if (field === 'realized') {
      if (value === 'sim') {
        if (!formData.endDate) {
          alert('A coluna Fim precisa estar preenchida para marcar como Realizado.');
          return;
        }
        setFormData(prev => ({
          ...prev,
          realized: 'sim',
          previousLastCalibration: prev.lastCalibration || '',
          lastCalibration: prev.endDate || '',
          previousStatus: prev.status,
          status: ServiceStatus.PREDICTED
        }));
        return;
      } else if (value === 'nao') {
        setFormData(prev => ({
          ...prev,
          realized: 'nao',
          lastCalibration: prev.previousLastCalibration !== undefined ? prev.previousLastCalibration : prev.lastCalibration,
          status: prev.previousStatus !== undefined ? prev.previousStatus : prev.status
        }));
        return;
      }
    }

    if (field === 'nextCalibration') {
      setFormData(prev => ({
        ...prev,
        nextCalibration: value,
        ...(prev.realized === 'sim' ? { status: ServiceStatus.PREDICTED } : {})
      }));
      return;
    }

    if (field === 'startDate') {
      setFormData(prev => {
        if (prev.realized === 'sim' && value !== prev.startDate) {
          return {
            ...prev,
            startDate: value,
            realized: 'nao',
            lastCalibration: prev.previousLastCalibration !== undefined ? prev.previousLastCalibration : prev.lastCalibration,
            status: prev.previousStatus !== undefined ? prev.previousStatus : prev.status,
          };
        }
        return { ...prev, startDate: value };
      });
      return;
    }

    if (field === 'endDate') {
      setFormData(prev => ({
        ...prev,
        endDate: value,
        ...(prev.realized === 'sim' && value ? { lastCalibration: value, status: ServiceStatus.PREDICTED } : {})
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTechnician = (techId: string) => {
    if (!canEdit) return;
    setFormData(prev => {
      const currentIds = prev.technicianIds || [];
      if (currentIds.includes(techId)) {
        return { ...prev, technicianIds: currentIds.filter(id => id !== techId) };
      } else {
        return { ...prev, technicianIds: [...currentIds, techId] };
      }
    });
  };

  const inputClass = `w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red/50 outline-none transition-colors ${!canEdit ? 'opacity-60 cursor-default' : ''}`;
  const labelClass = "block text-xs font-bold text-slate-600 mb-1.5";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={`bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col ${serviceToEdit ? 'max-w-lg' : 'max-w-4xl'}`}>

        <div className="flex items-center justify-between p-5 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-abb-red/10 p-2 rounded-lg text-abb-red">
              {serviceToEdit ? <Pencil size={20} /> : <PlusCircle size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {serviceToEdit ? (canEdit ? 'Editar Atividade' : 'Detalhes da Atividade') : 'Criar Nova Atividade'}
              </h2>
              <p className="text-xs text-slate-500">
                {canEdit ? 'Preencha os detalhes abaixo' : 'Visualização em modo leitura'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {serviceToEdit ? (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>CLIENTE *</label>
                <select
                  required
                  disabled={!canEdit}
                  className={inputClass}
                  value={formData.client}
                  onChange={e => handleChange('client', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>STATUS</label>
                  <select
                    className={inputClass}
                    disabled={!canEdit}
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value as ServiceStatus)}
                  >
                    {Object.values(ServiceStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>REALIZADO</label>
                  <select
                    className={inputClass}
                    disabled={!canEdit}
                    value={formData.realized || 'nao'}
                    onChange={e => handleChange('realized', e.target.value as 'sim' | 'nao')}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>INÍCIO *</label>
                  <input
                    type="date"
                    required
                    disabled={!canEdit}
                    className={inputClass}
                    value={formData.startDate}
                    onChange={e => handleChange('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>FIM *</label>
                  <input
                    type="date"
                    required
                    disabled={!canEdit}
                    className={inputClass}
                    value={formData.endDate}
                    onChange={e => handleChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>ÚLTIMA CALIBRAÇÃO</label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    className={inputClass}
                    value={formData.lastCalibration || ''}
                    onChange={e => handleChange('lastCalibration', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>PRÓXIMA CALIBRAÇÃO</label>
                  {formData.realized !== 'sim' ? (
                    <input
                      type="text"
                      disabled
                      className={`${inputClass} text-center font-bold text-slate-400 bg-slate-100 cursor-not-allowed`}
                      value="0"
                      title="Próxima calibração é 0 quando Realizado é Não"
                    />
                  ) : (
                    <input
                      type="date"
                      disabled={!canEdit}
                      className={inputClass}
                      value={formData.nextCalibration || ''}
                      onChange={e => handleChange('nextCalibration', e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className={labelClass}>PERÍODO (MESES)</label>
                  <input
                    type="number"
                    min="0"
                    disabled={!canEdit}
                    className={inputClass}
                    value={formData.period ?? 0}
                    onChange={e => handleChange('period', Number(e.target.value))}
                  />
                </div>
              </div>

              {canEdit && onGenerateRecurrence && (
                <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <div className="text-xs text-amber-900">
                    <span className="font-bold">Recorrência periódica:</span> Projeta visitas como <span className="font-semibold text-yellow-700 bg-yellow-100 px-1 rounded">Cliente Previsto</span> até 36 meses.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onGenerateRecurrence(serviceToEdit.id);
                      onClose();
                    }}
                    disabled={!formData.period || formData.period <= 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 border border-amber-300 rounded-md shadow-2xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    title={formData.period && formData.period > 0 ? "Gerar série de visitas futuras (+36m)" : "Defina um período (> 0) para gerar recorrência"}
                  >
                    <Repeat size={14} />
                    Gerar Recorrência (+36m)
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>OBSERVAÇÕES E NOTAS TÉCNICAS</label>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {(formData.comments || '').length} caractere(s)
                  </span>
                </div>
                <textarea
                  rows={4}
                  readOnly={!canEdit}
                  placeholder="Digite anotações, detalhes da calibração, contato do cliente, orientações para os técnicos..."
                  className={`w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none resize-y transition-all placeholder:text-slate-400 leading-relaxed ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                  value={formData.comments || ''}
                  onChange={e => handleChange('comments', e.target.value)}
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className={labelClass}>TÉCNICOS (Selecione múltiplos)</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {technicians.map(t => (
                    <label key={t.id} className={`flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors ${!canEdit ? 'cursor-default pointer-events-none opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={formData.technicianIds?.includes(t.id)}
                        onChange={() => toggleTechnician(t.id)}
                        className="text-abb-red focus:ring-abb-red rounded"
                      />
                      <span className="text-sm font-medium text-slate-700">{t.name}</span>
                      <span className="text-xs text-slate-400 truncate">{t.fullName}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

          ) : (

            <React.Fragment>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>CLIENTE *</label>
                  <select
                    required
                    disabled={!canEdit}
                    className={inputClass}
                    value={formData.client}
                    onChange={e => handleChange('client', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>STATUS</label>
                  <select
                    className={inputClass}
                    disabled={!canEdit}
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value as ServiceStatus)}
                  >
                    {Object.values(ServiceStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>REALIZADO</label>
                  <select
                    className={inputClass}
                    disabled={!canEdit}
                    value={formData.realized || 'nao'}
                    onChange={e => handleChange('realized', e.target.value as 'sim' | 'nao')}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>GERENTE</label>
                  <input
                    type="text"
                    readOnly={!canEdit}
                    className={inputClass}
                    value={formData.manager}
                    onChange={e => handleChange('manager', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>OS</label>
                  <input
                    type="text"
                    readOnly={!canEdit}
                    className={inputClass}
                    value={formData.os}
                    onChange={e => handleChange('os', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>SEMANA</label>
                  <input
                    type="number"
                    readOnly={!canEdit}
                    className={inputClass}
                    value={formData.week}
                    onChange={e => handleChange('week', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>DESCRIÇÃO</label>
                <input
                  type="text"
                  readOnly={!canEdit}
                  className={inputClass}
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                />
              </div>

              <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <label className={labelClass}>TÉCNICOS *</label>
                  <div className="bg-white border border-slate-300 rounded-lg p-2 h-[120px] overflow-y-auto">
                    {technicians.map(t => (
                      <label key={t.id} className={`flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer ${!canEdit ? 'cursor-default pointer-events-none opacity-60' : ''}`}>
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={formData.technicianIds?.includes(t.id)}
                          onChange={() => toggleTechnician(t.id)}
                          className="text-abb-red focus:ring-abb-red rounded"
                        />
                        <div className="leading-tight">
                          <div className="text-xs font-bold text-slate-700">{t.name}</div>
                          <div className="text-[10px] text-slate-400">{t.fullName}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>INÍCIO *</label>
                  <input
                    type="date"
                    required
                    readOnly={!canEdit}
                    className={inputClass}
                    value={formData.startDate}
                    onChange={e => handleChange('startDate', e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelClass}>FIM *</label>
                  <input
                    type="date"
                    required
                    readOnly={!canEdit}
                    className={inputClass}
                    value={formData.endDate}
                    onChange={e => handleChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-amber-50/40 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Dados de Calibração & Recorrência</h3>
                  {formData.period && formData.period > 0 ? (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
                      ⚡ Projeção Automática Ativa (até 36m)
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Última Calibração</label>
                    <input
                      type="date"
                      readOnly={!canEdit}
                      className={`w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                      value={formData.lastCalibration || ''}
                      onChange={e => handleChange('lastCalibration', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Próxima Calibração</label>
                    {formData.realized !== 'sim' ? (
                      <input
                        type="text"
                        disabled
                        className="w-full bg-slate-100 border border-amber-200 rounded-lg px-3 py-2 text-sm text-center font-bold text-slate-400 cursor-not-allowed outline-none"
                        value="0"
                        title="Próxima calibração é 0 quando Realizado é Não"
                      />
                    ) : (
                      <input
                        type="date"
                        readOnly={!canEdit}
                        className={`w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                        value={formData.nextCalibration || ''}
                        onChange={e => handleChange('nextCalibration', e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Período de Recorrência (Meses)</label>
                    <input
                      type="number"
                      min="0"
                      max="36"
                      readOnly={!canEdit}
                      className={`w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                      value={formData.period}
                      onChange={e => handleChange('period', e.target.value === '' ? 0 : Number(e.target.value))}
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[0, 6, 12, 18, 24, 30, 36].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleChange('period', opt)}
                          className={`px-2 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                            formData.period === opt
                              ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {Boolean(formData.period && formData.period > 0) && (() => {
                  const p = formData.period as number;
                  const count = Math.min(Math.floor(36 / p), 12);
                  const examples = Array.from({ length: count }, (_, i) => `+${(i + 1) * p}m`).join(', ');

                  // Checa se a data inicial escolhida ultrapassa o prazo
                  // (checkPeriodExceeded só lê period, lastCalibration e startDate)
                  const startDateStr = formData.startDate || '';
                  const periodCheck = checkPeriodExceeded(
                    { period: p, lastCalibration: formData.lastCalibration || '', startDate: startDateStr } as Service,
                    startDateStr
                  );

                  return (
                    <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-col gap-2">
                      {periodCheck.isExceeded && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-100/90 border border-red-300 p-2.5 rounded-md animate-pulse font-medium">
                          <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
                          <div>
                            <strong>⚠️ ATENÇÃO: PRAZO DE PERIODICIDADE ULTRAPASSADO!</strong>
                            <div className="text-[11px] text-red-600 mt-0.5">
                              A data de início ({startDateStr}) ultrapassa a data limite calculada ({periodCheck.limitDateText}) em <strong>{periodCheck.daysExceeded} dias</strong>.
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-100/40 p-2.5 rounded-md">
                        <span className="text-amber-600 font-bold">💡</span>
                        <div className="flex-1">
                          <span className="font-semibold">Agendamentos futuros automáticos:</span> Ao salvar, o sistema projeta visitas como <span className="font-bold text-yellow-700 bg-yellow-100 px-1 py-0.5 rounded">Cliente Previsto</span> a cada <strong>{p} meses</strong> até o limite de <strong>36 meses</strong> (ex: {examples}).
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Métricas de Horas</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HP</label>
                    <input
                      type="number"
                      readOnly={!canEdit}
                      className={`w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                      value={formData.hp}
                      onChange={e => handleChange('hp', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HT</label>
                    <input
                      type="number"
                      readOnly={!canEdit}
                      className={`w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                      value={formData.ht}
                      onChange={e => handleChange('ht', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HV</label>
                    <input
                      type="number"
                      readOnly={!canEdit}
                      className={`w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                      value={formData.hv}
                      onChange={e => handleChange('hv', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>OBSERVAÇÕES E NOTAS TÉCNICAS</label>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {(formData.comments || '').length} caractere(s)
                  </span>
                </div>
                <textarea
                  rows={3}
                  readOnly={!canEdit}
                  placeholder="Digite anotações, detalhes da calibração, contato do cliente, orientações para os técnicos..."
                  className={`w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-abb-red/20 focus:border-abb-red outline-none resize-y transition-all placeholder:text-slate-400 leading-relaxed ${!canEdit ? 'opacity-60 cursor-default' : ''}`}
                  value={formData.comments || ''}
                  onChange={e => handleChange('comments', e.target.value)}
                />
              </div>
            </React.Fragment>
          )}


          <div className="flex items-center justify-between pt-5 border-t border-slate-200">
            {/* Botão Excluir - só aparece ao editar */}
            {serviceToEdit && canEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Excluir a atividade de "${serviceToEdit.client}"?`)) {
                    onDelete(serviceToEdit.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            )}
            {/* Spacer quando não há botão de excluir */}
            {!(serviceToEdit && canEdit && onDelete) && <div />}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {canEdit ? 'Cancelar' : 'Fechar'}
              </button>
              {canEdit && (
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold text-white bg-abb-red hover:brightness-110 rounded-lg shadow-md shadow-abb-red/20 transition-all"
                >
                  {serviceToEdit ? 'Salvar Alterações' : 'Criar Atividade'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};