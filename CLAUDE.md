# younasser (formerly buro./pencil) — Complete Project Context

## What this is
A complete commerce platform for **younasser** — a library, stationery, and school supply shop in Marrakech, Morocco.
Three interfaces: **POS** (in-store), **Storefront** (customer-facing website), and **Admin analytics** (built into POS for admin role).
Currency: **DH** (Moroccan Dirham). Interface language: **French**.

> IMPORTANT: The brand name is **younasser**. Tagline: "Tout pour l'école et le bureau". Legal name: "Librairie Younasser SARL". GitHub repo and Firebase project remain named "buro" — only the visible brand name changes.

> WhatsApp Business number: **07 06 44 75 25** (international: `+212706447525`). Used for all storefront WhatsApp contact links (`src/lib/contact.js` → `WHATSAPP_NUMBER`) and the ticket/receipt footer. The POS "envoyer au livreur" WhatsApp share in Commandes.jsx intentionally omits this number (`https://wa.me/?text=...`) so the admin picks the driver.

---

## Tech Stack
- **Frontend:** React + Vite
- **Styling:** Tailwind CSS v4 (uses `@theme` in `src/index.css`, NOT `tailwind.config.js`)
- **Backend:** Firebase (Firestore, Auth, Storage)
- **Hosting:** GitHub Pages (base path `/buro/`)
- **Routing:** HashRouter (for GitHub Pages compatibility)

---

## Design System

### Brand
- Logo: **younasser** — bold lowercase
- Tagline: "Tout pour l'école et le bureau"
- Legal footer: "younasser — Librairie Younasser SARL — Marrakech"

