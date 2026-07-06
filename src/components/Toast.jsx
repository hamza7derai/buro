import { useState, createContext, useContext, useCallback, useRef } from 'react';

const ToastContext = createContext();
const DISPLAY_MS = 2800;
const ANIM_MS = 200;

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const displayTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const show = useCallback((message, type = 'success') => {
    clearTimeout(displayTimerRef.current);
    clearTimeout(leaveTimerRef.current);
    setLeaving(false);
    setToast({ message, type });
    displayTimerRef.current = setTimeout(() => {
      setLeaving(true);
      leaveTimerRef.current = setTimeout(() => setToast(null), ANIM_MS);
    }, DISPLAY_MS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium border ${leaving ? 'animate-slideOut' : 'animate-slideUp'}
          ${toast.type === 'success' ? 'bg-surface-3 border-success/50 text-success' : ''}
          ${toast.type === 'error' ? 'bg-surface-3 border-danger/50 text-danger' : ''}
          ${toast.type === 'info' ? 'bg-surface-3 border-brand-500/50 text-brand-500' : ''}
        `}>
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(20px, 20px); opacity: 0; }
          to { transform: translate(0, 0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translate(0, 0); opacity: 1; }
          to { transform: translate(20px, 20px); opacity: 0; }
        }
        .animate-slideUp { animation: slideUp 0.2s ease-out; }
        .animate-slideOut { animation: slideOut 0.2s ease-in forwards; }
      `}</style>
    </ToastContext.Provider>
  );
}
