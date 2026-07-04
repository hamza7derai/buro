import { useState, useRef } from 'react';
import { Camera, X, Search } from 'lucide-react';
import Thumb from './Thumb';

export const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623] transition-colors";

export function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-[13px] font-bold text-[#1a1a2e] uppercase tracking-wider mb-1">{title}</h2>
      <div className="h-px bg-gray-100 mb-5" />
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="flex-1">
      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[#F5A623]' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow ${checked ? 'translate-x-4.5' : ''}`} />
      </button>
      {label && <span className="text-[13px] text-[#1a1a2e]">{label}</span>}
    </label>
  );
}

export function Pill({ active, onClick, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
        active
          ? (danger ? 'bg-[#ef4444]/15 border-[#ef4444] text-[#ef4444]' : 'bg-[#F5A623]/15 border-[#F5A623] text-[#F5A623]')
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-[#1a1a2e]'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipInput({ values, onAdd, onRemove, placeholder }) {
  const [text, setText] = useState('');
  function submit() {
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
  }
  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2">
      {values.map((v, i) => (
        <span key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-[12px] text-[#1a1a2e]">
          {v}
          <button type="button" onClick={() => onRemove(i)} className="text-gray-400 hover:text-[#ef4444]"><X size={11} /></button>
        </span>
      ))}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        className="flex-1 min-w-[100px] bg-transparent text-[13px] text-[#1a1a2e] outline-none py-1 placeholder:text-gray-400"
      />
    </div>
  );
}

export function Dropzone({ src, onFile, uploading, progress, large, onRemove }) {
  const inputRef = useRef(null);
  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }
  if (src) {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-gray-200 ${large ? 'h-48' : 'h-24'}`}>
        <img src={src} alt="" className="w-full h-full object-cover" />
        {onRemove && (
          <button type="button" onClick={onRemove} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
            <X size={13} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      className={`rounded-xl border-2 border-dashed border-gray-300 hover:border-[#F5A623] bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${large ? 'h-48' : 'h-24'}`}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      {uploading ? (
        <span className="text-[12px] text-gray-500 font-mono">{progress}%</span>
      ) : (
        <>
          <Camera size={large ? 26 : 18} strokeWidth={1.5} className="text-gray-400" />
          {large && <span className="text-[12px] text-gray-400 text-center px-4">Glissez une image ou cliquez pour parcourir</span>}
        </>
      )}
    </div>
  );
}

export function ProductPicker({ allProducts, excludeId, selectedIds, onAdd, onRemove, placeholder }) {
  const [search, setSearch] = useState('');
  const matches = search.trim()
    ? allProducts.filter(p => p.id !== excludeId && !selectedIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];
  const selected = allProducts.filter(p => selectedIds.includes(p.id));
  return (
    <div>
      <div className="relative">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
          <Search size={15} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[14px] text-[#1a1a2e] outline-none placeholder:text-gray-400"
          />
        </div>
        {matches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-[200px] overflow-y-auto">
            {matches.map(p => (
              <div
                key={p.id}
                onClick={() => { onAdd(p.id); setSearch(''); }}
                className="px-3 py-2 text-[13px] text-[#1a1a2e] cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                {p.name}
              </div>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-1 text-[12px] text-[#1a1a2e]">
              <Thumb src={p.mainImage} className="w-5 h-5" />
              {p.name}
              <button type="button" onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-[#ef4444]"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
