import React, { useState } from 'react';
import { Client } from '../types';
import { X, Plus, Trash2, Building2, MapPin, Phone, Mail, FileText, User, Pencil, Check, Ban } from 'lucide-react';

interface ClientManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onAdd: (clientData: Omit<Client, 'id'>) => void;
  onUpdate: (id: string, clientData: Partial<Client>) => void;
  onDelete: (id: string) => void;
}

export const ClientManagerModal: React.FC<ClientManagerModalProps> = ({ 
  isOpen, 
  onClose, 
  clients, 
  onAdd, 
  onUpdate,
  onDelete 
}) => {
  const initialFormState = {
    name: '',
    corporateName: '',
    cnpj: '',
    city: '',
    state: '',
    contactName: '',
    email: '',
    phone: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
        onUpdate(editingId, formData);
        setEditingId(null);
    } else {
        onAdd({ ...formData, name: formData.name.trim() });
    }
    setFormData(initialFormState);
  };

  const handleEditClick = (client: Client) => {
      setEditingId(client.id);
      setFormData({
          name: client.name,
          corporateName: client.corporateName || '',
          cnpj: client.cnpj || '',
          city: client.city || '',
          state: client.state || '',
          contactName: client.contactName || '',
          email: client.email || '',
          phone: client.phone || ''
      });
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setFormData(initialFormState);
  };

  const handleChange = (field: string, value: string) => {
      setFormData(prev => ({...prev, [field]: value}));
  };
  
  const labelClass = "text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1.5";
  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-abb-red/50 focus:border-abb-red/50 outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${editingId ? 'bg-amber-100 text-amber-600' : 'bg-abb-red/10 text-abb-red'}`}>
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Editar Cliente' : 'Gerenciar Clientes'}</h2>
              <p className="text-xs text-slate-500">{editingId ? 'Atualize os dados abaixo' : 'Adicione ou edite clientes da carteira'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-6">
          
          <form onSubmit={handleSubmit} className={`p-5 rounded-lg border transition-all ${editingId ? 'bg-amber-50/40 border-amber-200' : 'bg-slate-50/70 border-slate-200'} space-y-4`}>
             <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${editingId ? 'text-amber-700' : 'text-slate-600'}`}>
                    {editingId ? <Pencil size={12} /> : <Plus size={12} />} 
                    {editingId ? 'Editando Dados do Cliente' : 'Adicionar Novo Cliente'}
                </h3>
                {editingId && (
                    <button 
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-abb-red uppercase font-bold"
                    >
                        <Ban size={12} /> Cancelar Edição
                    </button>
                )}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className={labelClass}><Building2 size={12}/> Nome Fantasia *</label>
                    <input type="text" required placeholder="Ex: Petrobras" className={inputClass} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
                 </div>
                 <div>
                    <label className={labelClass}><FileText size={12}/> Razão Social</label>
                    <input type="text" placeholder="Ex: Petroleo Brasileiro S.A." className={inputClass} value={formData.corporateName} onChange={(e) => handleChange('corporateName', e.target.value)} />
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                 <div className="md:col-span-2">
                    <label className={labelClass}>CNPJ</label>
                    <input type="text" placeholder="00.000.000/0001-00" className={inputClass} value={formData.cnpj} onChange={(e) => handleChange('cnpj', e.target.value)} />
                 </div>
                 <div className="md:col-span-3">
                    <label className={labelClass}><MapPin size={12}/> Cidade</label>
                    <input type="text" placeholder="Ex: Macaé" className={inputClass} value={formData.city} onChange={(e) => handleChange('city', e.target.value)} />
                 </div>
                 <div className="md:col-span-1">
                    <label className={labelClass}>UF</label>
                    <input type="text" placeholder="RJ" maxLength={2} className={`${inputClass} uppercase`} value={formData.state} onChange={(e) => handleChange('state', e.target.value)} />
                 </div>
             </div>

             <hr className="border-slate-200/80 dashed my-4" />

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <label className={labelClass}><User size={12}/> Contato Principal</label>
                    <input type="text" placeholder="Nome do contato" className={inputClass} value={formData.contactName} onChange={(e) => handleChange('contactName', e.target.value)} />
                 </div>
                 <div>
                    <label className={labelClass}><Mail size={12}/> E-mail</label>
                    <input type="email" placeholder="contato@empresa.com" className={inputClass} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                 </div>
                 <div>
                    <label className={labelClass}><Phone size={12}/> Telefone</label>
                    <input type="tel" placeholder="(00) 00000-0000" className={inputClass} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                 </div>
             </div>

             <button 
                type="submit"
                className={`w-full font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all shadow-md mt-3 text-white ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-abb-red hover:brightness-110 shadow-abb-red/20'}`}
             >
                {editingId ? <Check size={16} /> : <Plus size={16} />} 
                {editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
             </button>
          </form>

          <div className="flex-grow">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Carteira de Clientes ({clients.length})</h3>
            <div className="space-y-2 overflow-y-auto pr-2 -mr-2 max-h-[300px]">
                {clients.sort((a,b) => a.name.localeCompare(b.name)).map(client => (
                    <div 
                        key={client.id} 
                        className={`bg-white border p-3 rounded-lg hover:border-slate-300 transition-all group flex justify-between items-center ${editingId === client.id ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/30' : 'border-slate-200'}`}
                    >
                        <div className="flex items-center gap-4 flex-grow">
                            <div className="w-9 h-9 mt-1 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-abb-red/10 group-hover:text-abb-red transition-colors flex-shrink-0">
                                <Building2 size={18} />
                            </div>
                            <div className="flex-grow">
                                <div className="text-sm font-bold text-slate-800">{client.name}</div>
                                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                    {client.city && client.state && <span className="flex items-center gap-1.5"><MapPin size={12} /> {`${client.city}, ${client.state}`}</span>}
                                    {client.contactName && <span className="flex items-center gap-1.5"><User size={12} /> {client.contactName}</span>}
                                    {client.phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {client.phone}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                                onClick={() => handleEditClick(client)}
                                className="text-slate-400 hover:text-amber-500 p-2 hover:bg-amber-500/10 rounded-full transition-colors"
                                title="Editar Cliente"
                            >
                                <Pencil size={16} />
                            </button>
                            <button 
                                onClick={() => onDelete(client.id)}
                                className="text-slate-400 hover:text-abb-red p-2 hover:bg-abb-red/10 rounded-full transition-colors"
                                title="Remover Cliente"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};