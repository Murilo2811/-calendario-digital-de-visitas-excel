import React from 'react';
import { X, Save, Unplug, Ban } from 'lucide-react';

interface ConfirmDisconnectModalProps {
    isOpen: boolean;
    fileName: string;
    onSaveAndDisconnect: () => void;
    onDisconnectWithoutSave: () => void;
    onCancel: () => void;
    isSaving?: boolean;
}

export const ConfirmDisconnectModal: React.FC<ConfirmDisconnectModalProps> = ({
    isOpen,
    fileName,
    onSaveAndDisconnect,
    onDisconnectWithoutSave,
    onCancel,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Unplug size={20} className="text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Desconectar do Excel</h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-slate-600 mb-2">
                        Você está prestes a desconectar do arquivo:
                    </p>
                    <p className="font-semibold text-slate-800 bg-slate-100 px-3 py-2 rounded-lg mb-4 truncate" title={fileName}>
                        📄 {fileName}
                    </p>
                    <p className="text-slate-600 text-sm">
                        Deseja salvar as alterações feitas antes de desconectar?
                    </p>
                </div>

                {/* Actions */}
                <div className="bg-slate-50 px-6 py-4 flex flex-col gap-2">
                    <button
                        onClick={onSaveAndDisconnect}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} />
                        {isSaving ? 'Salvando...' : 'Salvar e Desconectar'}
                    </button>

                    <button
                        onClick={onDisconnectWithoutSave}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                        <Unplug size={18} />
                        Desconectar sem Salvar
                    </button>

                    <button
                        onClick={onCancel}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition-all disabled:opacity-50"
                    >
                        <Ban size={18} />
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