### POS Theme (Dark)
- Background: dark navy/charcoal (#0f1117 area)
- Sidebar: dark navy with icon navigation
- Content area: white/light cards on dark background
- Active nav item: yellow/gold highlight
- Primary action buttons: yellow/gold (#F5A623)
- Secondary actions: outlined/light
- Danger: red for delete icons
- Stock badges: green circles with count number
- Cart items show: row number, barcode, product thumbnail, name, stock badge, quantity controls, unit price, line total, delete button
- Right panel: sale summary card with subtotal, remise, TVA, TOTAL TTC in a dark card, montant reçu, reste à payer, à rendre
- Actions section: Ticket, Facture, Sauvegarder, Suspendre buttons in grid
- Large yellow "Encaisser (F5)" button at bottom
- Bottom left: clock + date display, user avatar with initials
- Sidebar icons: hamburger menu, cart (active), calendar, gift/pack, store, clients, settings

### POS Layout
- LEFT: Thin icon sidebar (~60px)
- TOP BAR: Client dropdown + barcode search bar
- CENTER: Product cart table (white background)
- RIGHT: Sale summary panel (~300px)
- BOTTOM: Article count + "Vider la liste" button

### Login Theme (Light)
- Light background with subtle dot pattern decoration
- Centered white card with rounded corners and subtle shadow
- "younasser" logo large and bold at top
- Clean form fields with icons (mail icon, lock icon with visibility toggle)
- Yellow "Se connecter" button full width
- Footer: "younasser — Système de gestion"

### Storefront Theme (Light, Mobile-First Responsive)
- White/light background
- Navy blue primary text and accents (#1e3a5f area)
- Blue action buttons and icons (#2563eb area)
- Category icons in soft colored circles
- Product cards: white with subtle border/shadow, rounded corners
- Price in bold, old price crossed out
- Green "En stock" dot indicator
- Blue circular "+" add-to-cart buttons
- Bottom navigation bar: Accueil, Catégories, Manuels, Favoris, Profil
- Delivery banner: illustration of scooter rider with younasser branded bag

### Typography
- Font: DM Sans (primary), DM Mono (prices, codes, data)
- Loaded via Google Fonts

### Colors Reference
```
POS Dark Theme:
  --surface-0: #0f1117 (background)
  --surface-1: #181c27 (sidebar, panels)
  --surface-2: #1e2333 (inputs, cards)
  --surface-3: #252b3b (hover states)
  --border: #2a3148
  --accent-gold: #F5A623 (primary actions, active states)
  --text-primary: #e8ecf4
  --text-secondary: #8b92a8
  --text-muted: #5a6175
  --success: #38d9a9
  --warning: #f7c948
  --danger: #f55f5f

Storefront Light Theme:
  --bg: #ffffff
  --surface: #f8f9fc
  --border: #e5e7eb
  --navy: #1e3a5f (headings, logo)
  --blue: #2563eb (links, buttons, icons)
  --blue-light: #eff6ff (category circle backgrounds)
  --gold: #F5A623 (badges, accents)
  --text: #1a1a2e
  --text-secondary: #6b7280
  --success: #22c55e (stock dot)
  --danger: #ef4444
```

---

## Roles & Permissions

| Feature | Admin | Cashier (Staff) |
|---|---|---|
| Sell / create cart | ✅ | ✅ |
| Add new product | ✅ | ✅ |
| Edit product | ✅ | ✅ |
| See cost price / margin / profit | ✅ | ❌ hidden |
| Delete product | ✅ | ❌ |
| See analytics panel | ✅ | ❌ |
| Manage clients | ✅ | ✅ (add/view) |
| Consolidated invoices | ✅ | ❌ |

---

## Firebase Collections

### `/products/{productId}`
Core product. Fields: name, slug, barcode, sku, description, shortDescription, mainImage, gallery[], categoryId, categoryPath[], subcategory, tags[], brand, type (standard|manuel|pack), isManuel, isPack, manuelInfo{level,grade,subject,edition,year}, basePriceSell, basePriceCost, basePriceWholesale, promo{enabled,promoPrice,startDate,endDate}, variantPricingEnabled, hasVariants, variantTypes[], variantOptions{}, totalStock, lowStockThreshold, status, isVisible, isOutOfStock, isFeatured, badge, relatedProductIds[], frequentlyBoughtWith[], createdAt, updatedAt

### `/products/{productId}/variants/{variantId}`
Per-variant data. Fields: options{}, label, image, priceSell, priceCost, stock, minStock, barcode, sku, isActive

### `/categories/{categoryId}`
Fields: name, slug, icon, image, parentId (null=top), order, isVisible, productCount

### `/clients/{clientId}`
Fields: name, phone, ice, type (retail|business), email, address, totalSpent, totalOrders, lastPurchaseAt, creditBalance, debtBalance, notes, tags[], createdAt

### `/sales/{saleId}`
POS transactions. Fields: saleNumber, clientId, clientName, clientPhone, clientICE, subtotal, discountAmount, discountPercent, total, paymentMethod, amountReceived, change, status, source (pos), createdAt

### `/sales/{saleId}/saleItems/{itemId}`
Fields: productId, variantId, name, variantLabel, barcode, quantity, unitPrice, discountPercent, totalPrice, costPrice

### `/orders/{orderId}`
Online orders (same structure as sales but with delivery info, status flow)

### `/schools/{schoolId}` and `/schools/{schoolId}/schoolLists/{listId}`
School supply lists with items linked to products

### `/packs/{packId}` and `/packs/{packId}/packItems/{itemId}`
Curated bundles with removable items

### `/manuels/{manuelId}`
Index for fast filtering of manual products

### `/users/{userId}`
Auth users with role field

### `/settings/general`
Store config: name, currency, delivery settings, WhatsApp number, school year

---

## Pages & Features

### POS Pages (Dark Theme)

#### Login (`/login`)
- Email/password form
- Firebase Auth
- Redirects to POS after login

#### Sale Screen (`/` — default)
- Sidebar icon navigation (left)
- Top bar: client dropdown selector with "+" to add new client, barcode search input
- Center: cart table with columns: #, code-barre, article (with thumbnail), stock badge (green circle with count), quantity controls (−/+), prix unitaire, total, delete button
- Right panel: Résumé de la vente — sous-total, remise (DH input), TVA mention, TOTAL TTC in dark highlight card, montant reçu input, reste à payer, à rendre
- Actions grid: Ticket, Facture, Sauvegarder, Suspendre
- Large yellow "Encaisser (F5)" button
- Bottom bar: article count, "Vider la liste" button
- Clock + date bottom left, user avatar bottom left

#### Products (`/produits`)
- Product list table with search
- Columns: image thumbnail, name, barcode, category, sell price, stock badge, visibility toggle, actions
- Admin sees: cost price, margin columns
- "+ Ajouter" button opens full product form

#### Add/Edit Product (`/produits/nouveau` or `/produits/:id`)
- Full-page form with sections:
  1. Informations générales: name, description, barcode (scannable), SKU, type selector (Standard/Manuel/Pack)
  2. Média: main image upload, gallery upload, per-variant images
  3. Catégorie: main category dropdown with inline "+ Créer", subcategory with inline "+ Créer", tags as chips, brand
  4. Tarification: sell price, cost price (admin only), wholesale price, promo toggle (promo price, start/end dates)
  5. Stock: current stock, min threshold
  6. Variantes: toggle on/off, variant axes (couleur/taille/custom), variant combination table with: image, price, cost, stock, barcode per row
  7. Manuel scolaire (if type=Manuel): level, grade, subject, edition, year dropdowns
  8. Visibilité: badge selector, featured toggle, visible toggle
  9. Produits liés: search+add related, search+add frequently-bought-with
- Sticky bottom bar: Annuler + Sauvegarder

#### Clients (`/clients`)
- Client list with search, filter pills (Tous/Particuliers/Entreprises)
- Table: name, phone, ICE, type badge, total spent, purchases count, last purchase
- Click opens detail: full info + purchase history timeline
- "Générer facture consolidée" with date range picker
- "+ Ajouter" opens form: name, phone, ICE, type, address, notes

#### Admin Analytics (toggle panel inside POS, admin only)
- NOT a separate page — collapsible panel/overlay
- Stat cards: today's revenue, today's profit, sales count, items sold
- Revenue chart (last 7 days)
- Top 5 products today
- Low stock alerts list

### Storefront Pages (Light Theme, Mobile-First Responsive)

#### Home (`/store`)
- Logo + cart icon with badge
- Search bar
- Category icons (horizontal scroll): Fournitures scolaires, Bureau & Impression, Livres & Culture, Sacs & Accessoires, Jeux & Électronique
- Promo banner carousel: delivery, seasonal promos
- "Nos meilleures ventes" — horizontal scroll product cards
- Product card: image, name, category tag (colored), old price crossed, new price DH, stock dot, "+" button
- Bottom nav: Accueil, Catégories, Manuels, Favoris, Profil

#### Categories (`/store/categories/:slug`)
- Category title + product count
- Filter chips: subcategory, price, stock, sort
- 2-column product grid
- Product cards with badges (Vedette/Nouveau/Promo)

#### Product Detail (`/store/produit/:slug`)
- Image carousel with thumbnails
- Name, rating, reference, stock badge
- Price with old price + discount badge
- Variant selectors (color swatches, size buttons)
- Quantity selector + "Ajouter au panier"
- "Acheter en gros" pack options (10/20/50) with unit savings
- Related products
- "Souvent achetés ensemble" bundle

#### Manuels Scolaires (`/store/manuels`)
- Search + filters (Niveau, Matière, Éditeur)
- "Manuel introuvable?" banner → WhatsApp
- Quick access: level chips
- Results: book cover, title, metadata, rating, price, stock, add button

#### Packs Scolaires (`/store/packs`)
- Level filter pills
- Trust badges
- Pack cards: image, badge, name, item count, original/discounted price
- Pack detail: item list grouped by category, removable items, upsells, live price recalculation

#### School Entry (`/store/ecoles`)
- Select school → select grade → see official list
- Items with checkboxes, "Requis"/"Recommandé" tags
- Upsell section
- "Commander la liste" button

#### Cart (`/store/panier`)
- Item list with images, variant info, quantity, prices
- Discount code
- Order summary
- "Commander" button

#### Checkout (`/store/checkout`)
- Step progress: Informations → Livraison → Paiement
- Customer form, delivery options, payment methods
- Order summary, confirm button

---

## Stock Management
- Single stock pool: POS and online share the same stock
- Stock deduction uses Firestore batch writes (atomic)
- When variant.stock reaches 0 → product shows "Épuisé" everywhere
- Low stock threshold configurable per product/variant

## Key Technical Notes
- Tailwind v4: colors defined in `@theme` block in `src/index.css`
- No `tailwind.config.js` — delete if present
- Vite plugin: `@tailwindcss/vite`
- GitHub Pages: `base: '/buro/'` in vite.config.js
- HashRouter for SPA routing on GitHub Pages
- Firebase config in `.env` with `VITE_` prefix
- All Firebase imports from `src/firebase.js`
- Products are loaded once via `ProductsContext` (no variants in the listing query — variants are fetched on demand per product). See `firestore.indexes.json` for the required composite indexes; create them in Firebase Console > Firestore > Indexes (or `firebase deploy --only firestore:indexes` once a `firebase.json` exists):
  - `products`: isVisible (asc) + isManuel (asc) + isFeatured (desc)
  - `products`: isVisible (asc) + categoryPath (asc)
  - `products`: isManuel (asc) + manuelInfo.level (asc)
