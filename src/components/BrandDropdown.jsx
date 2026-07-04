import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useBrands } from '../hooks/useBrands';

const defaultComboboxCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623] transition-colors";
const defaultSelectCls = "bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1a1a2e] outline-none focus:border-[#F5A623]";

// Single-select brand picker backed by the shared /settings/brands list, so "BIC"
// never ends up duplicated as "Bic" across products. Used in two shapes: a
// searchable combobox with inline create (product form) and a plain <select>
// for filter bars (POS products list, storefront category filter).
export default function BrandDropdown({
  value,
  onChange,
  mode = 'combobox', // 'combobox' | 'select'
  allowCreate = true,
  placeholder = 'Rechercher ou ajouter une marque...',
  emptyOptionLabel = 'Toutes les marques',
  className = '',
}) {
  const { brands, addBrand } = useBrands();

  if (mode === 'select') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={className || defaultSelectCls}>
        <option value="">{emptyOptionLabel}</option>
        {brands.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    );
  }

  return (
    <BrandCombobox
      value={value}
      onChange={onChange}
      allowCreate={allowCreate}
      placeholder={placeholder}
      className={className}
      brands={brands}
      addBrand={addBrand}
    />
  );
}

function BrandCombobox({ value, onChange, allowCreate, placeholder, className, brands, addBrand }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputCls = className || defaultComboboxCls;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = brands.filter(b => !search.trim() || b.toLowerCase().includes(search.trim().toLowerCase()));

  function select(b) {
    onChange(b);
    setSearch('');
    setOpen(false);
  }

  async function createAndSelect() {
    const name = search.trim();
    if (!name) return;
    await addBrand(name);
    select(name);
  }

  if (value) {
    return (
      <div className="relative">
        <input value={value} readOnly className={`${inputCls} pr-9`} />
        <button type="button" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#ef4444]">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
          {filtered.map(b => (
            <button
              key={b}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(b); }}
              className="w-full text-left px-3 py-2 text-[13px] text-[#1a1a2e] hover:bg-gray-50"
            >
              {b}
            </button>
          ))}
          {allowCreate && search.trim() && !brands.some(b => b.toLowerCase() === search.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); createAndSelect(); }}
              className="w-full text-left px-3 py-2 text-[13px] text-[#2563eb] font-semibold hover:bg-[#eff6ff] flex items-center gap-1.5 border-t border-gray-100"
            >
              <Plus size={12} /> Créer "{search.trim()}"
            </button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div className="px-3 py-2.5 text-[12px] text-gray-400">
              {brands.length === 0 ? 'Aucune marque pour le moment' : 'Tapez pour rechercher'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
