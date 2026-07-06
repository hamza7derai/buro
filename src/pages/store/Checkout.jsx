import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Truck, Store, Banknote, CreditCard, Tag, Lock, MapPin,
  User, Phone, Info, MessageCircle, ShoppingBag, CheckCircle2, Package, ArrowRight,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useProducts } from '../../hooks/useProducts';
import { useToast } from '../../components/Toast';
import { db } from '../../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { formatPrice } from '../../lib/pricing';
import { buildWhatsAppLink } from '../../lib/contact';
import CachedImage from '../../components/CachedImage';
import PageTransition from '../../components/PageTransition';

const DELIVERY_FEE_HOME = 15;
const STORE_MAP_URL = 'https://maps.app.goo.gl/SHTiuNtk8TmxqNtu5';
const STORE_FULL_ADDRESS = 'Magaz N°1, N°40, Quartier Industriel Syba, Marrakech';

const STEP_CONFIG = [
  { n: 1, label: 'Livraison',    sublabel: 'Mode et adresse de livraison' },
  { n: 2, label: 'Paiement',     sublabel: 'Mode de paiement' },
  { n: 3, label: 'Confirmation', sublabel: 'Vérifier et confirmer' },
];

// ── localStorage helpers ─────────────────────────────────────────────────────

function loadSaved() {
  try {
    const phone = localStorage.getItem('younasser_profile_phone') || '';
    if (phone) {
      const p = JSON.parse(localStorage.getItem(`younasser_profile_${phone}`) || '{}');
      return { phone, name: p.name || '', addressNote: p.addressNote || '', gpsCoords: p.gpsCoords || null };
    }
    const info = JSON.parse(localStorage.getItem('younasser_checkout_info') || '{}');
    return { phone: info.phone || '', name: info.name || '', addressNote: info.addressNote || '', gpsCoords: info.gpsCoords || null };
  } catch { return { phone: '', name: '', addressNote: '', gpsCoords: null }; }
}

