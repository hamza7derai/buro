import { formatPrice } from '../lib/pricing';

function fmtDateTime(d) {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function paymentLabel(method) {
  if (method === 'cod') return 'Paiement à la livraison';
  return method || 'Espèce';
}

// Compact 80mm thermal-printer ticket (max ~42 chars/line). Dropped into a
// confirmation/preview modal and printed via window.print() — the
// .print-area / .ticket-receipt classes are picked up by the print
// stylesheet in index.css.
export default function TicketReceipt({
  type = 'pos',
  ticketNumber,
  date,
  clientName,
  clientPhone,
  clientAddress,
  items = [],
  subtotal = 0,
  discountAmount = 0,
  deliveryFee = null,
  total = 0,
  paymentMethod,
  amountReceived = null,
  change = null,
}) {
  const isOnline = type === 'online';
  const isCash = paymentMethod === 'Espèce';

  return (
    <div className="ticket-receipt print-area w-[300px] mx-auto bg-white border border-dashed border-gray-300 rounded-lg p-2 font-mono text-[11px] leading-[1.3] text-[#1a1a2e]">
      {/* Header */}
      <div className="text-center">
        <div className="text-[15px] font-bold tracking-wide">younasser.</div>
        <div className="text-[9px] text-gray-500">Librairie Younasser SARL</div>
      </div>

      {/* Info */}
      <div className="flex justify-between mt-1">
        <span>N°: {ticketNumber || '—'}</span>
        <span>{fmtDateTime(date)}</span>
      </div>
      <div>Client: {clientName || 'CLIENT COMPTOIR'}</div>
      {isOnline && clientPhone && <div>Tél: {clientPhone}</div>}
      {isOnline && clientAddress && <div className="break-words">Adresse: {clientAddress}</div>}

      <div className="my-1 border-t border-dashed border-gray-500" />

      {/* Items — 2 lines max each, no inter-item spacing */}
      {items.map((item, i) => (
        <div key={i}>
          <div className="truncate">
            {item.qty}x {truncate(item.name + (item.variantLabel ? ` — ${item.variantLabel}` : ''), 30)}
          </div>
          <div className="text-right">= {formatPrice(item.totalPrice ?? item.unitPrice * item.qty)}</div>
        </div>
      ))}

      <div className="my-1 border-t border-dashed border-gray-500" />

      {/* Totals */}
      <div className="flex justify-between">
        <span>Sous-total:</span><span>{formatPrice(subtotal)}</span>
      </div>
      {isOnline && (
        <div className="flex justify-between">
          <span>Livraison:</span><span>{deliveryFee ? formatPrice(deliveryFee) : 'Gratuite'}</span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="flex justify-between">
          <span>Remise:</span><span>-{formatPrice(discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-[13px] font-bold">
        <span>TOTAL:</span><span>{formatPrice(total)}</span>
      </div>

      {/* Payment */}
      {!isOnline && isCash && amountReceived != null && (
        <div className="mt-0.5">
          Espèce: {formatPrice(amountReceived)} | Rendu: {formatPrice(change ?? 0)}
        </div>
      )}
      {!isOnline && !isCash && (
        <div className="mt-0.5">Paiement: {paymentLabel(paymentMethod)}</div>
      )}

      {/* Footer */}
      <div className="text-center mt-1 font-semibold">Merci!</div>
      <div className="text-center text-[9px] text-gray-500">younasser.ma | 07 06 44 75 25</div>
    </div>
  );
}
