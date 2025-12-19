import React from 'react';
import { X, HelpCircle, FileSpreadsheet, LayoutGrid, CalendarDays, MousePointerClick } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="bg-abb-red/10 p-2 rounded-lg text-abb-red">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Ajuda & Instruções</h2>
              <p className="text-xs text-slate-500">Guia de uso e formatação de dados</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow space-y-8">
          
          {/* Section 1: Navigation */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                <MousePointerClick size={16} className="text-abb-red" />
                Navegação Básica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2 font-bold text-slate-800 text-sm">
                        <LayoutGrid size={16} className="text-slate-500"/> Modo Grid
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Visualização tabular ideal para edição rápida. Clique em qualquer célula para editar o valor diretamente. Use o botão <strong>Agrupar</strong> para ordenar por status.
                    </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-2 font-bold text-slate-800 text-sm">
                        <CalendarDays size={16} className="text-slate-500"/> Modo Cronograma
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Visualização Gantt para gestão de recursos. Arraste e solte atividades para mudar datas ou técnicos. Clique em uma barra para editar detalhes.
                    </p>
                </div>
            </div>
          </section>

        </div>
        
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors text-sm">
                Entendi
            </button>
        </div>
      </div>
    </div>
  );
};