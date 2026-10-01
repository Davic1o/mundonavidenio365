import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
  FiShield,
  FiCheck,
  FiX,
  FiRotateCcw,
  FiBox,
  FiUsers,
  FiTrendingUp,
  FiFileText,
  FiTag,
  FiSettings,
  FiBarChart2,
  FiSearch,
  FiAlertCircle,
  FiSave,
  FiLock,
  FiCheckCircle,
} from 'react-icons/fi';

// Mapa de iconos por nombre
const ICON_MAP = {
  FiBox: FiBox,
  FiUsers: FiUsers,
  FiTrendingUp: FiTrendingUp,
  FiFileText: FiFileText,
  FiTag: FiTag,
  FiSettings: FiSettings,
  FiBarChart2: FiBarChart2,
};

// Colores e insignias por rol
const ROLE_THEMES = {
  'Admin General': {
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    tabActive: 'bg-indigo-600 text-white shadow-md shadow-indigo-100',
    accentBorder: 'border-l-indigo-500',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
    iconColor: 'text-indigo-600',
  },
  'Administrador': {
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    tabActive: 'bg-emerald-600 text-white shadow-md shadow-emerald-100',
    accentBorder: 'border-l-emerald-500',
    btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
    iconColor: 'text-emerald-600',
  },
  'Ventas': {
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
    tabActive: 'bg-amber-600 text-white shadow-md shadow-amber-100',
    accentBorder: 'border-l-amber-500',
    btnPrimary: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    iconColor: 'text-amber-600',
  },
};

