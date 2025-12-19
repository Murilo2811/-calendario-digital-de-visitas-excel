import React, { useState, useEffect } from 'react';
import { Service, ServiceStatus, Technician, Client } from '../types';
import { X, PlusCircle, Pencil } from 'lucide-react';
import { format } from 'date-fns/format';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: Omit<Service, 'id'>) => void;
  technicians: Technician[];
  clients: Client[];
  serviceToEdit?: Service | null;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  technicians, 
  clients,
  serviceToEdit 
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
    lastCalibration: ''
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
          technicianIds: serviceToEdit.technicianIds || []
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
    if (!formData.client || !formData.startDate || !formData.endDate || !formData.technicianIds || formData.technicianIds.length === 0) {
      alert('Preencha os campos obrigatórios (Cliente, Datas, pelo menos um Técnico).');
      return;
    }
    onSave(formData as Omit<Service, 'id'>);
  };

  const handleChange = (field: keyof Service, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTechnician = (techId: string) => {
    setFormData(prev => {
        const currentIds = prev.technicianIds || [];
        if (currentIds.includes(techId)) {
            return { ...prev, technicianIds: currentIds.filter(id => id !== techId) };
        } else {
            return { ...prev, technicianIds: [...currentIds, techId] };
        }
    });
  };

  const inputClass = "w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red/50 outline-none transition-colors";
  const labelClass = "block text-xs font-bold text-slate-600 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col ${serviceToEdit ? 'max-w-lg' : 'max-w-4xl'}`}>
        
        <div className="flex items-center justify-between p-5 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-abb-red/10 p-2 rounded-lg text-abb-red">
                {serviceToEdit ? <Pencil size={20} /> : <PlusCircle size={20} />}
            </div>
            <div>
                 <h2 className="text-lg font-bold text-slate-800">{serviceToEdit ? 'Editar Atividade' : 'Criar Nova Atividade'}</h2>
                 <p className="text-xs text-slate-500">Preencha os detalhes abaixo</p>
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
                  className={inputClass}
                  value={formData.client}
                  onChange={e => handleChange('client', e.target.value)}
                >
                   <option value="">Selecione...</option>
                   {clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                       <option key={c.id} value={c.name}>{c.name}</option>
                   ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>STATUS</label>
                <select 
                  className={inputClass}
                  value={formData.status}
                  onChange={e => handleChange('status', e.target.value as ServiceStatus)}
                >
                  {Object.values(ServiceStatus).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className={labelClass}>TÉCNICOS (Selecione múltiplos)</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {technicians.map(t => (
                        <label key={t.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                            <input 
                                type="checkbox"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>CLIENTE *</label>
                  <select 
                    required
                    className={inputClass}
                    value={formData.client}
                    onChange={e => handleChange('client', e.target.value)}
                  >
                     <option value="">Selecione...</option>
                     {clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                         <option key={c.id} value={c.name}>{c.name}</option>
                     ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>STATUS</label>
                  <select 
                    className={inputClass}
                    value={formData.status}
                    onChange={e => handleChange('status', e.target.value as ServiceStatus)}
                  >
                    {Object.values(ServiceStatus).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className={labelClass}>GERENTE</label>
                  <input 
                    type="text" 
                    className={inputClass}
                    value={formData.manager}
                    onChange={e => handleChange('manager', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>OS</label>
                  <input 
                    type="text" 
                    className={inputClass}
                    value={formData.os}
                    onChange={e => handleChange('os', e.target.value)}
                  />
                </div>
                 <div>
                  <label className={labelClass}>SEMANA</label>
                  <input 
                    type="number" 
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
                        <label key={t.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                            <input 
                                type="checkbox"
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
                    className={inputClass}
                    value={formData.endDate}
                    onChange={e => handleChange('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-amber-50/40 p-4 rounded-lg border border-amber-200">
                 <h3 className="text-xs font-bold text-amber-800 mb-3 uppercase tracking-wider">Dados de Calibração</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className={labelClass}>Última Calibração</label>
                        <input 
                            type="date" 
                            className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                            value={formData.lastCalibration || ''}
                            onChange={e => handleChange('lastCalibration', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Período (Meses)</label>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none"
                            value={formData.period}
                            onChange={e => handleChange('period', Number(e.target.value))}
                        />
                    </div>
                </div>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Métricas de Horas</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HP</label>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                            value={formData.hp}
                            onChange={e => handleChange('hp', Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HT</label>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                            value={formData.ht}
                            onChange={e => handleChange('ht', Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">HV</label>
                        <input 
                            type="number" 
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                            value={formData.hv}
                            onChange={e => handleChange('hv', Number(e.target.value))}
                        />
                    </div>
                </div>
              </div>
            </React.Fragment>
          )}


          <div className="flex items-center justify-end gap-4 pt-5 border-t border-slate-200">
            <button 
                type="button" 
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
                Cancelar
            </button>
            <button 
                type="submit" 
                className="px-6 py-2.5 text-sm font-bold text-white bg-abb-red hover:brightness-110 rounded-lg shadow-md shadow-abb-red/20 transition-all"
            >
                {serviceToEdit ? 'Salvar Alterações' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};