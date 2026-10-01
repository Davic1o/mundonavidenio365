import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiPlus, FiTrash2, FiArrowRight } from 'react-icons/fi';

function money(n){ return (Number(n)||0).toLocaleString('es-EC',{style:'currency',currency:'USD'}); }

/**
 * Parser de descuento:
 * - Acepta "12%", "12 %", "%12", "12,5%", "12.5%", "3" (valor), "3.25"
 * - Siempre retorna { amount } en función de la base (con IVA)
 * - pct se clampa [0,100], amount se clampa [0, base]
 */
function parseDescuento(raw, base) {
  const baseNum = Number(base) || 0;
  let s = String(raw ?? '').trim();
  if (!s) return { amount: 0, pct: 0, mode: 'none' };

  // normalizar: quitar espacios y coma->punto
  s = s.replace(/\s+/g, '').replace(',', '.');

  const hasPct = s.includes('%') || s.startsWith('%');
  if (hasPct) {
    // soporta "%12" y "12%"
    s = s.replace('%','');
    const p0 = parseFloat(s);
    const p = isNaN(p0) ? 0 : Math.max(0, Math.min(100, p0));
    const amt = baseNum * (p/100);
    const amount = Math.max(0, Math.min(baseNum, +amt.toFixed(2)));
    return { amount, pct: +p.toFixed(2), mode: 'percent' };
  }

  // Modo valor absoluto
  const a0 = parseFloat(s);
  const a = isNaN(a0) ? 0 : Math.max(0, a0);
  const amount = Math.max(0, Math.min(baseNum, +a.toFixed(2)));
  const pct = baseNum > 0 ? +((amount/baseNum)*100).toFixed(2) : 0;
  return { amount, pct, mode: 'amount' };
}

function normalizeEstado(s) {
  return String(s ?? '').toLowerCase().trim();
}

