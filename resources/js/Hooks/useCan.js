import { usePage } from '@inertiajs/react';

/**
 * Hook para validar permisos asignados por el Superadmin.
 * Si el usuario es Superadmin, siempre retorna true.
 *
 * Uso:
 *   const can = useCan();
 *   if (can('compras.create')) { ... }
 */
export function useCan() {
  const { props } = usePage();
  const auth = props?.auth || {};
  const isSuperAdmin = auth.isSuperAdmin || auth.user?.role === 'Superadmin';
  const permissions = auth.permissions || auth.user?.permissions || [];

  return (permission) => {
    if (isSuperAdmin) return true;
    if (!permission) return false;
    return permissions.includes(permission);
  };
}

export default useCan;
