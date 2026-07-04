import { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'younasser_pos_cart';
const POSCartContext = createContext(null);

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function POSCartProvider({ children }) {
  const saved = loadSaved();

  const [cart, setCart] = useState(saved?.cart || []);
  const [selectedClient, setSelectedClient] = useState(saved?.selectedClient || null);
  const [payType, setPayType] = useState(saved?.payType || 'Espèce');
  const [remiseGlobalDH, setRemiseGlobalDH] = useState(saved?.remiseGlobalDH || 0);
  const [montantRecu, setMontantRecu] = useState(saved?.montantRecu || '');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cart, selectedClient, payType, remiseGlobalDH, montantRecu,
    }));
  }, [cart, selectedClient, payType, remiseGlobalDH, montantRecu]);

  function addToCart(item) {
    setCart(prev => {
      const key = item.productId + (item.variantId || '');
      const existing = prev.find(c => (c.productId + (c.variantId || '')) === key);
      if (existing) {
        return prev.map(c =>
          (c.productId + (c.variantId || '')) === key
            ? { ...c, qty: c.qty + 1 }
            : c
        );
      }
      return [...prev, { ...item, qty: 1, remise: 0 }];
    });
  }

  function removeItem(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  function changeQty(index, delta) {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: updated[index].qty + delta };
      if (updated[index].qty <= 0) updated.splice(index, 1);
      return updated;
    });
  }

  function setItemRemise(index, remise) {
    setCart(prev => prev.map((item, i) => i === index ? { ...item, remise } : item));
  }

  function clearCart() {
    setCart([]);
    setSelectedClient(null);
    setRemiseGlobalDH(0);
    setMontantRecu('');
    setPayType('Espèce');
  }

  // Load a saved/suspended draft into the cart
  function loadDraft(draft) {
    setCart(draft.cart || []);
    setSelectedClient(draft.clientId ? {
      id: draft.clientId,
      name: draft.clientName,
      phone: draft.clientPhone,
      ice: draft.clientICE,
      type: draft.clientType,
    } : null);
    setRemiseGlobalDH(draft.remiseGlobalDH || 0);
    setPayType(draft.payType || 'Espèce');
    setMontantRecu(draft.montantRecu || '');
  }

  const value = {
    cart, selectedClient, payType, remiseGlobalDH, montantRecu,
    setSelectedClient, setPayType, setRemiseGlobalDH, setMontantRecu,
    addToCart, removeItem, changeQty, setItemRemise, clearCart, loadDraft,
  };

  return (
    <POSCartContext.Provider value={value}>
      {children}
    </POSCartContext.Provider>
  );
}

export function usePOSCart() {
  return useContext(POSCartContext);
}