export default function Editar({ venta, cliente, items }) {
  const isReadOnly = normalizeEstado(venta?.estado) === 'autorizado';

  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [lastSearched, setLastSearched] = useState('');

  const [highlighted, setHighlighted] = useState(-1);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const searchRef = useRef(null);

  const [rows, setRows] = useState((items||[]).map(it=>({
    producto_id: it.producto_id,
    nombre: it.nombre,
    codigo: it.codigo,
    cantidad: String(it.cantidad ?? ''),
    precio: Number(it.precio),
    descuento: it.descuento ? String(it.descuento) : '', // input muestra lo que el usuario puso
    iva: it.iva ?? 15,
    cantidad_total: Number(it.cantidad_total ?? it.stock ?? it.existencia ?? Infinity)
  })));
  const [lastAddedIndex, setLastAddedIndex] = useState(null);

  // ======= Buscar productos =======
  async function buscar(queryArg, autoAdd = false){
    if(isReadOnly){ return; }
    const query = String(queryArg !== undefined ? queryArg : q).trim();
    try {
      const r = await fetch(route('admin.productos.buscar', { q: query }));
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      setRes(arr);
      setLastSearched(query);

      // Si coincide exactamente el código de barras o devuelve un único resultado, y se permite autoAdd (Ej. Enter)
      if (autoAdd) {
        const exactCodeMatch = arr.find(p => String(p.codigo ?? '').toLowerCase() === query.toLowerCase());
        if (exactCodeMatch) {
          add(exactCodeMatch);
        } else if (arr.length === 1) {
          add(arr[0]);
        } else {
          setHighlighted(arr.length ? 0 : -1);
        }
      } else {
        // Búsqueda manual por botón, solo muestra resultados
        setHighlighted(arr.length ? 0 : -1);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function add(p){
    if(isReadOnly || !p){ return; }
    const pId = p.id ?? p.producto_id;
    const max = Number(p?.cantidad_total ?? p?.stock ?? p?.existencia ?? Infinity);

    setRows(s => {
      const existingIdx = s.findIndex(r => r.producto_id === pId);
      if (existingIdx !== -1) {
        // El producto ya existe: incrementamos la cantidad en +1 sin restricción de tope
        return s.map((r, ix) => {
          if (ix === existingIdx) {
            const currentQty = Number(r.cantidad) || 0;
            return {
              ...r,
              cantidad: String(currentQty + 1),
            };
          }
          return r;
        });
      }

      // Si no existe, agregamos nueva fila con cantidad inicial '1'
      return [
        {
          producto_id: pId,
          nombre: p.nombre,
          codigo: p.codigo,
          cantidad: '1',
          precio: Number(p.pvp || p.precio || 0),
          descuento: p.descuento ? String(p.descuento) : '',
          iva: p.iva ?? 15,
          cantidad_total: max,
        },
        ...s,
      ];
    });

    setQ('');
    setRes([]);
    setHighlighted(-1);
    setLastSearched('');
    setTimeout(() => {
      if (searchRef.current) {
        searchRef.current.focus();
        searchRef.current.select?.();
      }
    }, 10);
  }

  function setField(i, k, v){
    if(isReadOnly){ return; }
    setRows(s=>s.map((r,ix)=>ix===i?{ ...r, [k]: k==='precio' ? Number(v) : v }:r));
  }

  // cantidad solo enteros
  function setCantidad(i, raw){
    if(isReadOnly){ return; }
    setRows(s=>s.map((r,ix)=>{
      if(ix!==i) return r;
      if(raw==='') return { ...r, cantidad: '' };
      let n = parseInt(raw, 10);
      if (isNaN(n)) n = 0;
      return { ...r, cantidad: String(n) };
    }));
  }

  function clampCantidadOnBlur(i){
    if(isReadOnly){ return; }
    setRows(s=>s.map((r,ix)=>{
      if(ix!==i) return r;
      if(r.cantidad==='') return r; // se valida al guardar
      let n = parseInt(r.cantidad, 10);
      if (isNaN(n) || n<=0) n = 1;
      return { ...r, cantidad: String(n) };
    }));
  }

  // Limpia el input de descuento pero no convierte lo que ve el usuario;
  // el casteo a monto SIEMPRE se hace al calcular y al enviar.
  function clampDescuentoOnBlur(i){
    if(isReadOnly){ return; }
    setRows(s=>s.map((r,ix)=>{
      if(ix!==i) return r;
      let raw = String(r.descuento ?? '').trim();
      if (!raw) return { ...r, descuento: '' };
      // normalizar visual: quitar espacios duplicados, asegurar % en extremo
      raw = raw.replace(',', '.').replace(/\s+/g,'');
      // permitir "12%", "%12" o "12.5"
      const isPercent = raw.includes('%') || raw.startsWith('%');
      if (isPercent) {
        const num = parseFloat(raw.replace('%',''));
        if (isNaN(num) || num < 0) return { ...r, descuento: '' };
        const p = Math.max(0, Math.min(100, +num.toFixed(2)));
        return { ...r, descuento: `${p}%` };
      } else {
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) return { ...r, descuento: '' };
        return { ...r, descuento: String(+num.toFixed(2)) };
      }
    }));
  }

  function renderCodigo(codigo) {
    if (!codigo) return '—';
    const partes = String(codigo).split('-');
    return (
      <span>
        {partes.map((seg, idx) => (
          <span key={idx}>
            {idx > 0 && <span>-</span>}
            {idx === 1 ? (
              <span className="text-lg font-bold">{seg}</span>
            ) : (
              <span>{seg}</span>
            )}
          </span>
        ))}
      </span>
    );
  }

  function del(i){
    if(isReadOnly){ return; }
    setRows(s=>s.filter((_,ix)=>ix!==i));
  }

  // ======= Totales (precio incluye IVA; subtotal = total con IVA) =======
  const tot = useMemo(() => {
    let base0 = 0, base15 = 0, ivaSum = 0, desc = 0, totalBruto = 0;
    let totalSinDesc = 0;
    for (const r of rows) {
      const qty   = Number(r.cantidad) || 0;
      const pG    = Number(r.precio)   || 0;         // precio con IVA
      const lineG = qty * pG;                        // línea sin desc (con IVA)
      const { amount: dscAmt } = parseDescuento(r.descuento, lineG);
      const lineAfter = Math.max(0, lineG - dscAmt); // línea con desc (con IVA)

      totalSinDesc += lineG;
      desc += dscAmt;

      const tasa = Number(r.iva) || 0;               // 0 o 15
      if (tasa === 0) {
        base0 += lineAfter;
      } else {
        const t    = tasa / 100;
        const base = +(lineAfter / (1 + t)).toFixed(2);
        const iva  = +(lineAfter - base).toFixed(2);
        base15 += base; ivaSum += iva;
      }
      totalBruto += lineAfter;
    }
    const subtotalInclIva = +totalBruto.toFixed(2);
    const total = subtotalInclIva;
    return {
      base0,
      base15,
      subtotal: subtotalInclIva-ivaSum,
      iva15: ivaSum,
      desc,
      total,
      totalSinDesc: +totalSinDesc.toFixed(2),
    };
  }, [rows]);

  // ======= Validación y envío =======
  function continuar(){
    if(isReadOnly){ return; }
    for (const r of rows) {
      if (r.cantidad === '' || Number(r.cantidad) <= 0) {
        alert('La cantidad es obligatoria y debe ser mayor a 0.');
        return;
      }
    }
    const clean = rows.map(r=>{
      const qty  = Number(r.cantidad)||0;
      const prc  = Number(r.precio)||0;
      const baseLinea = qty*prc; // con IVA
      const { amount: dscAmt } = parseDescuento(r.descuento, baseLinea);
      // 🔴 SIEMPRE enviamos monto numérico:
      return {
        producto_id: r.producto_id,
        nombre: r.nombre,
        codigo: r.codigo,
        cantidad: qty,
        precio: prc,
        descuento: dscAmt,     // ← monto, no porcentaje
        iva: Number(r.iva),
      };
    });
    router.put(
      route('admin.ventas.items.guardar', venta?.id ?? 'nueva'),
      { items: clean },
      { preserveScroll: true, preserveState: true }
    );
  }

  // ======= Navegación en celdas (↑ ↓ ← →) =======
  const COLS = ['cantidad','descuento','iva'];
  const refs = useRef([]);
  useEffect(()=>{
    refs.current = rows.map((_,i)=>(
      refs.current[i] && refs.current[i].length===COLS.length
        ? refs.current[i]
        : COLS.map(()=>React.createRef())
    ));
  }, [rows.length]);



  function focusCell(rIdx, cIdx){
    const r = (rIdx + rows.length) % rows.length;
    const c = (cIdx + COLS.length) % COLS.length;
    const el = refs.current?.[r]?.[c]?.current;
    if (el) { el.focus(); el.select?.(); }
  }

  function onCellKeyDown(e, rIdx, cIdx){
    if (e.key === 'Enter' && cIdx === 1) {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select?.();
      return;
    }
    if (e.key === 'ArrowUp')    { e.preventDefault(); focusCell(rIdx-1, cIdx); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusCell(rIdx+1, cIdx); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); focusCell(rIdx, cIdx-1); }
    else if (e.key === 'ArrowRight'){ e.preventDefault(); focusCell(rIdx, cIdx+1); }
  }

  // ======= NAV resultados: ↑/↓/Enter =======
  useEffect(() => {
    if (highlighted < 0) return;
    const el = itemRefs.current[highlighted];
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, res.length]);

  function onSearchChange(e){
    const v = e.target.value;
    setQ(v);
    setRes([]);
    setHighlighted(-1);
  }

  function onSearchKeyDown(e){
    if (isReadOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (res.length > 0 && highlighted >= 0 && q === lastSearched) {
        const p = res[highlighted];
        if (p) { add(p); return; }
      }
      buscar(q, true); // Auto add on Enter
      return;
    }
    if (!res.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlighted(h => (h + 1) % res.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlighted(h => (h - 1 + res.length) % res.length);
    }
  }

  function onListKeyDown(e){
    if (isReadOnly || !res.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHighlighted(h => (h + 1) % res.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHighlighted(h => (h - 1 + res.length) % res.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = res[highlighted >= 0 ? highlighted : 0];
      if (p) add(p);
    }
  }

  return (
    <AdminLayout title={venta?.id === 'nueva' ? 'Nueva Venta — Productos' : `Venta #${venta.id} — Productos`}>
      <Head title={venta?.id === 'nueva' ? 'Nueva Venta — Productos' : `Venta #${venta.id} — Productos`} />

      {isReadOnly && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <strong>Venta AUTORIZADA:</strong> esta pantalla está en <span className="font-semibold">solo lectura</span>. No se pueden modificar productos ni continuar a pagos.
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Cliente</p>
            <p className="text-base font-semibold text-slate-800">
              {cliente?.nombres} {cliente?.ci_o_ruc ? `— [${cliente.ci_o_ruc}]` : ''}
            </p>
          </div>
          <Link href={route('admin.ventas.vista_cliente', { venta: venta.id })} className="text-sm text-primary-700 hover:underline">Cambiar cliente</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              ref={searchRef}
              value={q}
              onChange={onSearchChange}
              onKeyDown={onSearchKeyDown}
              placeholder="Buscar producto por nombre o código"
              disabled={isReadOnly}
              className="w-full rounded-md border-slate-300 pl-9 focus:border-primary-500 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <button
            onClick={() => buscar(q, false)}
            disabled={isReadOnly}
            className={`rounded-md px-3 py-2 text-sm text-white ${
              isReadOnly ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            Buscar
          </button>
        </div>

        {res.length>0 && (
          <div className="mb-4 rounded-lg border border-slate-200">
            <ul
              ref={listRef}
              role="listbox"
              tabIndex={0}
              onKeyDown={onListKeyDown}
              className="max-h-72 overflow-auto divide-y divide-slate-100 focus:outline-none rounded-md"
            >
              {res.map((p, idx)=>(
                <li
                  key={p.id}
                  role="option"
                  aria-selected={idx===highlighted}
                  ref={el => (itemRefs.current[idx] = el)}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={[
                    'flex items-center justify-between px-3 py-2 cursor-pointer',
                    idx===highlighted ? 'bg-primary-50' : 'hover:bg-slate-50'
                  ].join(' ')}
                >
                  <div
                    className="min-w-0"
                    onClick={()=>!isReadOnly && setHighlighted(idx)}
                  >
                    <p className={`truncate text-sm font-medium ${idx===highlighted ? 'text-primary-800' : 'text-slate-800'}`}>{p.nombre}</p>
                    <p className="truncate text-xs text-slate-500">
                      <strong>{renderCodigo(p.codigo) || '—'}</strong> · PVP: {money(p.pvp||0)} · IVA: {p.iva ?? 15}% ·
                      Stock: {Number(p?.cantidad_total ?? p?.stock ?? p?.existencia ?? 0)}
                    </p>
                  </div>
                  <button
                    onClick={()=>add(p)}
                    disabled={isReadOnly}
                    className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                      isReadOnly
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <FiPlus/> Agregar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                <th>Código</th><th>Producto</th>
                <th className="text-right">Cant.</th>
                <th className="text-right">Precio</th>
                <th className="text-right">Desc. (valor o %)</th>
                <th className="text-right">IVA</th>
                <th className="text-right">Subtotal</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length===0 && (
                <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-500">Agrega productos.</td></tr>
              )}

              {rows.map((r,i)=>{
                const qty = Number(r.cantidad)||0;
                const price = Number(r.precio)||0;
                const baseLinea = qty * price; // con IVA
                const { amount: dscAmt, pct: dscPct, mode } = parseDescuento(r.descuento, baseLinea);
                const sub = Math.max(0, baseLinea - dscAmt);
                const maxQty = Number(r.cantidad_total ?? Infinity);

                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2"><strong>{renderCodigo(r.codigo) || r.codigo||'—'}</strong></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate">{r.nombre||'—'}</span>
                        {isFinite(maxQty) && (
                          <span className="text-xs text-slate-500">· Stock: {maxQty}</span>
                        )}
                        {isFinite(maxQty) && qty > maxQty && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" title="Supera stock disponible">
                            ⚠️ Supera stock disponible ({maxQty})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cantidad */}
                    <td className="px-3 py-2 text-right">
                      <input
                        ref={el=>{ if(!refs.current[i]) refs.current[i]=COLS.map(()=>({current:null})); refs.current[i][0].current=el; }}
                        type="number"
                        min="1"
                        step="1"
                        value={r.cantidad}
                        onChange={e=>setCantidad(i,e.target.value)}
                        onBlur={()=>clampCantidadOnBlur(i)}
                        onKeyDown={(e)=>onCellKeyDown(e,i,0)}
                        placeholder=""
                        required
                        disabled={isReadOnly}
                        className="w-28 rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </td>

                    {/* Precio (fijo) */}
                    <td className="px-3 py-2 text-right">{money(r.precio)}</td>

                    {/* Descuento */}
                    <td className="px-3 py-2 text-right">
                      <input
                        ref={el=>{ if(!refs.current[i]) refs.current[i]=COLS.map(()=>({current:null})); refs.current[i][1].current=el; }}
                        type="text"
                        inputMode="decimal"
                        value={r.descuento}
                        onChange={e=>setField(i,'descuento',e.target.value)}
                        onBlur={()=>clampDescuentoOnBlur(i)}
                        onKeyDown={(e)=>onCellKeyDown(e,i,1)}
                        placeholder="ej. 3 o 12%"
                        required
                        disabled={isReadOnly}
                        className="w-28 rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      {!!baseLinea && r.descuento && mode!=='invalid' && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          {mode==='percent'
                            ? <>≈ {money(dscAmt)} de descuento</>
                            : <>≈ {dscPct}% de descuento</>}
                        </div>
                      )}
                    </td>

                    {/* IVA */}
                    <td className="px-3 py-2 text-right">
                      <select
                        ref={el=>{ if(!refs.current[i]) refs.current[i]=COLS.map(()=>({current:null})); refs.current[i][2].current=el; }}
                        value={r.iva}
                        onChange={e=>setField(i,'iva',e.target.value)}
                        onKeyDown={(e)=>onCellKeyDown(e,i,2)}
                        disabled={isReadOnly}
                        className="w-20 rounded border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value={15}>15%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>

                    <td className="px-3 py-2 text-right">{money(sub)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={()=>del(i)}
                        disabled={isReadOnly}
                        className={`rounded-md px-2 py-1 text-xs text-white ${
                          isReadOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        <FiTrash2/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-end gap-2">
          <div className="w-full max-w-sm">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total sin descuento (con IVA)</span>
              <span className="font-medium">{money(tot.totalSinDesc)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total descuento</span>
              <span className="font-medium">- {money(tot.desc)}</span>
            </div>

            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-500">Subtotal (con IVA)</span>
              <span className="font-medium">{money(tot.subtotal)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">IVA (desglosado)</span>
              <span className="font-medium">{money(tot.iva15)}</span>
            </div>

            <div className="mt-1 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{money(tot.total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={route('admin.ventas.vista_cliente', { venta: venta.id })}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Regresar al paso anterior
            </Link>
            <button
              onClick={continuar}
              disabled={isReadOnly || rows.length===0}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white ${
                isReadOnly ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
              } disabled:opacity-60`}
              title={isReadOnly ? 'Venta autorizada: solo lectura' : 'Guardar y continuar a pagos'}
            >
              {isReadOnly ? 'Solo lectura' : 'Guardar y continuar a pagos'} <FiArrowRight/>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
