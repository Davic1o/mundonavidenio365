import React, { useEffect, useRef, useState } from 'react';

/**
 * AutoComplete reutilizable (busca con GET ?q=... usando ziggy route()).
 *
 * Props:
 * - searchRouteName: string (nombre de la ruta Ziggy, ej. "admin.productos.buscar")
 * - initialItems: array inicial opcional (para primer render)
 * - formatItem: fn(item) => string (cómo mostrar cada opción)
 * - onSelect: fn(item) (devuelve el objeto seleccionado)
 * - defaultText: string (texto inicial mostrado en el input)
 * - placeholder: string
 * - disabled: boolean
 * - queryParam: string (por defecto "q")
 * - debounceMs: number (por defecto 250)
 * - minChars: number (0 = busca incluso vacío)
 * - className: string (clases extra para el input)
 */
export default function AutoComplete({
  inputRef,
  searchRouteName,
  initialItems = [],
  formatItem = (it) => String(it?.nombre ?? ''),
  onSelect,
  onEnterKey,
  defaultText = '',
  placeholder = 'Buscar…',
  disabled = false,
  queryParam = 'q',
  debounceMs = 250,
  minChars = 0,
  className = '',
}) {
  const [input, setInput] = useState(defaultText);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => { setInput(defaultText || ''); }, [defaultText]);

  // cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // fetch con debounce cuando cambia el input o se abre
  useEffect(() => {
    if (disabled || !open) return;
    const q = input.trim();
    if (q.length < minChars) {
      setItems(initialItems);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      const params = { [queryParam]: q };
      fetch(route(searchRouteName, params), { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : [])
        .then(json => setItems(Array.isArray(json) ? json : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, debounceMs);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [input, open, disabled, searchRouteName, queryParam, debounceMs, minChars, initialItems]);

  function pick(it) {
    onSelect?.(it);
    setInput(formatItem(it));
    setOpen(false);
    setHi(-1);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHi((i) => Math.min(i + 1, items.length - 1));
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHi((i) => Math.max(i - 1, 0));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && hi >= 0 && items[hi]) {
        pick(items[hi]);
      } else if (open && items.length > 0) {
        pick(items[0]);
      } else {
        setOpen(false);
        onEnterKey?.();
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
  }

  return (
    <div className="relative" ref={boxRef} data-autocomplete="true">
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={[
          'w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500',
          className
        ].join(' ')}
      />

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border border-slate-200 bg-white shadow">
          {loading && <div className="px-3 py-2 text-sm text-slate-500">Buscando…</div>}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">Sin resultados</div>
          )}
          {!loading && items.map((it, idx) => {
            const active = idx === hi;
            return (
              <button
                type="button"
                key={it.id ?? idx}
                onMouseEnter={() => setHi(idx)}
                onMouseLeave={() => setHi(-1)}
                onClick={() => pick(it)}
                className={[
                  'w-full text-left px-3 py-2 text-sm',
                  active ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'
                ].join(' ')}
              >
                {formatItem(it)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
