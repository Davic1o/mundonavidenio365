import React, { useEffect } from 'react';
import { useForm } from '@inertiajs/react';

export default function UsuarioForm({
  roles = [],
  initial = null,
  onSuccess,
  onCancel,
}) {
  const isEdit = Boolean(initial?.id);

  const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    role: initial?.role ?? (roles?.[0] ?? ''),
    password: '',
  });

  useEffect(() => {
    setData({
      name: initial?.name ?? '',
      email: initial?.email ?? '',
      role: initial?.role ?? (roles?.[0] ?? ''),
      password: '',
    });
    clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  function handleSubmit(e) {
    e.preventDefault();
    const opts = {
      preserveScroll: true,
      onSuccess: () => {
        reset('password');
        onSuccess?.();
      },
    };
    if (isEdit) {
      put(route('admin.usuarios.update', initial.id), opts);
    } else {
      post(route('admin.usuarios.store'), opts);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
        <input
          type="text"
          className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
          value={data.name}
          onChange={(e) => setData('name', e.target.value)}
          placeholder="Nombres y apellidos"
          autoFocus
        />
        {errors.name && <p className="mt-1 text-sm text-secondary-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
        <input
          type="email"
          className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
          value={data.email}
          onChange={(e) => setData('email', e.target.value)}
          placeholder="correo@dominio.com"
        />
        {errors.email && <p className="mt-1 text-sm text-secondary-600">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
        <select
          className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
          value={data.role}
          onChange={(e) => setData('role', e.target.value)}
        >
          {(roles ?? []).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {errors.role && <p className="mt-1 text-sm text-secondary-600">{errors.role}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Contraseña {isEdit && <span className="text-slate-400">(dejar vacío para no cambiar)</span>}
        </label>
        <input
          type="password"
          className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
          value={data.password}
          onChange={(e) => setData('password', e.target.value)}
          placeholder={isEdit ? 'Opcional' : 'Mínimo 8 caracteres'}
        />
        {errors.password && <p className="mt-1 text-sm text-secondary-600">{errors.password}</p>}
      </div>

      <div className="pt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={processing}
          className={[
            'px-3 py-2 rounded-md text-white',
            processing ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
          ].join(' ')}
        >
          {isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}
