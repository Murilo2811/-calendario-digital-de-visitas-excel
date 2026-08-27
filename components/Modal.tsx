import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Casca compartilhada dos modais, sobre o <dialog> nativo.
 * O navegador entrega backdrop, fechar com ESC e foco preso no diálogo — nada disso é código nosso.
 * O conteúdo continua sendo o mesmo card branco de antes; aqui só entra o overlay.
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // showModal() é o que coloca o diálogo na top layer e ativa ESC + foco preso
    if (isOpen) ref.current?.showModal();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-0 p-0 w-full max-w-full h-full max-h-full bg-transparent overflow-visible backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-center min-h-full p-4">
        {children}
      </div>
    </dialog>
  );
};
