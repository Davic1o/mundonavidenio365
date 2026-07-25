import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';

/**
 * SearchableSelect: Un select con búsqueda integrada que restringe a las opciones dadas.
 */
export default function SearchableSelect({ 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Seleccionar...',
  className = '',
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch(''); // Limpiar búsqueda al cerrar
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDisplay = value || '';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => !disabled && setOpen(!open)}
        className={[
          'w-full flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm transition',
          disabled ? 'bg-slate-50 cursor-not-allowed text-slate-500' : 'bg-white cursor-pointer focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500'
        ].join(' ')}
      >
        <span className={!selectedDisplay ? 'text-slate-400' : 'text-slate-900'}>
          {selectedDisplay || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
            >
              <FiX className="w-3 h-3" />
            </button>
          )}
          <FiChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              placeholder="Escribe para filtrar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border-slate-200 text-sm focus:border-primary-500 focus:ring-primary-500 p-2"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => (
                <li
                  key={idx}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={[
                    'px-3 py-2 text-sm cursor-pointer transition',
                    value === opt ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  ].join(' ')}
                >
                  {opt}
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-slate-500 italic">No hay resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
