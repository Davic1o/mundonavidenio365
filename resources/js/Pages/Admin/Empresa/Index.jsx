import React, { useRef } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import useCan from '@/Hooks/useCan';
import { FiSave, FiRefreshCw } from 'react-icons/fi';
import SearchableSelect from '@/Components/SearchableSelect';

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm text-secondary-600">{msg}</p>;
}

// helper: convierte File -> base64 (solo datos, sin encabezado)
function fileToBase64(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    cb(base64);
  };
  reader.onerror = () => cb('');
  reader.readAsDataURL(file);
}

export default function EmpresaIndex({ empresa }) {
  const can = useCan();
  const canEdit = can('empresa.edit');
  const isEdit = Boolean(empresa?.id);
  const fileRef = useRef(null);

  const form = useForm({
    nombre_comercial: empresa?.nombre_comercial ?? '',
    razon_social: empresa?.razon_social ?? '',
    obligado_a_llevar_contabilidad: Boolean(
      empresa?.obligado_a_llevar_contabilidad ?? false
    ),
    tipo_contribuyente: empresa?.tipo_contribuyente ?? '',
    regimen: empresa?.regimen ?? '',
    direccion: empresa?.direccion ?? '',
    telefono: empresa?.telefono ?? '',
    correo: empresa?.correo ?? '',
    ruc: empresa?.ruc ?? '',
    ambiente: empresa?.ambiente ?? 1,
    establecimiento: empresa?.establecimiento ?? '001',
    punto_emision: empresa?.punto_emision ?? '001',
    secuencial_factura: empresa?.secuencial_factura ?? '000000001',
    secuencial_nota_credito: empresa?.secuencial_nota_credito ?? '000000001',
    clave_firma_electronica: '',
    // Envío por base64 (preferido)
    firma_b64: '',
    firma_nombre: '',
    // Campo File desactivado (no lo enviaremos)
    firma: null,
  });

  const { data, setData, post, processing, errors, reset } = form;

  // Helper para rellenar con ceros a la izquierda
  function padLeft(val, length) {
    return String(val).replace(/\D/g, '').padStart(length, '0').slice(-length);
  }

  function normalizarCamposNumericos() {
    setData((prev) => ({
      ...prev,
      establecimiento: padLeft(prev.establecimiento, 3),
      punto_emision: padLeft(prev.punto_emision, 3),
      secuencial_factura: padLeft(prev.secuencial_factura, 9),
      secuencial_nota_credito: padLeft(prev.secuencial_nota_credito, 9),
    }));
  }

  function onSubmit(e) {
    e.preventDefault();
    // Normalizar campos numéricos con ceros a la izquierda antes de enviar
    const estab  = padLeft(data.establecimiento, 3);
    const pto    = padLeft(data.punto_emision, 3);
    const secFc  = padLeft(data.secuencial_factura, 9);
    const secNC  = padLeft(data.secuencial_nota_credito, 9);
    const oblCon = data.obligado_a_llevar_contabilidad ? 1 : 0;

    // Actualizar el estado para que el form refleje los valores normalizados
    form.setData((prev) => ({
      ...prev,
      establecimiento: estab,
      punto_emision: pto,
      secuencial_factura: secFc,
      secuencial_nota_credito: secNC,
    }));

    // Usamos transform para inyectar los valores correctos justo al enviar
    form.transform((d) => ({
      ...d,
      establecimiento: padLeft(d.establecimiento, 3),
      punto_emision: padLeft(d.punto_emision, 3),
      secuencial_factura: padLeft(d.secuencial_factura, 9),
      secuencial_nota_credito: padLeft(d.secuencial_nota_credito, 9),
      obligado_a_llevar_contabilidad: d.obligado_a_llevar_contabilidad ? 1 : 0,
    }));

    post(route('admin.empresa.store'), {
      preserveScroll: true,
      onSuccess: () => {
        setData('clave_firma_electronica', '');
        setData('firma_b64', '');
        setData('firma_nombre', '');
        setData('firma', null);
        if (fileRef.current) fileRef.current.value = '';
      },
    });
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) {
      setData('firma', null);
      setData('firma_b64', '');
      setData('firma_nombre', '');
      return;
    }
    // Convertimos a base64 y NO enviamos el File
    fileToBase64(f, (b64) => {
      setData('firma_b64', b64);
      setData('firma_nombre', f.name);
      setData('firma', null); // evitamos enviar binario
    });
  }

  function restoreForm() {
    reset();
    setData({
      nombre_comercial: empresa?.nombre_comercial ?? '',
      razon_social: empresa?.razon_social ?? '',
      obligado_a_llevar_contabilidad: Boolean(
        empresa?.obligado_a_llevar_contabilidad ?? false
      ),
      tipo_contribuyente: empresa?.tipo_contribuyente ?? '',
      regimen: empresa?.regimen ?? '',
      direccion: empresa?.direccion ?? '',
      telefono: empresa?.telefono ?? '',
      correo: empresa?.correo ?? '',
      ruc: empresa?.ruc ?? '',
      ambiente: empresa?.ambiente ?? 1,
      establecimiento: empresa?.establecimiento ?? '001',
      punto_emision: empresa?.punto_emision ?? '001',
      secuencial_factura: empresa?.secuencial_factura ?? '000000001',
      secuencial_nota_credito: empresa?.secuencial_nota_credito ?? '000000001',
      clave_firma_electronica: '',
      firma_b64: '',
      firma_nombre: '',
      firma: null,
    });
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <AdminLayout title="Empresa">
      <Head title="Empresa" />

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">
          {isEdit ? 'Editar empresa' : 'Registrar empresa'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={restoreForm}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw className="w-4 h-4" />
            Restablecer
          </button>
          <button
            type="submit"
            form="empresa-form"
            disabled={processing}
            className={[
              'inline-flex items-center gap-2 px-3 py-2 rounded-md text-white',
              processing
                ? 'bg-primary-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700',
            ].join(' ')}
          >
            <FiSave className="w-4 h-4" />
            {isEdit ? 'Guardar cambios' : 'Crear empresa'}
          </button>
        </div>
      </div>

      <form
        id="empresa-form"
        onSubmit={onSubmit}
        className="space-y-6"
        // encType ya no es necesario, pero no estorba
      >
        {/* Identificación */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="p-4 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Identificación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre comercial
                </label>
                <input
                  type="text"
                  value={data.nombre_comercial}
                  onChange={(e) => setData('nombre_comercial', e.target.value.toUpperCase())}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Ej. Sistema de Facturación"
                  autoFocus
                />
                <FieldError msg={errors.nombre_comercial} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Razón social
                </label>
                <input
                  type="text"
                  value={data.razon_social}
                  onChange={(e) => setData('razon_social', e.target.value.toUpperCase())}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Razón social legal"
                />
                <FieldError msg={errors.razon_social} />
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.obligado_a_llevar_contabilidad}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setData((prev) => ({
                        ...prev,
                        obligado_a_llevar_contabilidad: checked,
                        tipo_contribuyente: (!checked && prev.tipo_contribuyente === 'Contribuyente Especial') ? '' : prev.tipo_contribuyente
                      }));
                    }}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Obligado a llevar contabilidad
                </label>
                <FieldError msg={errors.obligado_a_llevar_contabilidad} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de contribuyente
                </label>
                <SearchableSelect
                  options={
                    data.obligado_a_llevar_contabilidad
                      ? ['RIMPE', 'Régimen General', 'Contribuyente Especial']
                      : ['RIMPE', 'Régimen General']
                  }
                  value={data.tipo_contribuyente}
                  onChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      tipo_contribuyente: val,
                      regimen: val === 'RIMPE' ? '' : 'General'
                    }));
                  }}
                  placeholder="Selecciona tipo"
                />
                <FieldError msg={errors.tipo_contribuyente} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Régimen
                </label>
                <SearchableSelect
                  options={
                    data.tipo_contribuyente === 'RIMPE'
                      ? ['RIMPE Emprendedor', 'RIMPE Negocios Populares']
                      : ['General']
                  }
                  value={data.regimen}
                  onChange={(val) => setData('regimen', val)}
                  placeholder={data.tipo_contribuyente ? "Selecciona régimen" : "Selecciona primero tipo"}
                  disabled={!data.tipo_contribuyente}
                />
                <FieldError msg={errors.regimen} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ambiente de facturación
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ambiente"
                      value={1}
                      checked={Number(data.ambiente) === 1}
                      onChange={() => setData('ambiente', 1)}
                      className="rounded-full border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-slate-700 font-medium">1 - Pruebas</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="ambiente"
                      value={2}
                      checked={Number(data.ambiente) === 2}
                      onChange={() => setData('ambiente', 2)}
                      className="rounded-full border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-slate-700 font-medium">2 - Producción</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Define el entorno del SRI donde se enviarán los comprobantes electrónicos.
                </p>
                <FieldError msg={errors.ambiente} />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Establecimiento
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={data.establecimiento}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 3);
                    setData('establecimiento', val);
                  }}
                  onBlur={() => setData('establecimiento', padLeft(data.establecimiento, 3))}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="001"
                />
                <FieldError msg={errors.establecimiento} />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Punto de emisión
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={data.punto_emision}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 3);
                    setData('punto_emision', val);
                  }}
                  onBlur={() => setData('punto_emision', padLeft(data.punto_emision, 3))}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="001"
                />
                <FieldError msg={errors.punto_emision} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Siguiente Secuencial Factura
                </label>
                <input
                  type="text"
                  maxLength={9}
                  value={data.secuencial_factura}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 9);
                    setData('secuencial_factura', val);
                  }}
                  onBlur={() => setData('secuencial_factura', padLeft(data.secuencial_factura, 9))}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 font-mono"
                  placeholder="000000001"
                />
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">9 dígitos</p>
                <FieldError msg={errors.secuencial_factura} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Siguiente Secuencial Nota de Crédito
                </label>
                <input
                  type="text"
                  maxLength={9}
                  value={data.secuencial_nota_credito}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 9);
                    setData('secuencial_nota_credito', val);
                  }}
                  onBlur={() => setData('secuencial_nota_credito', padLeft(data.secuencial_nota_credito, 9))}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 font-mono"
                  placeholder="000000001"
                />
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">9 dígitos</p>
                <FieldError msg={errors.secuencial_nota_credito} />
              </div>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="p-4 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Contacto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={data.direccion}
                  onChange={(e) => setData('direccion', e.target.value)}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Calle, número, referencia"
                />
                <FieldError msg={errors.direccion} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={data.telefono}
                  onChange={(e) => setData('telefono', e.target.value)}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="0999999999"
                />
                <FieldError msg={errors.telefono} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Correo
                </label>
                <input
                  type="email"
                  value={data.correo}
                  onChange={(e) => setData('correo', e.target.value)}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="correo@dominio.com"
                />
                <FieldError msg={errors.correo} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  RUC
                </label>
                <input
                  type="text"
                  value={data.ruc}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 13);
                    setData('ruc', val);
                  }}
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="13 dígitos"
                />
                <FieldError msg={errors.ruc} />
              </div>
            </div>
          </div>
        </div>

        {/* Firma electrónica */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="p-4 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Firma electrónica
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Archivo .p12 / .pfx o .zip
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip,.p12,.pfx,application/x-pkcs12"
                  onChange={onFileChange}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-200 file:bg-white file:text-slate-700 hover:file:bg-slate-50"
                />
                <FieldError msg={errors.firma} />
                <p className="mt-1 text-xs text-slate-500">
                  Se enviará convertido a base64 y se guardará privado.
                </p>
                {data.firma_nombre && (
                  <p className="mt-1 text-xs text-slate-600">
                    Seleccionado: <span className="font-medium">{data.firma_nombre}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Archivo actual
                </label>
                <div className="text-sm">
                  {empresa?.ruta_firma_electronica ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        Archivo cargado correctamente
                      </div>
                      
                      {empresa.firma_propietario && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Propietario</div>
                            <div className="text-xs text-slate-700 font-medium truncate">{empresa.firma_propietario}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Emisor</div>
                            <div className="text-xs text-slate-700 font-medium truncate">{empresa.firma_emisor}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Válido desde</div>
                            <div className="text-xs text-slate-700 font-medium">
                              {new Date(empresa.firma_valido_desde).toLocaleDateString('es-EC')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Válido hasta</div>
                            <div className={`text-xs font-bold ${new Date(empresa.firma_valido_hasta) < new Date() ? 'text-secondary-600' : 'text-emerald-700'}`}>
                              {new Date(empresa.firma_valido_hasta).toLocaleDateString('es-EC')}
                              {new Date(empresa.firma_valido_hasta) < new Date() && ' (EXPIRADA)'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500">No hay archivo cargado</span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clave de la firma (texto plano)
                </label>
                <input
                  type="text"
                  value={data.clave_firma_electronica}
                  onChange={(e) =>
                    setData('clave_firma_electronica', e.target.value)
                  }
                  className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Ingresa la clave tal cual"
                />
                <FieldError msg={errors.clave_firma_electronica} />

              </div>
            </div>
          </div>
        </div>



        {/* Acciones */}
        {canEdit ? (
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={restoreForm}
              className="px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Restablecer
            </button>
            <button
              type="submit"
              disabled={processing}
              className={[
                'px-3 py-2 rounded-md text-white',
                processing
                  ? 'bg-primary-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700',
              ].join(' ')}
            >
              {isEdit ? 'Guardar cambios' : 'Crear empresa'}
            </button>
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-end">
            <span className="text-sm text-slate-500 italic">Solo lectura: no tienes permisos para editar los datos de la empresa ni del SRI.</span>
          </div>
        )}
      </form>
    </AdminLayout>
  );
}
