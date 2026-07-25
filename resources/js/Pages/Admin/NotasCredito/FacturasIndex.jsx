import React, { useMemo, useState, useEffect } from "react";
import { Head, Link, useForm, router } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";

const money = (n) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString("es-EC");
};
const nro = (v) =>
  `${v.estab}-${v.pto_emision}-${String(v.secuencial).padStart(9, "0")}`;
const normalizeEstado = (s) => String(s ?? "").toLowerCase().trim();

function BadgeEstado({ estado }) {
  const map = {
    creada: "bg-amber-50 text-amber-700 ring-amber-600/20",
    emitida: "bg-blue-50 text-blue-700 ring-blue-600/20",
    firmada: "bg-purple-50 text-purple-700 ring-purple-600/20",
    autorizado: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    devuelta: "bg-rose-50 text-rose-700 ring-rose-600/20",
    anulada: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  const key = normalizeEstado(estado);
  const cls = map[key] || "bg-slate-50 text-slate-700 ring-slate-600/20";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {String(estado || "creada").toUpperCase()}
    </span>
  );
}

/* ===================== MODAL: NOTA DE CRÉDITO ===================== */
function PrintModal({ open, onClose, nota }) {
  const [loading, setLoading] = useState(false);
  const [detalles, setDetalles] = useState([]);
  const [totales, setTotales] = useState({
    subtotal: 0,
    impuesto_15: 0,
    descuento: 0,
    total: 0,
  });

  useEffect(() => {
    if (!open || !nota?.id) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // Endpoint sugerido: devuelve JSON con {detalles, totales}
        const url = route("admin.notas_credito.detalles", nota.id);
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setDetalles(Array.isArray(data?.detalles) ? data.detalles : []);
          setTotales({
            subtotal: data?.totales?.subtotal ?? nota.subtotal ?? 0,
            impuesto_15: data?.totales?.impuesto_15 ?? nota.impuesto_15 ?? 0,
            descuento: data?.totales?.descuento ?? nota.descuento ?? 0,
            total: data?.totales?.total ?? nota.total ?? 0,
          });
        } else {
          // fallback con lo que ya tenemos en la lista
          setDetalles([]);
          setTotales({
            subtotal: nota.subtotal ?? 0,
            impuesto_15: nota.impuesto_15 ?? 0,
            descuento: nota.descuento ?? 0,
            total: nota.total ?? 0,
          });
        }
      } catch {
        setDetalles([]);
        setTotales({
          subtotal: nota.subtotal ?? 0,
          impuesto_15: nota.impuesto_15 ?? 0,
          descuento: nota.descuento ?? 0,
          total: nota.total ?? 0,
        });
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, nota?.id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center print:static print:block">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40 print:hidden" onClick={onClose} />
      {/* panel */}
      <div className="relative z-[61] w-[96vw] max-w-5xl rounded-xl bg-white shadow-lg print:w-full print:max-w-none print:rounded-none print:shadow-none">
        {/* header */}
        <div className="flex items-center justify-between border-b px-4 py-3 print:hidden">
          <h3 className="text-base font-semibold">
            Nota de Crédito — <span className="font-mono">{nro(nota)}</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
            >
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* cuerpo */}
        <div className="max-h-[80vh] overflow-auto p-4 print:max-h-none print:p-6">
          {/* Encabezado tipo card como tu componente */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-white">
            <div className="grid gap-4 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-semibold text-slate-800">{nota.cliente_nombres ?? "—"}</p>
                {nota.cliente_ci_o_ruc && (
                  <p className="text-xs text-slate-500">CI/RUC: {nota.cliente_ci_o_ruc}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Nota de crédito</p>
                <p className="font-mono font-semibold">{nro(nota)}</p>
                <p className="text-xs text-slate-500">Fecha: {fmtDate(nota.fecha)}</p>
              </div>
              <div className="flex items-end justify-between sm:block">
                <div className="mb-1">
                  <p className="text-xs text-slate-500">Estado</p>
                  <BadgeEstado estado={nota.estado} />
                </div>
                {nota.doc_sustento && (
                  <p className="mt-1 text-xs text-slate-500">
                    Sustento: <span className="font-mono">{nota.doc_sustento}</span>
                  </p>
                )}
              </div>
            </div>
            {nota.motivo && (
              <div className="border-t px-4 py-3 text-sm">
                <span className="text-slate-500">Motivo: </span>
                <span className="font-medium text-slate-800">{nota.motivo}</span>
              </div>
            )}
          </div>

          {/* Tabla de detalles (mismo look & feel) */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                    <th>Código</th>
                    <th>Producto</th>
                    <th className="text-right">Cant.</th>
                    <th className="text-right">Precio</th>
                    <th className="text-right">Desc.</th>
                    <th className="text-right">IVA</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Cargando…
                      </td>
                    </tr>
                  )}
                  {!loading && detalles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Sin detalles para mostrar.
                      </td>
                    </tr>
                  )}
                  {detalles.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{d.codigo ?? "—"}</td>
                      <td className="px-4 py-3">{d.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{Number(d.cantidad ?? 0)}</td>
                      <td className="px-4 py-3 text-right">{money(d.precio)}</td>
                      <td className="px-4 py-3 text-right">{money(d.descuento)}</td>
                      <td className="px-4 py-3 text-right">{(d.iva ?? 0) + "%"}</td>
                      <td className="px-4 py-3 text-right font-medium">{money(d.total_linea ?? (Number(d.cantidad||0)*Number(d.precio||0) - Number(d.descuento||0)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totales al pie, estilo card como tu ejemplo */}
            <div className="flex justify-end border-t">
              <div className="w-full max-w-sm p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">{money(totales.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">IVA 15%</span>
                  <span className="font-medium">{money(totales.impuesto_15)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Descuento</span>
                  <span className="font-medium">{money(totales.descuento)}</span>
                </div>
                <div className="mt-1 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{money(totales.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pie para impresión */}
          <div className="mt-6 text-[11px] text-slate-500 print:mt-4">
            * Documento generado electrónicamente. {nota.autorizacion ? `Clave de acceso: ${nota.autorizacion}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PESTAÑAS + LISTAS (igual que antes) ===================== */
function FiltersFacturas({ filtros }) {
  const { get, processing, data, setData } = useForm({
    q: filtros?.q ?? "",
    estado: filtros?.estado ?? "autorizado",
    fecha_desde: filtros?.fecha_desde ?? "",
    fecha_hasta: filtros?.fecha_hasta ?? "",
    tab: "facturas",
  });

  const submit = (e) => {
    e.preventDefault();
    get(route("admin.notas_credito.facturas"), { preserveScroll: true, preserveState: true });
  };
  const reset = () => {
    setData({ q: "", estado: "autorizado", fecha_desde: "", fecha_hasta: "", tab: "facturas" });
    get(route("admin.notas_credito.facturas"), { preserveScroll: true, preserveState: true });
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-5">
      <input className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" placeholder="Nro / cliente / CI-RUC" value={data.q} onChange={(e)=>setData("q", e.target.value)} />
      <select className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.estado} onChange={(e)=>setData("estado", e.target.value)}>
        <option value="autorizado">AUTORIZADA</option>
        <option value="">(Todos)</option>
      </select>
      <input type="date" className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.fecha_desde} onChange={(e)=>setData("fecha_desde", e.target.value)} />
      <input type="date" className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.fecha_hasta} onChange={(e)=>setData("fecha_hasta", e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" disabled={processing} className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">Buscar</button>
        <button type="button" onClick={reset} className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Limpiar</button>
      </div>
    </form>
  );
}

function FiltersNotas({ filtros }) {
  const { get, processing, data, setData } = useForm({
    n_q: filtros?.n_q ?? "",
    n_estado: filtros?.n_estado ?? "",
    n_fecha_desde: filtros?.n_fecha_desde ?? "",
    n_fecha_hasta: filtros?.n_fecha_hasta ?? "",
    tab: "notas",
  });

  const submit = (e) => {
    e.preventDefault();
    get(route("admin.notas_credito.facturas"), { preserveScroll: true, preserveState: true });
  };
  const reset = () => {
    setData({ n_q: "", n_estado: "", n_fecha_desde: "", n_fecha_hasta: "", tab: "notas" });
    get(route("admin.notas_credito.facturas"), { preserveScroll: true, preserveState: true });
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-5">
      <input className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" placeholder="NC nro / sustento / cliente / CI-RUC" value={data.n_q} onChange={(e)=>setData("n_q", e.target.value)} />
      <select className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.n_estado} onChange={(e)=>setData("n_estado", e.target.value)}>
        <option value="">(Todos)</option>
        <option value="emitida">Emitida</option>
        <option value="AUTORIZADO">AUTORIZADA</option>
        <option value="Devuelta">Devuelta</option>
      </select>
      <input type="date" className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.n_fecha_desde} onChange={(e)=>setData("n_fecha_desde", e.target.value)} />
      <input type="date" className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500" value={data.n_fecha_hasta} onChange={(e)=>setData("n_fecha_hasta", e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" disabled={processing} className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">Buscar</button>
        <button type="button" onClick={reset} className="rounded-md border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50">Limpiar</button>
      </div>
    </form>
  );
}

export default function FacturasIndex({ auth, ventas, notas, filtros, filtros_nc, flash }) {
  const listaFact = Array.isArray(ventas?.data) ? ventas.data : [];
  const listaNotas = Array.isArray(notas?.data) ? notas.data : [];

  const initialTab = useMemo(() => {
    const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return p.get("tab") === "notas" ? "notas" : "facturas";
  }, []);
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", tab);
    const qs = sp.toString();
    const url = `${window.location.pathname}?${qs}`;
    window.history.replaceState({}, "", url);
  }, [tab]);

  const [loadingVentaId, setLoadingVentaId] = useState(null);
  const processing = Boolean(loadingVentaId);
  const prellenar = (ventaId, emitir = false) => {
    setLoadingVentaId(ventaId);
    router.post(
      `/admin/notas-credito/cargar-desde-factura/${ventaId}`,
      { emitir },
      {
        onFinish: () => setLoadingVentaId(null),
      }
    );
  };

  const [printOpen, setPrintOpen] = useState(false);
  const [notaSel, setNotaSel] = useState(null);
  const abrirImprimir = (n) => { setNotaSel(n); setPrintOpen(true); };

  const appendTab = (url, which) => (url ? url + (url.includes("?") ? "&" : "?") + "tab=" + which : null);

  return (
    <AdminLayout auth={auth} title="Facturas — Notas de Crédito">
      <Head title="Facturas — Notas de Crédito" />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        {flash?.success && <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">{flash.success}</div>}
        {flash?.error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-800">{flash.error}</div>}

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Facturas y Notas de Crédito</h1>
          <Link href={route("admin.dashboard.index")} className="text-sm text-indigo-600 hover:text-indigo-800">Volver al panel</Link>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="flex gap-1 border-b">
            <button onClick={()=>setTab("facturas")} className={["px-4 py-2 text-sm font-medium", tab==="facturas"?"border-b-2 border-indigo-600 text-indigo-700":"text-gray-600 hover:text-gray-800"].join(" ")}>Facturas</button>
            <button onClick={()=>setTab("notas")} className={["px-4 py-2 text-sm font-medium", tab==="notas"?"border-b-2 border-indigo-600 text-indigo-700":"text-gray-600 hover:text-gray-800"].join(" ")}>Notas de crédito</button>
          </div>

          {/* FACTURAS */}
          {tab === "facturas" && (
            <div className="space-y-4 p-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <FiltersFacturas filtros={filtros} />
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Nro</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-right">IVA</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFact.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No hay facturas para los filtros seleccionados.</td></tr>
                    )}
                    {listaFact.map((v) => {
                      const tieneNC = Boolean(v.nc_id);
                      const ncEmitida = tieneNC && (String(v.nc_sri_estado || "").toLowerCase() === "autorizado" || String(v.nc_estado || "").toLowerCase() === "emitida");

                      return (
                        <tr key={v.id} className="border-t">
                          <td className="px-3 py-2">{new Date(v.fecha).toLocaleString()}</td>
                          <td className="px-3 py-2 font-mono">{nro(v)}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{v.cliente_nombres ?? "—"}</div>
                            <div className="text-xs text-gray-500">{v.cliente_ci_o_ruc ?? ""}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{money(v.subtotal)}</td>
                          <td className="px-3 py-2 text-right">{money(v.impuesto_15)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(v.total)}</td>
                          <td className="px-3 py-2 text-center">
                            {ncEmitida ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                                  🟢 NC Emitida
                                </span>
                                <Link
                                  href={route("admin.notas_credito.show", v.nc_id)}
                                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                                >
                                  👁️ Ver NC
                                </Link>
                              </div>
                            ) : tieneNC ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-600/20">
                                  🟡 Borrador NC
                                </span>
                                <Link
                                  href={route("admin.notas_credito.show", v.nc_id)}
                                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                                >
                                  ✏️ Continuar NC
                                </Link>
                              </div>
                            ) : (
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => prellenar(v.id, false)}
                                  disabled={loadingVentaId === v.id}
                                  className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                                >
                                  {loadingVentaId === v.id ? "Abriendo…" : "✏️ Seleccionar Productos"}
                                </button>
                                <button
                                  onClick={() => prellenar(v.id, true)}
                                  disabled={loadingVentaId === v.id}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                  {loadingVentaId === v.id ? "Procesando…" : "🚀 Generar y Emitir"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Paginación facturas */}
                {ventas?.links && (
                  <nav className="mb-4 mt-3 flex flex-wrap gap-2 px-3 pb-3">
                    {ventas.links.map((l, i) => (
                      <Link key={i} href={appendTab(l.url, "facturas") || "#"} preserveScroll className={["rounded-md border px-3 py-1.5 text-sm", l.active ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50", !l.url && "pointer-events-none opacity-50"].join(" ")} dangerouslySetInnerHTML={{ __html: l.label }} />
                    ))}
                  </nav>
                )}
              </div>
            </div>
          )}

          {/* NOTAS */}
          {tab === "notas" && (
            <div className="space-y-4 p-4">
              <div className="rounded-xl border border-gray-200 p-4">
                <FiltersNotas filtros={filtros_nc} />
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Nro</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Sustento</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-right">IVA</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaNotas.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">No hay notas de crédito para los filtros seleccionados.</td></tr>
                    )}
                    {listaNotas.map((n) => (
                      <tr key={n.id} className="border-t">
                        <td className="px-3 py-2">{n.fecha ? new Date(n.fecha).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2 font-mono">{nro(n)}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{n.cliente_nombres ?? "—"}</div>
                          <div className="text-xs text-gray-500">{n.cliente_ci_o_ruc ?? ""}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{n.doc_sustento || "—"}</td>
                        <td className="px-3 py-2 text-right">{money(n.subtotal)}</td>
                        <td className="px-3 py-2 text-right">{money(n.impuesto_15)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{money(n.total)}</td>
                        <td className="px-3 py-2"><BadgeEstado estado={n.estado} /></td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex gap-2">
                            <Link href={route("admin.notas_credito.show", n.id)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-gray-700 hover:bg-gray-50">Ver</Link>
                            <button onClick={()=>abrirImprimir(n)} className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-white hover:bg-indigo-700">Imprimir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginación notas */}
                {notas?.links && (
                  <nav className="mb-4 mt-3 flex flex-wrap gap-2 px-3 pb-3">
                    {notas.links.map((l, i) => (
                      <Link key={i} href={appendTab(l.url, "notas") || "#"} preserveScroll className={["rounded-md border px-3 py-1.5 text-sm", l.active ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50", !l.url && "pointer-events-none opacity-50"].join(" ")} dangerouslySetInnerHTML={{ __html: l.label }} />
                    ))}
                  </nav>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal con layout adaptado */}
      <PrintModal open={printOpen} onClose={()=>setPrintOpen(false)} nota={notaSel} />
    </AdminLayout>
  );
}
