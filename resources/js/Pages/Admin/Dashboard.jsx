import React, { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";

/* ----------------- Helpers ----------------- */
const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const mkey = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const safe = (a) => (Array.isArray(a) ? a : []);
const n = (x) => (Number.isFinite(+x) ? +x : 0);

const formatShort = (val) => {
  const v = n(val);
  if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v/1_000).toFixed(0)}k`;
  return v.toLocaleString("es-EC", { style:"currency", currency:"USD", maximumFractionDigits:0 });
};
const currency = (val) =>
  n(val).toLocaleString("es-EC", { style:"currency", currency:"USD", maximumFractionDigits:2 });

const sortYM = (arr, y="anio", m="mes") => [...arr].sort((a,b)=>(a[y]-b[y])||(a[m]-b[m]));

/* ----------------- UI ----------------- */
function MetricCard({ title, value, subtitle, delta }) {
  const ok = typeof delta === "number" && delta >= 0;
  const deltaTxt = delta==null ? null : `${ok ? "+" : ""}${delta.toFixed(2)}% vs. mes prev.`;
  return (
    <motion.div
      initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.2}}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="text-[12px] uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl md:text-[28px] font-semibold leading-tight text-slate-900 font-mono">
        {value}
      </div>
      {subtitle && <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div>}
      {deltaTxt && (
        <div className={`mt-2 text-[12px] font-medium ${ok ? "text-emerald-600" : "text-rose-600"}`}>
          {deltaTxt}
        </div>
      )}
    </motion.div>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] md:text-base font-semibold tracking-tight text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function SimpleTable({ columns, rows, keyField, emptyText="Sin datos" }) {
  const has = rows?.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-slate-600">
            {columns.map(c => (
              <th key={c.key} className={`py-2 pr-3 font-medium ${c.align==="right"?"text-right":""}`}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {has ? rows.map((r,i)=>(
            <tr key={r[keyField] ?? i} className="border-t border-slate-100">
              {columns.map(c=>(
                <td key={c.key}
                    className={`py-2 pr-3 ${c.align==="right"?"text-right font-mono":""} ${c.muted?"text-slate-500":""}`}>
                  {c.render ? c.render(r,i) : r[c.key]}
                </td>
              ))}
            </tr>
          )):(
            <tr><td colSpan={columns.length} className="py-6 text-center text-slate-400">{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------- Page ----------------- */
export default function Dashboard() {
  const { metrics = {} } = usePage().props;
  const [year, setYear] = useState("Todos");

  const ventasMensuales = useMemo(() => sortYM(
    safe(metrics.ventas_mensuales).map(r=>({
      anio:n(r.anio), mes:n(r.mes),
      key:mkey(r.anio,r.mes),
      label:`${monthNames[n(r.mes)-1]} ${String(r.anio).slice(-2)}`,
      ventas:n(r.num_ventas), monto:n(r.monto_total),
    }))
  ), [metrics]);

  const productosCreados = useMemo(() => sortYM(
    safe(metrics.productos_creados).map(r=>({
      anio:n(r.anio), mes:n(r.mes),
      key:mkey(r.anio,r.mes),
      label:`${monthNames[n(r.mes)-1]} ${String(r.anio).slice(-2)}`,
      total:n(r.productos_creados),
    }))
  ), [metrics]);

  const unidadesPorLote = useMemo(() => sortYM(
    safe(metrics.unidades_por_lote).map(r=>({
      anio:n(r.anio), mes:n(r.mes),
      key:mkey(r.anio,r.mes),
      label:`${monthNames[n(r.mes)-1]} ${String(r.anio).slice(-2)}`,
      total:n(r.unidades_ingresadas),
    }))
  ), [metrics]);

  const serie12 = useMemo(() => sortYM(
    safe(metrics.serie_12m).map(r=>({
      anio:n(r.anio), mes:n(r.mes),
      key:mkey(r.anio,r.mes),
      label:`${monthNames[n(r.mes)-1]} ${String(r.anio).slice(-2)}`,
      ventas:n(r.ventas), monto:n(r.monto),
    }))
  ).slice(-12), [metrics]);

  const years = useMemo(() => ["Todos", ...Array.from(new Set(ventasMensuales.map(v=>v.anio))).sort((a,b)=>a-b)], [ventasMensuales]);
  const filteredVentas = useMemo(() => year==="Todos" ? ventasMensuales : ventasMensuales.filter(v=>v.anio===Number(year)), [ventasMensuales, year]);

  // Deltas
  const base = (serie12.length?serie12:ventasMensuales).slice(-2);
  const delta = base.length===2 && base[0].monto>0 ? ((base[1].monto-base[0].monto)/base[0].monto)*100 : null;

  // Tops
  const topProductos = safe(metrics.top_productos).map((r,i)=>({ id:`${r.producto}-${i}`, producto:r.producto, unidades:n(r.unidades), ingreso:n(r.ingreso_bruto)}))
    .sort((a,b)=>b.ingreso-a.ingreso);
  const topClientes = safe(metrics.top_clientes).map((r,i)=>({ id:`${r.cliente}-${i}`, cliente:r.cliente, compras:n(r.compras), monto:n(r.monto)}))
    .sort((a,b)=>b.monto-a.monto);
  const porVendedor = safe(metrics.por_vendedor).map((r,i)=>({ id:`${r.vendedor}-${i}`, vendedor:r.vendedor, ventas:n(r.ventas), monto:n(r.monto)}))
    .sort((a,b)=>b.monto-a.monto).slice(0,10);

  // Inventario merge
  const inventarioIn = useMemo(()=>{
    const map = new Map();
    productosCreados.forEach(x=>map.set(x.key,{key:x.key,label:x.label,creados:x.total,unidades:0}));
    unidadesPorLote.forEach(x=>{
      const cur = map.get(x.key) || {key:x.key,label:x.label,creados:0,unidades:0};
      cur.unidades = x.total; map.set(x.key, cur);
    });
    return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key));
  }, [productosCreados, unidadesPorLote]);

  const pieColors = ["#60a5fa","#34d399","#f472b6","#fbbf24","#a78bfa","#fb7185","#22d3ee","#f59e0b","#4ade80","#93c5fd"];

  return (
    <AdminLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Panel de Métricas</h1>
          <div className="flex items-center gap-2">
            <span className="text-[12px] uppercase tracking-wide text-slate-600">Año</span>
            <select
              value={year}
              onChange={(e)=>setYear(e.target.value==="Todos"?"Todos":Number(e.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm bg-white shadow-sm"
            >
              {years.map(y=>(<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Ventas Totales" value={n(metrics.total_ventas).toLocaleString("es-EC")} subtitle="Acumulado histórico" delta={delta} />
          <MetricCard title="Monto Total" value={currency(metrics.monto_total)} subtitle="Ingresos acumulados" />
          <MetricCard title="Ticket Promedio" value={currency(metrics.ticket_promedio)} subtitle="Ingreso / venta" />
          <MetricCard title="Stock Actual" value={n(metrics.stock_actual).toLocaleString("es-EC")} subtitle="Unidades disponibles" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Section title="Ventas por Mes (Monto)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredVentas} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMonto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={40}
                         tick={{ fontSize: 11, fill:"#475569" }} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 11, fill:"#475569" }} width={56} />
                  <Tooltip formatter={(v)=>currency(v)} labelFormatter={(l)=>`Mes: ${l}`} />
                  <Area type="monotone" dataKey="monto" stroke="#3b82f6" strokeWidth={2} fill="url(#gMonto)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Número de Ventas por Mes">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredVentas} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={40}
                         tick={{ fontSize: 11, fill:"#475569" }} />
                  <YAxis tick={{ fontSize: 11, fill:"#475569" }} width={40} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#34d399" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Tendencia últimos 12 meses">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie12} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={40}
                         tick={{ fontSize: 11, fill:"#475569" }} />
                  <YAxis yAxisId="monto" tickFormatter={formatShort} tick={{ fontSize: 11, fill:"#475569" }} width={56} />
                  <YAxis yAxisId="ventas" orientation="right" tick={{ fontSize: 11, fill:"#475569" }} width={40} />
                  <Tooltip formatter={(v,nm)=> nm==="monto" ? currency(v) : v} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="monto" type="monotone" dataKey="monto" name="Monto" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line yAxisId="ventas" type="monotone" dataKey="ventas" name="Ventas" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Ingresos a Inventario (creados vs. unidades por lote)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventarioIn} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                  <XAxis dataKey="label" interval={0} angle={-15} textAnchor="end" height={40}
                         tick={{ fontSize: 11, fill:"#475569" }} />
                  <YAxis tick={{ fontSize: 11, fill:"#475569" }} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize:12 }} />
                  <Bar dataKey="creados" name="Productos creados" fill="#93c5fd" radius={[6,6,0,0]} />
                  <Bar dataKey="unidades" name="Unidades por lote" fill="#fda4af" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Distribución de Ingresos por Vendedor (Top 10)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v)=>currency(v)} />
                  <Legend wrapperStyle={{ fontSize:12 }} />
                  <Pie data={porVendedor} dataKey="monto" nameKey="vendedor"
                       outerRadius={92} innerRadius={42} paddingAngle={2}
                       label={({ name, value }) => `${name}: ${currency(value)}`} labelLine={false}>
                    {porVendedor.map((_,i)=><Cell key={i} fill={pieColors[i%pieColors.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* Tablas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Top Productos (últimos 90 días)">
            <SimpleTable
              keyField="id"
              columns={[
                { key:"idx", title:"#", align:"right", render:(_r,i)=>i+1 },
                { key:"producto", title:"Producto" },
                { key:"unidades", title:"Unid.", align:"right", render:(r)=>r.unidades.toLocaleString("es-EC") },
                { key:"ingreso", title:"Ingreso", align:"right", render:(r)=>currency(r.ingreso) },
              ]}
              rows={topProductos}
            />
          </Section>
          <Section title="Top Clientes (histórico)">
            <SimpleTable
              keyField="id"
              columns={[
                { key:"idx", title:"#", align:"right", render:(_r,i)=>i+1 },
                { key:"cliente", title:"Cliente" },
                { key:"compras", title:"Compras", align:"right", render:(r)=>r.compras.toLocaleString("es-EC") },
                { key:"monto", title:"Monto", align:"right", render:(r)=>currency(r.monto) },
              ]}
              rows={topClientes}
            />
          </Section>
        </div>

        {/* KPIs día/mes */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard title="Ventas Hoy" value={n(metrics.hoy_ventas).toLocaleString("es-EC")} subtitle="Desde 00:00" />
          <MetricCard title="Monto Hoy" value={currency(metrics.hoy_monto)} subtitle="Desde 00:00" />
          <MetricCard title="Monto del Mes" value={currency(metrics.mes_monto)} subtitle="Acumulado del mes" />
        </div>

        <footer className="pt-1 text-[11px] text-slate-500">
          * Algunas métricas se calculan de forma adaptativa según el esquema existente (campos y tablas disponibles).
        </footer>
      </div>
    </AdminLayout>
  );
}
