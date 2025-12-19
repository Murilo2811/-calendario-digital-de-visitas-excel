import React, { useState } from 'react';
import { Technician, TechType } from '../types';
import { X, UserPlus, Trash2, Users, Shield, Briefcase } from 'lucide-react';

interface TechManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicians: Technician[];
  onAdd: (tech: Technician) => void;
  onDelete: (id: string) => void;
}

export const TechManagerModal: React.FC<TechManagerModalProps> = ({ 
  isOpen, 
  onClose, 
  technicians, 
  onAdd, 
  onDelete 
}) => {
  const [newTech, setNewTech] = useState({
    name: '',
    fullName: '',
    type: TechType.INTERNAL
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTech.name || !newTech.fullName) return;

    const techToAdd: Technician = {
      id: `tech-${Date.now()}`,
      name: newTech.name.toUpperCase().substring(0, 4),
      fullName: newTech.fullName,
      type: newTech.type,
      color: newTech.type === TechType.PJ ? 'bg-amber-100' : 'bg-red-100'
    };

    onAdd(techToAdd);
    setNewTech({ name: '', fullName: '', type: TechType.INTERNAL });
  };
  
  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red/50 outline-none transition-colors";
  const labelClass = "block text-xs font-bold text-slate-500 mb-1.5";


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-abb-red/10 p-2 rounded-lg text-abb-red">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Gerenciar Equipe</h2>
              <p className="text-xs text-slate-500">Adicione ou remova técnicos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow space-y-6">
          
          <form onSubmit={handleSubmit} className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-4">
             <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Novo Técnico</h3>
             
             <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                    <label className={labelClass}>Sigla</label>
                    <input 
                        type="text" 
                        placeholder="EX"
                        maxLength={4}
                        className={`${inputClass} uppercase`}
                        value={newTech.name}
                        onChange={(e) => setNewTech({...newTech, name: e.target.value})}
                        required
                    />
                </div>
                <div className="col-span-3">
                    <label className={labelClass}>Nome Completo</label>
                    <input 
                        type="text" 
                        placeholder="Ex: Eduardo Silva"
                        className={inputClass}
                        value={newTech.fullName}
                        onChange={(e) => setNewTech({...newTech, fullName: e.target.value})}
                        required
                    />
                </div>
             </div>

             <div>
                <label className={labelClass}>Tipo de Contrato</label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg has-[:checked]:bg-abb-red/10 has-[:checked]:text-abb-red transition-colors">
                        <input 
                            type="radio" 
                            name="techType" 
                            value={TechType.INTERNAL}
                            checked={newTech.type === TechType.INTERNAL}
                            onChange={() => setNewTech({...newTech, type: TechType.INTERNAL})}
                            className="text-abb-red focus:ring-abb-red/50"
                        />
                        <span className="flex items-center gap-1.5 font-medium"><Shield size={14} /> Interno</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg has-[:checked]:bg-amber-400/10 has-[:checked]:text-amber-600 transition-colors">
                        <input 
                            type="radio" 
                            name="techType" 
                            value={TechType.PJ}
                            checked={newTech.type === TechType.PJ}
                            onChange={() => setNewTech({...newTech, type: TechType.PJ})}
                            className="text-amber-500 focus:ring-amber-500/50"
                        />
                        <span className="flex items-center gap-1.5 font-medium"><Briefcase size={14}/> PJ / Terceiro</span>
                    </label>
                </div>
             </div>

             <button 
                type="submit"
                className="w-full bg-abb-red hover:brightness-110 text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-abb-red/20"
             >
                <UserPlus size={16} /> Cadastrar Técnico
             </button>
          </form>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Membros Atuais ({technicians.length})</h3>
            <div className="space-y-2">
                {technicians.map(tech => (
                    <div key={tech.id} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg hover:border-slate-300 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${tech.type === TechType.PJ ? 'bg-amber-100 text-amber-800' : 'bg-abb-red/10 text-abb-red'}`}>
                                {tech.name}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-800">{tech.fullName}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    {tech.type === TechType.PJ ? 'PJ / Terceiro' : 'Interno'}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => onDelete(tech.id)}
                            className="text-slate-400 hover:text-abb-red p-2 hover:bg-abb-red/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover Técnico"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};