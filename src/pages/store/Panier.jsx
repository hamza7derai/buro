import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingCart, Tag, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../lib/pricing';
import { DELIVERY_FEE } from '../../lib/checkoutPricing';
import CachedImage from '../../components/CachedImage';
import PageTransition from '../../components/PageTransition';

export default function Panier() {
  const {
    cartItems, removeFromCart, updateQuantity, cartTotal, cartCount,
    discountCode, discountAmount, applyDiscountCode, removeDiscountCode,
  } = useCart();
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  function handleApplyCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    const ok = applyDiscountCode(codeInput);
    setCodeError(ok ? '' : 'Code promo invalide');
    if (ok) setCodeInput('');
  }

  if (cartItems.length === 0) {
    return (
      <PageTransition className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <ShoppingCart size={40} className="text-txt-3" />
        <h1 className="text-lg font-bold text-txt-1">Votre panier est vide</h1>
        <p className="text-[13px] text-txt-2 max-w-xs">Parcourez nos catégories pour trouver vos fournitures, manuels et accessoires.</p>
        <Link to="/" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Voir nos produits
        </Link>
      </PageTransition>
    );
  }

  const deliveryFee = DELIVERY_FEE;

  return (
    <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <h1 className="text-xl font-bold text-txt-1">
        Mon panier <span className="text-txt-3 font-medium text-[14px]">({cartCount} article{cartCount > 1 ? 's' : ''})</span>
      </h1>

      <div className="flex flex-col gap-3">
        {cartItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-1 border border-bord rounded-2xl p-3">
            <div className="w-16 h-16 rounded-xl bg-surface-2 border border-bord overflow-hidden shrink-0">
              {item.image && <CachedImage src={item.image} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-txt-1 truncate">{item.name}</div>
              {item.variantLabel && <div className="text-[11px] text-txt-2">{item.variantLabel}</div>}
              <div className="text-[12px] font-mono text-txt-2 mt-0.5">{formatPrice(item.price)}</div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => updateQuantity(i, item.qty - 1)} className="w-6 h-6 rounded-lg bg-surface-2 border border-bord flex items-center justify-center text-txt-2 hover:text-txt-1">
                  <Minus size={12} />
                </button>
                <span className="text-[13px] font-mono w-5 text-center">{item.qty}</span>
                <button onClick={() => updateQuantity(i, item.qty + 1)} className="w-6 h-6 rounded-lg bg-surface-2 border border-bord flex items-center justify-center text-txt-2 hover:text-txt-1">
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end justify-between h-full gap-3">
              <button onClick={() => removeFromCart(i)} className="text-txt-3 hover:text-danger">
                <Trash2 size={16} />
              </button>
              <span className="font-mono font-bold text-navy text-[14px]">{formatPrice(item.price * item.qty)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Discount code */}
      <div className="bg-surface-1 border border-bord rounded-2xl p-4">
        {discountCode ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-success font-medium">
              <Tag size={14} /> Code <span className="font-mono">{discountCode}</span> appliqué
            </span>
            <button onClick={removeDiscountCode} className="text-txt-3 hover:text-danger">
              <X size={14} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyCode} className="flex gap-2">
            <input
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
              placeholder="Code promo"
              className="flex-1 bg-surface-2 border border-bord rounded-lg px-3 py-2.5 text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3"
            />
            <button type="submit" className="bg-surface-3 text-txt-1 text-[13px] font-semibold px-4 rounded-lg hover:bg-bord transition-colors">
              Appliquer
            </button>
          </form>
        )}
        {codeError && <p className="text-[11px] text-danger mt-2">{codeError}</p>}
      </div>

      <div className="bg-surface-1 border border-bord rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[13px] text-txt-2">
          <span>Sous-total</span>
          <span className="font-mono text-txt-1">{formatPrice(cartTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px] text-txt-2">
          <span>Livraison</span>
          <span className="font-mono text-txt-1">{deliveryFee === 0 ? 'Gratuit' : formatPrice(deliveryFee)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-txt-2">Remise</span>
            <span className="font-mono text-danger">-{formatPrice(discountAmount)}</span>
          </div>
        )}
        <div className="h-px bg-bord" />
        <div className="flex items-center justify-between text-[15px] font-bold">
          <span className="text-txt-1">Total TTC</span>
          <span className="font-mono text-navy">{formatPrice(cartTotal - discountAmount + deliveryFee)}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          <Link to="/" className="flex-1 text-center bg-surface-3 text-txt-1 text-[13px] font-semibold py-3 rounded-xl hover:bg-bord transition-colors">
            Continuer mes achats
          </Link>
          <Link to="/checkout" className="flex-1 text-center bg-blue text-white text-[14px] font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
            Commander
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
