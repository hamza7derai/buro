import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, MessageCircle, Banknote, ShieldCheck } from 'lucide-react';
import { buildWhatsAppLink } from '../lib/contact';
import { DEFAULT_CATEGORIES } from '../lib/categoryIcons';

const STORE_MAP_URL = 'https://maps.app.goo.gl/SHTiuNtk8TmxqNtu5';
const STORE_FULL_ADDRESS = 'Magaz N°1, N°40, Quartier Industriel Syba, Marrakech';

const SERVICE_LINKS = [
  { label: 'Livraison à Marrakech' },
  { label: 'Suivi de commande', to: '/profil' },
  { label: 'Aide & Contact', href: buildWhatsAppLink('Bonjour, j\'ai une question.') },
  { label: 'Retours & Remboursements' },
  { label: 'Conditions générales' },
];

function iconLinkCls() {
  return 'w-8 h-8 rounded-full bg-surface-2 border border-bord flex items-center justify-center text-txt-3 hover:text-blue hover:border-blue transition-colors';
}

function InstagramIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.63 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.63 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.4-11.84a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

function FacebookIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.88h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

export default function StoreFooter() {
  return (
    <footer className="bg-surface-2 border-t border-bord mt-8 pb-20 lg:pb-8">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Colonne 1 — younasser. */}
        <div className="flex flex-col gap-3">
          <div className="font-extrabold text-lg text-navy tracking-wide leading-none">
            younasser<span style={{ color: '#F5A623' }}>.</span>
          </div>
          <p className="text-[12px] text-txt-2 leading-relaxed">Tout pour l'école et le bureau</p>
          <div className="flex items-center gap-2 mt-1">
            <a href="https://instagram.com/younasser.ma" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconLinkCls()}>
              <InstagramIcon />
            </a>
            <a href="https://tiktok.com/@younasser.ma" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={iconLinkCls()}>
              <TikTokIcon />
            </a>
            <a href="https://www.facebook.com/younasser.ma" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={iconLinkCls()}>
              <FacebookIcon />
            </a>
            <a href="https://wa.me/212706447525" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={iconLinkCls()}>
              <MessageCircle size={16} />
            </a>
          </div>
        </div>

        {/* Colonne 2 — Catégories */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-bold text-txt-1 mb-1">Catégories</h3>
          {DEFAULT_CATEGORIES.map(cat => (
            <Link key={cat.slug} to={`/categories/${cat.slug}`} className="text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
              {cat.name}
            </Link>
          ))}
          <Link to="/manuels" className="text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
            Manuels scolaires
          </Link>
        </div>

        {/* Colonne 3 — Service client */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-bold text-txt-1 mb-1">Service client</h3>
          {SERVICE_LINKS.map(({ label, to, href }) => {
            if (to) {
              return (
                <Link key={label} to={to} className="text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
                  {label}
                </Link>
              );
            }
            if (href) {
              return (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
                  {label}
                </a>
              );
            }
            return (
              <span key={label} className="text-[13px] text-txt-2 w-fit">
                {label}
              </span>
            );
          })}
        </div>

        {/* Colonne 4 — Contact */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-bold text-txt-1 mb-1">Contact</h3>
          <a
            href={STORE_MAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-[13px] text-txt-2 hover:text-blue transition-colors"
          >
            <MapPin size={14} className="shrink-0 mt-0.5" />
            <span>{STORE_FULL_ADDRESS}</span>
          </a>
          <a href="tel:+212706447525" className="flex items-center gap-2 text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
            <Phone size={14} className="shrink-0" />
            07 06 44 75 25
          </a>
          <a href="mailto:contact@younasser.ma" className="flex items-center gap-2 text-[13px] text-txt-2 hover:text-blue transition-colors w-fit">
            <Mail size={14} className="shrink-0" />
            contact@younasser.ma
          </a>
          <span className="flex items-center gap-2 text-[13px] text-txt-2">
            <Clock size={14} className="shrink-0" />
            Lun-Sam 9h-19h
          </span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-bord">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-txt-3 text-center sm:text-left">
            © 2025 younasser. — Librairie Younasser SARL. Tous droits réservés.
          </p>
          <div className="flex items-center gap-3 text-txt-3">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Banknote size={14} /> Paiement à la livraison
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck size={14} /> Paiement sécurisé
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
