import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Save, LogOut, X, Loader2 } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndExit: () => void;
  onExitWithoutSaving: () => void;
  isSaving?: boolean;
  title?: string;
  description?: string;
  actionType?: 'logout' | 'disconnect';
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onSaveAndExit,
  onExitWithoutSaving,
  isSaving = false,
  title = 'Alterações Não Salvas',
  description = 'Você possui dados ou alterações que ainda não foram salvas no arquivo Excel ou na Rede.',
  actionType = 'logout'
}) => {
  return (
    <Modal isOpen={isOpen} onClose={isSaving ? () => {} : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} />
          </div>

          <div className="flex-grow">
            <h3 className="text-lg font-bold text-slate-900 leading-snug">
              {title}
            </h3>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              {description}
            </p>
            <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-3">
              ⚠️ Se sair sem salvar, as modificações feitas desde o último salvamento serão perdidas.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          {/* Botão Salvar e Sair */}
          <button
            type="button"
            onClick={onSaveAndExit}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Salvando alterações...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{actionType === 'disconnect' ? 'Salvar e Desconectar' : 'Salvar e Sair'}</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {/* Botão Cancelar */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2 px-3 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Continuar editando
            </button>

            {/* Botão Sair sem Salvar */}
            <button
              type="button"
              onClick={onExitWithoutSaving}
              disabled={isSaving}
              className="flex-1 py-2 px-3 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <LogOut size={13} />
              <span>{actionType === 'disconnect' ? 'Desconectar sem Salvar' : 'Sair sem Salvar'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