function persistCheckoutInfo({ phone, name, addressNote, gpsCoords }) {
  try {
    localStorage.setItem('younasser_checkout_info', JSON.stringify({ phone, name, addressNote, gpsCoords }));
    if (phone) {
      const existing = JSON.parse(localStorage.getItem(`younasser_profile_${phone}`) || '{}');
      localStorage.setItem(`younasser_profile_${phone}`, JSON.stringify({ ...existing, name, addressNote, gpsCoords }));
      localStorage.setItem('younasser_profile_phone', phone);
      window.dispatchEvent(new Event('younasser-profile-updated'));
    }
  } catch { /* ignore */ }
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Checkout() {
  const { cartItems, cartTotal, cartCount, discountCode, discountAmount, clearCart } = useCart();
  const { deductStock } = useProducts();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [errors, setErrors] = useState({});

  // Pre-fill from localStorage (lazy init — runs once on mount)
  const [saved] = useState(loadSaved);
  const [deliveryMethod, setDeliveryMethod] = useState('home');
  const [gpsCoords, setGpsCoords] = useState(saved.gpsCoords);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsShared, setGpsShared] = useState(!!saved.gpsCoords);
  const [name, setName] = useState(saved.name);
  const [phone, setPhone] = useState(saved.phone);
  const [addressNote, setAddressNote] = useState(saved.addressNote);
  const [promoInput, setPromoInput] = useState('');

  const deliveryFee = deliveryMethod === 'pickup' ? 0 : DELIVERY_FEE_HOME;
  const total = cartTotal - (discountAmount || 0) + deliveryFee;

  function shareGPS() {
    if (!navigator.geolocation) {
      toast('La géolocalisation n\'est pas supportée sur ce navigateur.', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setGpsShared(true);
        setGpsLoading(false);
        setErrors(e => ({ ...e, location: undefined }));
      },
      () => {
        toast('Impossible d\'accéder à votre position. Vérifiez les permissions du navigateur.', 'error');
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateStep1() {
    const errs = {};
    if (name.trim().length < 2) errs.name = 'Veuillez saisir votre nom (min. 2 caractères).';
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Numéro invalide (min. 10 chiffres).';
    if (deliveryMethod === 'home' && !gpsShared && !addressNote.trim()) {
      errs.location = 'Partagez votre position GPS ou saisissez un complément d\'adresse.';
    }
    return errs;
  }

  function handleContinueStep1() {
    const errs = validateStep1();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const orderNumber = 'CMD-' + Date.now().toString().slice(-6);
      const orderItems = cartItems.map(i => ({
        productId: i.productId,
        variantId: i.variantId || null,
        name: i.name,
        variantLabel: i.variantLabel || '',
        image: i.image || '',
        quantity: i.qty,
        unitPrice: i.price,
        totalPrice: i.price * i.qty,
      }));

      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, {
        orderNumber,
        clientName: name.trim(),
        clientPhone: phone.trim(),
        deliveryMethod,
        deliveryFee,
        gpsCoords: gpsCoords || null,
        addressNote: addressNote.trim(),
        paymentMethod: 'cod',
        promoCode: promoInput.trim() || null,
        discountCode: discountCode || null,
        discountAmount: discountAmount || 0,
        items: orderItems,
        itemsCount: cartCount,
        subtotal: cartTotal,
        total,
        status: 'pending',
        source: 'store',
        createdAt: serverTimestamp(),
      });

      // Order is saved — show success immediately
      const orderData = { orderNumber, total };
      persistCheckoutInfo({ phone: phone.trim(), name: name.trim(), addressNote, gpsCoords });
      setOrder(orderData);
      setStep('success');
      clearCart();

      // Stock deduction is a best-effort fire-and-forget from the storefront.
      // Unauthenticated users cannot write to products — admin handles stock
      // when processing the order. Failure here is silent and expected.
      deductStock(cartItems).catch(() => {});

    } catch (err) {
      console.error('Checkout error:', err);
      toast('Erreur lors de la confirmation. Veuillez réessayer.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Empty cart guard ───────────────────────────────────────────────────────

  if (cartItems.length === 0 && step !== 'success') {
    return (
      <PageTransition className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <ShoppingBag size={40} className="text-txt-3" />
        <h1 className="text-lg font-bold text-txt-1">Votre panier est vide</h1>
        <p className="text-[13px] text-txt-2 max-w-xs">Ajoutez des articles avant de passer commande.</p>
        <Link to="/" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Voir nos produits
        </Link>
      </PageTransition>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (step === 'success' && order) {
    return (
      <PageTransition className="flex flex-col items-center text-center gap-6 px-4 py-16 max-w-sm mx-auto">
        <span className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 size={48} className="text-success" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-navy">Commande confirmée !</h1>
          <p className="font-mono font-bold text-[20px] text-blue tracking-wide">{order.orderNumber}</p>
          <p className="text-[13px] text-txt-2 leading-relaxed mt-1">
            Votre commande sera préparée et livrée sous <strong>24 à 48h</strong>.
          </p>
          <p className="text-[13px] text-txt-2">
            Un récapitulatif a été enregistré dans votre espace.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <Link
            to="/profil"
            className="flex items-center justify-center gap-2 bg-blue text-white text-[14px] font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Suivre ma commande <ArrowRight size={16} />
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 bg-surface-1 border border-bord text-txt-1 text-[14px] font-semibold px-6 py-3.5 rounded-xl hover:bg-surface-2 transition-colors"
          >
            Continuer mes achats
          </Link>
        </div>

        <a
          href={buildWhatsAppLink(`Bonjour, j'ai une question sur ma commande ${order.orderNumber}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[13px] text-[#25D366] font-medium hover:underline"
        >
          <MessageCircle size={15} /> Une question ? Contactez-nous sur WhatsApp
        </a>
      </PageTransition>
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  return (
    <PageTransition className="flex flex-col gap-6 px-4 lg:px-0 py-4 max-w-2xl lg:max-w-none lg:mx-auto">

      <StepBar step={step} />

      {/* ── STEP 1 — LIVRAISON ── */}
      {step === 1 && (
        <div className="bg-white border border-bord rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <StepBadge n={1} />
            <div>
              <h2 className="text-[16px] font-bold text-navy">Livraison</h2>
              <p className="text-[12px] text-txt-2">Sélectionnez votre mode de livraison et renseignez vos coordonnées.</p>
            </div>
          </div>

          {/* Delivery mode cards */}
          <div className="grid grid-cols-2 gap-3">
            <DeliveryCard
              selected={deliveryMethod === 'home'}
              onClick={() => { setDeliveryMethod('home'); setErrors({}); }}
              icon={Truck}
              title="Livraison à domicile"
              price="15,00 DH"
              priceClass="text-blue"
              sub="Partout à Marrakech"
            />
            <DeliveryCard
              selected={deliveryMethod === 'pickup'}
              onClick={() => { setDeliveryMethod('pickup'); setErrors({}); }}
              icon={Store}
              title="Retrait en magasin"
              price="Gratuit"
              priceClass="text-success"
              sub="younasser, Marrakech"
            />
          </div>

          {/* Name + Phone — always visible */}
          <div className="grid grid-cols-2 gap-3">
            <InputField
              icon={User}
              placeholder="Votre nom *"
              value={name}
              onChange={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
              error={errors.name}
            />
            <InputField
              icon={Phone}
              placeholder="06 12 34 56 78 *"
              value={phone}
              onChange={v => { setPhone(v); setErrors(e => ({ ...e, phone: undefined })); }}
              type="tel"
              error={errors.phone}
            />
          </div>

          {/* Home delivery extras */}
          {deliveryMethod === 'home' && (
            <>
              {/* GPS */}
              <div className="bg-[#eff6ff] rounded-xl p-4 flex flex-col gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-navy">Position de livraison</div>
                  <div className="text-[12px] text-navy/70 mt-0.5">Partagez votre GPS pour une livraison précise.</div>
                </div>
                {gpsShared ? (
                  <div className="flex items-center gap-2 bg-blue/10 border border-blue/20 text-blue rounded-lg px-3 py-2.5">
                    <MapPin size={16} className="shrink-0" />
                    <span className="text-[13px] font-medium">Position enregistrée — Nous livrerons à l'adresse indiquée.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={shareGPS}
                    disabled={gpsLoading}
                    className="flex items-center justify-center gap-2 bg-blue text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    <MapPin size={15} />
                    {gpsLoading ? 'Localisation en cours...' : 'Partager ma position GPS'}
                  </button>
                )}
              </div>

              {/* Address complement */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Info size={15} className="absolute left-3 top-3 text-txt-3 pointer-events-none" />
                  <textarea
                    value={addressNote}
                    onChange={e => { setAddressNote(e.target.value); setErrors(errs => ({ ...errs, location: undefined })); }}
                    placeholder="Complément d'adresse — Ex: Immeuble Atlas, 3ème étage, porte verte..."
                    rows={3}
                    className={`w-full pl-9 pr-3 py-3 bg-surface-1 border rounded-xl text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3 resize-none ${errors.location ? 'border-danger' : 'border-bord'}`}
                  />
                </div>
                {errors.location && <p className="text-[12px] text-danger">{errors.location}</p>}
              </div>

              {/* Fixed fee info bar */}
              <div className="flex items-center justify-between bg-surface-1 border border-bord rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-blue shrink-0" />
                  <span className="text-[13px] text-txt-1">Livraison partout à Marrakech</span>
                </div>
                <span className="text-[14px] font-mono font-bold text-navy">15,00 DH</span>
              </div>
            </>
          )}

          {/* Pickup store info */}
          {deliveryMethod === 'pickup' && (
            <div className="bg-surface-1 border border-bord rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-blue" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-txt-1">{STORE_FULL_ADDRESS}</div>
                  <a href={STORE_MAP_URL} target="_blank" rel="noopener noreferrer" className="text-[12px] text-blue hover:underline mt-1 inline-block">
                    Voir sur la carte →
                  </a>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleContinueStep1}
            className="bg-blue text-white text-[14px] font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Continuer
          </button>
        </div>
      )}

      {/* ── STEP 2 — PAIEMENT ── */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-bord rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <StepBadge n={2} />
              <h2 className="text-[16px] font-bold text-navy">Paiement</h2>
            </div>

            {/* COD — selected */}
            <div className="flex items-center gap-3 border-2 border-blue bg-blue/5 rounded-xl px-4 py-3">
              <Banknote size={20} className="text-blue shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-txt-1">Paiement à la livraison</div>
                <div className="text-[12px] text-txt-2">Payez en espèces à la réception</div>
              </div>
              <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-1 rounded-full shrink-0">Sécurisé</span>
              <Check size={16} className="text-blue shrink-0" />
            </div>

            {/* Card — coming soon */}
            <div className="flex items-center gap-3 border border-bord rounded-xl px-4 py-3 opacity-50 select-none">
              <CreditCard size={20} className="text-txt-3 shrink-0" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-txt-2">Paiement par carte</div>
              </div>
              <span className="text-[11px] font-semibold text-txt-3 bg-surface-2 px-2 py-1 rounded-full shrink-0">Bientôt disponible</span>
            </div>

            {/* Promo code — UI visible, not functional yet */}
            <div>
              <div className="text-[13px] font-semibold text-txt-1 mb-2">Avez-vous un code promo ?</div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
                  <input
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Code promo"
                    className="w-full pl-9 pr-3 py-2.5 bg-surface-1 border border-bord rounded-xl text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toast('Les codes promo seront bientôt disponibles.', 'info')}
                  className="px-4 py-2.5 text-[13px] font-semibold text-blue border border-blue rounded-xl hover:bg-blue-light transition-colors shrink-0"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>

          <OrderSummary cartItems={cartItems} subtotal={cartTotal} deliveryFee={deliveryFee} discountAmount={discountAmount} total={total} />

          <div className="flex items-start gap-3 bg-surface-1 border border-bord rounded-xl px-4 py-3">
            <Lock size={18} className="text-success shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-txt-1">Paiement 100% sécurisé à la livraison</div>
              <div className="text-[12px] text-txt-2">Vous ne payez que lorsque vous recevez votre commande.</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="px-5 py-3 text-[13px] font-semibold text-txt-1 bg-surface-1 border border-bord rounded-xl hover:bg-surface-2 transition-colors">
              ← Retour
            </button>
            <button type="button" onClick={() => setStep(3)} className="flex-1 bg-blue text-white text-[14px] font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity">
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 — CONFIRMATION ── */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-bord rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <StepBadge n={3} />
              <h2 className="text-[16px] font-bold text-navy">Confirmation</h2>
            </div>

            <div className="flex items-start gap-3 bg-blue/5 border border-blue/20 rounded-xl px-4 py-3">
              <Info size={16} className="text-blue shrink-0 mt-0.5" />
              <p className="text-[13px] text-navy/80 leading-relaxed">
                Vérifiez votre commande avant de confirmer. Une fois confirmée, elle sera préparée et livrée sous 24 à 48h.
              </p>
            </div>

            <div className="border border-bord rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[13px] font-semibold text-txt-1">
                  {deliveryMethod === 'home' ? 'Adresse de livraison' : 'Retrait en magasin'}
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-[12px] text-blue hover:underline font-medium">
                  Modifier
                </button>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-light flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-blue" />
                </div>
                <div>
                  {deliveryMethod === 'home' ? (
                    <>
                      <div className="text-[13px] font-medium text-txt-1">
                        {gpsShared ? 'Position GPS enregistrée — Marrakech' : 'Livraison à domicile — Marrakech'}
                      </div>
                      {addressNote && <div className="text-[12px] text-txt-2 mt-0.5">{addressNote}</div>}
                    </>
                  ) : (
                    <div className="text-[13px] font-medium text-txt-1">Retrait en magasin — {STORE_FULL_ADDRESS}</div>
                  )}
                  <div className="text-[12px] text-txt-3 mt-1">{name} · {phone}</div>
                </div>
              </div>
            </div>
          </div>

          <OrderSummary cartItems={cartItems} subtotal={cartTotal} deliveryFee={deliveryFee} discountAmount={discountAmount} total={total} />

          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className="flex items-center justify-center gap-2 bg-blue text-white text-[15px] font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Lock size={18} />
            {submitting ? 'Confirmation en cours...' : 'Confirmer la commande'}
          </button>

          <p className="text-[11px] text-txt-3 text-center leading-relaxed">
            En confirmant, vous acceptez nos{' '}
            <span className="text-blue cursor-pointer hover:underline">Conditions Générales de Vente</span>
            {' '}et notre{' '}
            <span className="text-blue cursor-pointer hover:underline">Politique de confidentialité</span>.
          </p>

          <button type="button" onClick={() => setStep(2)} className="text-[13px] text-txt-3 text-center hover:text-txt-1 transition-colors">
            ← Retour
          </button>
        </div>
      )}
    </PageTransition>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ step }) {
  return (
    <div className="flex items-start">
      {STEP_CONFIG.map(({ n, label, sublabel }, i) => (
        <Fragment key={n}>
          <div className="flex flex-col items-center shrink-0 w-[90px] sm:w-[120px]">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] transition-all ${
              typeof step === 'number' && step > n
                ? 'bg-blue text-white'
                : step === n
                  ? 'bg-blue text-white ring-4 ring-blue/20'
                  : 'bg-white border-2 border-bord text-txt-3'
            }`}>
              {typeof step === 'number' && step > n ? <Check size={16} /> : n}
            </span>
            <div className="text-center mt-2">
              <div className={`text-[12px] font-bold leading-none ${step >= n ? 'text-navy' : 'text-txt-3'}`}>{label}</div>
              <div className={`text-[10px] mt-1 leading-tight hidden sm:block ${step === n ? 'text-txt-2' : 'text-txt-3'}`}>{sublabel}</div>
            </div>
          </div>
          {i < STEP_CONFIG.length - 1 && (
            <div className={`flex-1 h-px mt-5 ${typeof step === 'number' && step > i + 1 ? 'bg-blue' : 'bg-bord'}`} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function StepBadge({ n }) {
  return (
    <span className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center font-bold text-[14px] shrink-0">
      {n}
    </span>
  );
}

function DeliveryCard({ selected, onClick, icon: Icon, title, price, priceClass, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2.5 p-4 rounded-xl border-2 transition-colors text-left ${
        selected ? 'border-blue bg-blue/5' : 'border-bord hover:bg-surface-1'
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon size={20} className={selected ? 'text-blue' : 'text-txt-2'} />
        {selected && (
          <span className="w-5 h-5 rounded-full bg-blue flex items-center justify-center">
            <Check size={11} className="text-white" />
          </span>
        )}
      </div>
      <div>
        <div className="text-[13px] font-bold text-txt-1">{title}</div>
        <div className={`text-[13px] font-semibold mt-0.5 ${priceClass}`}>{price}</div>
        <div className="text-[11px] text-txt-3 mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function InputField({ icon: Icon, placeholder, value, onChange, type = 'text', error }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-3 bg-surface-1 border rounded-xl text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3 ${error ? 'border-danger' : 'border-bord'}`}
        />
      </div>
      {error && <p className="text-[11px] text-danger leading-tight">{error}</p>}
    </div>
  );
}

function OrderSummary({ cartItems, subtotal, deliveryFee, discountAmount, total }) {
  return (
    <div className="bg-white border border-bord rounded-2xl p-6 flex flex-col gap-4">
      <h3 className="text-[15px] font-bold text-navy">Récapitulatif de commande</h3>
      <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto">
        {cartItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-lg bg-surface-1 border border-bord overflow-hidden flex items-center justify-center">
                {item.image
                  ? <CachedImage src={item.image} className="w-full h-full object-contain" />
                  : <Package size={16} className="text-txt-3" />
                }
              </div>
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {item.qty}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-txt-1 truncate">{item.name}</div>
              {item.variantLabel && <div className="text-[11px] text-txt-3">{item.variantLabel}</div>}
            </div>
            <span className="text-[13px] font-mono font-semibold text-navy shrink-0">
              {formatPrice(item.price * item.qty)}
            </span>
          </div>
        ))}
      </div>
      <div className="h-px bg-bord" />
      <div className="flex flex-col gap-2">
        <PriceLine label="Sous-total" value={formatPrice(subtotal)} />
        <PriceLine label="Frais de livraison" value={deliveryFee === 0 ? 'Gratuit' : formatPrice(deliveryFee)} />
        {discountAmount > 0 && <PriceLine label="Remise" value={`-${formatPrice(discountAmount)}`} danger />}
      </div>
      <div className="h-px bg-bord" />
      <div className="flex items-center justify-between bg-blue/5 rounded-xl px-4 py-3">
        <span className="text-[15px] font-bold text-navy">Total à payer</span>
        <span className="text-[18px] font-mono font-black text-blue">{formatPrice(total)}</span>
      </div>
    </div>
  );
}

function PriceLine({ label, value, danger }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-txt-2">{label}</span>
      <span className={`text-[13px] font-mono font-semibold ${danger ? 'text-danger' : 'text-txt-1'}`}>{value}</span>
    </div>
  );
}
