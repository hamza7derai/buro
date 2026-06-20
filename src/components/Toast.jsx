import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext();

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const show = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium border animate-slideUp
          ${toast.type === 'success' ? 'bg-surface-3 border-success/50 text-success' : ''}
          ${toast.type === 'error' ? 'bg-surface-3 border-danger/50 text-danger' : ''}
          ${toast.type === 'info' ? 'bg-surface-3 border-brand-500/50 text-brand-500' : ''}
        `}>
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.25s ease; }
      `}</style>
    </ToastContext.Provider>
  );
}
