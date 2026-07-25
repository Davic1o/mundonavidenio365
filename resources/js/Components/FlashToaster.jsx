import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';
import { usePage } from '@inertiajs/react';

const VARIANTS = {
  success: {
    bg: 'bg-primary-600',
    ring: 'ring-primary-300',
    icon: <FiCheckCircle className="w-5 h-5" />,
    title: 'Éxito',
  },
  error: {
    bg: 'bg-secondary-600',
    ring: 'ring-secondary-300',
    icon: <FiAlertTriangle className="w-5 h-5" />,
    title: 'Error',
  },
  info: {
    bg: 'bg-slate-700',
    ring: 'ring-slate-300',
    icon: <FiInfo className="w-5 h-5" />,
    title: 'Información',
  },
};

export default function FlashToaster({ timeout = 4500 }) {
  const { props } = usePage();
  // Inertia evalúa las Lazy Props del backend; aquí ya llegan como string | null
  const { success, error, info } = props?.flash ?? {};

  const initial = useMemo(() => {
    if (success) return { type: 'success', message: success };
    if (error)   return { type: 'error', message: error };
    if (info)    return { type: 'info', message: info };
    return null;
  }, [success, error, info]);

  const [toast, setToast] = useState(initial);
  const [show, setShow] = useState(Boolean(initial));

  // Cuando cambie el flash del servidor, actualizar/mostrar
  useEffect(() => {
    setToast(initial);
    setShow(Boolean(initial));
  }, [initial?.type, initial?.message]);

  // Auto-close
  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(false), timeout);
    return () => clearTimeout(id);
  }, [show, timeout]);

  if (!toast) return null;
  const v = VARIANTS[toast.type] ?? VARIANTS.info;

  return (
    <div
      className={[
        'fixed top-16 right-4 z-[60] transition-all duration-300',
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className={[
        'w-[92vw] max-w-md text-white shadow-xl rounded-xl ring-1 flex gap-3 items-start p-3',
        v.bg, v.ring
      ].join(' ')}>
        <div className="mt-0.5">{v.icon}</div>
        <div className="flex-1">
          <div className="font-semibold leading-tight">{v.title}</div>
          <div className="text-sm opacity-95">{toast.message}</div>
        </div>
        <button
          onClick={() => setShow(false)}
          className="p-1 rounded-lg hover:bg-white/10 transition"
          aria-label="Cerrar notificación"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
