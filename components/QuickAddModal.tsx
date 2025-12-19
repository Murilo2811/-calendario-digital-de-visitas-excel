import React, { useState } from 'react';
import { Client } from '../types';
import { X, Zap, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns/format';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { client: string; startDate: string; endDate: string }) => void;
  clients: Client[];
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  clients 
}) => {
  const [formData, setFormData] = useState({
    client: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client || !formData.startDate || !formData.endDate) return;
    onSave(formData);
    // Reset form after save (optional, but good for UX if reopening)
    setFormData({
      client: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    });
    onClose();
  };

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 outline-none transition-colors";
  const labelClass = "block text-[10px] font-bold text-slate-500 uppercase mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        <div className="flex items-center justify-between p-4 border-b bg-amber-50/50">
          <div className="flex items-center gap-2">
            <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600">
              <Zap size={18} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Adição Rápida</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div>
            <label className={labelClass}><Building2 size={12} className="inline mr-1"/> Cliente</label>
            <select 
              required
              autoFocus
              className={inputClass}
              value={formData.client}
              onChange={e => setFormData({...formData, client: e.target.value})}
            >
                <option value="">Selecione...</option>
                {clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}><Calendar size={12} className="inline mr-1"/> Início</label>
              <input 
                type="date" 
                required
                className={inputClass}
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div>
              <label className={labelClass}><Calendar size={12} className="inline mr-1"/> Fim</label>
              <input 
                type="date" 
                required
                className={inputClass}
                value={formData.endDate}
                onChange={e => setFormData({...formData, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
                type="submit" 
                className="w-full py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
                <Zap size={16} fill="currentColor" />
                Adicionar Atividade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};