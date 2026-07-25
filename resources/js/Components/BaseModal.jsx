import React from 'react';
import Modal from '@/Components/Modal';

/**
 * Modal reutilizable.
 * Props:
 *  - open: boolean => controlar si se muestra
 *  - onClose: function => callback al cerrar
 *  - title: string => título en la cabecera
 *  - children: contenido del modal (form, texto, etc.)
 *  - maxWidth: ancho máximo (sm, md, lg, xl, 2xl)
 */
export default function BaseModal({ open, onClose, title, children, maxWidth = 'md' }) {
  return (
    <Modal show={open} onClose={onClose} maxWidth={maxWidth}>
      <div className="p-4 sm:p-6">
        {title && (
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            {title}
          </h3>
        )}

        <div className="space-y-4">
          {children}
        </div>
      </div>
    </Modal>
  );
}