export default function RolesPermisosIndex({
  modules = {},
  roles = [],
  rolePermissions = {},
  allPermissionKeys = [],
}) {
  const [selectedRole, setSelectedRole] = useState(roles[0] || 'Admin General');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado local editable de permisos para cada rol
  const [localPermissions, setLocalPermissions] = useState(() => {
    const initial = {};
    roles.forEach((r) => {
      initial[r] = [...(rolePermissions[r] || [])];
    });
    return initial;
  });

  const currentRolePerms = localPermissions[selectedRole] || [];
  const initialRolePerms = rolePermissions[selectedRole] || [];

  // Detectar si hay cambios sin guardar en el rol seleccionado
  const hasChanges = useMemo(() => {
    if (currentRolePerms.length !== initialRolePerms.length) return true;
    const s1 = new Set(currentRolePerms);
    return initialRolePerms.some((p) => !s1.has(p));
  }, [currentRolePerms, initialRolePerms]);

  const theme = ROLE_THEMES[selectedRole] || ROLE_THEMES['Administrador'];

  // Toggle de un permiso individual
  const togglePermission = (key) => {
    setLocalPermissions((prev) => {
      const perms = prev[selectedRole] || [];
      const next = perms.includes(key)
        ? perms.filter((k) => k !== key)
        : [...perms, key];
      return { ...prev, [selectedRole]: next };
    });
  };

  // Toggle para habilitar/deshabilitar todas las acciones de un módulo
  const toggleAllModule = (moduleData, enable) => {
    const modKeys = moduleData.permissions.map((p) => p.key);
    setLocalPermissions((prev) => {
      const perms = prev[selectedRole] || [];
      let next;
      if (enable) {
        next = Array.from(new Set([...perms, ...modKeys]));
      } else {
        next = perms.filter((k) => !modKeys.includes(k));
      }
      return { ...prev, [selectedRole]: next };
    });
  };

  // Habilitar todo para este rol
  const handleEnableAll = () => {
    setLocalPermissions((prev) => ({
      ...prev,
      [selectedRole]: [...allPermissionKeys],
    }));
  };

  // Deshabilitar todo para este rol
  const handleDisableAll = () => {
    setLocalPermissions((prev) => ({
      ...prev,
      [selectedRole]: [],
    }));
  };

  // Descartar cambios locales
  const handleDiscardChanges = () => {
    setLocalPermissions((prev) => ({
      ...prev,
      [selectedRole]: [...(rolePermissions[selectedRole] || [])],
    }));
  };

  // Guardar permisos en el backend
  const handleSave = () => {
    if (saving) return;
    setSaving(true);

    router.post(
      route('admin.roles_permisos.update'),
      {
        role: selectedRole,
        permissions: currentRolePerms,
      },
      {
        preserveScroll: true,
        onFinish: () => setSaving(false),
      }
    );
  };

  // Restablecer a valores por defecto
  const handleResetDefaults = () => {
    if (
      !confirm(
        `¿Estás seguro de restablecer los permisos predeterminados para el rol "${selectedRole}"?`
      )
    ) {
      return;
    }

    setSaving(true);
    router.post(
      route('admin.roles_permisos.reset'),
      { role: selectedRole },
      {
        preserveScroll: true,
        onFinish: () => setSaving(false),
      }
    );
  };

  // Filtrado de módulos por búsqueda
  const filteredModules = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return Object.entries(modules);

    return Object.entries(modules).filter(([modKey, mod]) => {
      const matchMod =
        mod.title.toLowerCase().includes(term) ||
        mod.description.toLowerCase().includes(term);
      const matchPerms = mod.permissions.some(
        (p) =>
          p.label.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.key.toLowerCase().includes(term)
      );
      return matchMod || matchPerms;
    });
  }, [modules, searchTerm]);

  return (
    <AdminLayout>
      <Head title="Roles y Permisos | Superadmin" />

      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
              <FiShield className="w-3.5 h-3.5" />
              Panel Exclusivo de Superadmin
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Control de Roles y Permisos
            </h1>
            <p className="text-sm text-slate-500">
              Define con precisión qué vistas puede ver y qué acciones puede ejecutar cada rol del sistema.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetDefaults}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
              title="Restablecer permisos recomendados para este rol"
            >
              <FiRotateCcw className="w-3.5 h-3.5" />
              Restablecer Valores
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition shadow-sm ${
                hasChanges
                  ? `${theme.btnPrimary} ring-2 ring-offset-2 ring-slate-400`
                  : 'bg-slate-400 cursor-not-allowed opacity-75'
              }`}
            >
              <FiSave className="w-4 h-4" />
              {saving ? 'Guardando...' : hasChanges ? 'Guardar Cambios' : 'Sin cambios'}
            </button>
          </div>
        </div>

        {/* Tarjeta explicativa de Superadmin */}
        <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-white p-4.5 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-purple-600 text-white shadow-md shadow-purple-200">
              <FiLock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-purple-950 flex items-center gap-2">
                <span>Jerarquía de Seguridad del Sistema</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-200 text-purple-900">
                  Superadmin: Acceso Ilimitado
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-purple-900/80 leading-relaxed">
                El rol <strong className="font-semibold text-purple-950">Superadmin</strong> posee por diseño acceso total e inmutable a todas las vistas, acciones y configuraciones tributarias. A continuación puedes seleccionar cada uno de los demás roles para personalizar individualmente sus accesos a cada pantalla y botón.
              </p>
            </div>
          </div>
        </div>

        {/* Pestañas de Selección de Rol */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => {
              const isActive = selectedRole === r;
              const rTheme = ROLE_THEMES[r] || ROLE_THEMES['Administrador'];
              const activeCount = (localPermissions[r] || []).length;

              return (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? rTheme.tabActive
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{r}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {activeCount} / {allPermissionKeys.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Buscador de módulos */}
          <div className="relative w-full sm:w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar vista o acción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Barra de utilidades del rol activo */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <span>Configurando permisos para:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold border ${theme.badgeBg}`}>
              {selectedRole}
            </span>
            {hasChanges && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                <FiAlertCircle className="w-3.5 h-3.5" />
                Tienes cambios sin guardar
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEnableAll}
              className="text-xs font-medium text-slate-700 hover:text-indigo-600 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 transition"
            >
              Habilitar todos
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={handleDisableAll}
              className="text-xs font-medium text-slate-700 hover:text-red-600 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-slate-300 transition"
            >
              Deshabilitar todos
            </button>
          </div>
        </div>

        {/* Cuadrícula de Módulos y Vistas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredModules.map(([modKey, mod]) => {
            const Icon = ICON_MAP[mod.icon] || FiBox;
            const viewPerm = mod.permissions.find((p) => p.is_view);
            const actionPerms = mod.permissions.filter((p) => !p.is_view);

            const isViewEnabled = viewPerm ? currentRolePerms.includes(viewPerm.key) : false;
            const activeActionCount = actionPerms.filter((p) =>
              currentRolePerms.includes(p.key)
            ).length;
            const allActive =
              mod.permissions.every((p) => currentRolePerms.includes(p.key));

            return (
              <div
                key={modKey}
                className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md ${
                  isViewEnabled ? 'border-slate-300' : 'opacity-75 bg-slate-50/50'
                }`}
              >
                {/* Cabecera del Módulo */}
                <div className="p-4 sm:p-5 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isViewEnabled ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                          {mod.title}
                          {isViewEnabled ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Vista Activa
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Oculto para este rol
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                      </div>
                    </div>

                    {/* Botón rápido todo/nada por módulo */}
                    <button
                      onClick={() => toggleAllModule(mod, !allActive)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 shrink-0"
                    >
                      {allActive ? 'Desmarcar todo' : 'Marcar todo'}
                    </button>
                  </div>

                  {/* Interruptor Principal: Ver la Vista */}
                  {viewPerm && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <label
                          htmlFor={`perm-${viewPerm.key}`}
                          className="text-xs font-semibold text-slate-900 cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="w-2 h-2 rounded-full bg-primary-600 inline-block"></span>
                          {viewPerm.label}
                        </label>
                        <p className="text-[11px] text-slate-500">{viewPerm.description}</p>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        id={`perm-${viewPerm.key}`}
                        type="button"
                        role="switch"
                        aria-checked={isViewEnabled}
                        onClick={() => togglePermission(viewPerm.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          isViewEnabled ? 'bg-primary-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isViewEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Acciones del Módulo */}
                {actionPerms.length > 0 && (
                  <div className="p-4 sm:p-5 bg-slate-50/50 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Acciones y Facultades ({activeActionCount}/{actionPerms.length})
                    </div>

                    {!isViewEnabled && (
                      <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200/60 flex items-center gap-2">
                        <FiAlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Al desactivar la vista, este rol no podrá ingresar a la pantalla ni ejecutar estas acciones.
                        </span>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {actionPerms.map((perm) => {
                        const isChecked = currentRolePerms.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                              isChecked
                                ? 'bg-white border-primary-200 shadow-xs'
                                : 'bg-white/60 border-slate-200 hover:bg-white'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <span
                                className={`text-xs font-semibold ${
                                  isChecked ? 'text-slate-900' : 'text-slate-600'
                                }`}
                              >
                                {perm.label}
                              </span>
                              <p className="text-[11px] text-slate-500 leading-tight">
                                {perm.description}
                              </p>
                            </div>

                            {/* Checkbox estilizado */}
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                isChecked
                                  ? 'bg-primary-600 border-primary-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isChecked && <FiCheck className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra flotante inferior cuando hay cambios sin guardar */}
        {hasChanges && (
          <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-auto z-40 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200 border border-slate-700">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Cambios pendientes en <strong>{selectedRole}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardChanges}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg transition ${theme.btnPrimary} shadow-md`}
              >
                <FiCheckCircle className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Ahora'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
