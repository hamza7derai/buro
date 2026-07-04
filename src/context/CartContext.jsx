import { createContext, useContext, useState, useEffect } from 'react';
import { getPrice } from '../lib/pricing';
import { DISCOUNT_CODES } from '../lib/checkoutPricing';

const CartContext = createContext(null);
const STORAGE_KEY = 'younasser_store_cart';
const DISCOUNT_KEY = 'younasser_store_discount';

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadDiscountCode() {
  try {
    return localStorage.getItem(DISCOUNT_KEY) || '';
  } catch {
    return '';
  }
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(loadCart);
  const [discountCode, setDiscountCode] = useState(loadDiscountCode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (discountCode) localStorage.setItem(DISCOUNT_KEY, discountCode);
    else localStorage.removeItem(DISCOUNT_KEY);
  }, [discountCode]);

  function addToCart(product, variant = null, quantity = 1, priceOverride = null) {
    const { price: basePrice, oldPrice } = getPrice(product, variant);
    const price = priceOverride ?? basePrice;
    setCartItems(prev => {
      const idx = prev.findIndex(i => i.productId === product.id && i.variantId === (variant?.id || null));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + quantity };
        return next;
      }
      return [...prev, {
        productId: product.id,
        variantId: variant?.id || null,
        slug: product.slug,
        name: product.name,
        variantLabel: variant?.label || '',
        image: variant?.image || product.mainImage || '',
        price,
        oldPrice,
        stock: variant?.stock ?? product.totalStock ?? 0,
        qty: quantity,
      }];
    });
  }

  function removeFromCart(itemIndex) {
    setCartItems(prev => prev.filter((_, i) => i !== itemIndex));
  }

  function updateQuantity(itemIndex, quantity) {
    setCartItems(prev => {
      if (quantity <= 0) return prev.filter((_, i) => i !== itemIndex);
      return prev.map((item, i) => i === itemIndex ? { ...item, qty: quantity } : item);
    });
  }

  function clearCart() {
    setCartItems([]);
    setDiscountCode('');
  }

  function applyDiscountCode(code) {
    const upper = code.trim().toUpperCase();
    if (!DISCOUNT_CODES[upper]) return false;
    setDiscountCode(upper);
    return true;
  }

  function removeDiscountCode() {
    setDiscountCode('');
  }

  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const discountPercent = DISCOUNT_CODES[discountCode] || 0;
  const discountAmount = Math.round(cartTotal * discountPercent) / 100;

  return (
    <CartContext.Provider value={{
      cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount,
      discountCode, discountPercent, discountAmount, applyDiscountCode, removeDiscountCode,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
