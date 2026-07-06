import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';

// Filter trigger button — outlined, shows a small blue badge with the active filter count.
export function FilterTriggerButton({ count = 0, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 border border-bord rounded-lg px-3.5 py-2 text-[12px] font-medium text-txt-1 bg-surface-1 hover:bg-surface-2 transition-colors shrink-0 ${className}`}
    >
      <SlidersHorizontal size={14} />
      Filtres
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue text-white text-[10px] font-bold leading-none">
          {count}
        </span>
      )}
    </button>
  );
}

// Removable chip for an applied filter, shown below the filter row when the panel is closed.
export function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-light text-blue text-[11px] font-medium rounded-full pl-3 pr-1.5 py-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="w-4 h-4 rounded-full hover:bg-blue/20 flex items-center justify-center"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// Collapsible labeled section used inside the filter panel body.
export function FilterSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-bord pb-4 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between mb-3"
      >
        <span className="text-[13px] font-semibold text-txt-1">{title}</span>
        <ChevronDown size={16} className={`text-txt-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

// Right-side panel on desktop (1024px+), bottom sheet on mobile — both with an overlay.
export default function FilterPanel({ open, onClose, onReset, resultCount, resultLabel = 'produits', children }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:items-stretch justify-center lg:justify-end" onClick={onClose}>
      <div
        className="filter-panel-anim bg-white w-full lg:w-[300px] h-[80vh] lg:h-full rounded-t-2xl lg:rounded-none flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="lg:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <span className="w-10 h-1 rounded-full bg-bord" />
        </button>
        <div className="flex items-center justify-between px-5 py-4 border-b border-bord shrink-0">
          <h2 className="text-[15px] font-bold text-txt-1">Filtres</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-txt-2"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {children}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-bord shrink-0 bg-white">
          <button type="button" onClick={onReset} className="text-[13px] font-medium text-txt-2 hover:text-txt-1 shrink-0">
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 max-w-[200px] bg-blue text-white text-[13px] font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Voir {resultCount} {resultLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
