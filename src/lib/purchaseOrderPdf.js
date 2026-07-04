function fmtDate(value) {
  const date = value instanceof Date ? value : (value?.seconds ? new Date(value.seconds * 1000) : new Date());
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Opens a new window with a printable A4 "Bon de commande" and triggers window.print()
export function printPurchaseOrder(order, supplier) {
  const items = order.items || [];

  const rows = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.name)}</td>
      <td>${escapeHtml(it.barcode) || '—'}</td>
      <td class="num">${it.quantityOrdered || 0}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(order.orderNumber) || 'Bon de commande'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Nunito', Arial, sans-serif; color: #000; background: #fff; margin: 0; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .logo { font-size: 26px; font-weight: 700; }
  .logo .dot { color: #F5A623; }
  .company { font-size: 12px; line-height: 1.5; margin-top: 6px; color: #222; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 20px; margin: 0 0 6px; letter-spacing: 0.5px; }
  .doc-title .meta { font-size: 12px; color: #222; }
  .supplier { margin: 20px 0; padding: 14px 16px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; line-height: 1.6; }
  .supplier strong { display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f3f3f3; text-transform: uppercase; font-size: 11px; letter-spacing: 0.4px; }
  td.num, th.num { text-align: right; font-family: 'DM Mono', monospace; }
  .notes { margin-top: 22px; font-size: 12.5px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12.5px; }
  @media print {
    body { padding: 10mm; }
    @page { size: A4; margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">younasser</div>
      <div class="company">
        Librairie Younasser SARL<br/>
        Magaz N°1, N°40, Quartier Industriel Syba, Marrakech<br/>
        Tél: 06 66 86 90 23 / 06 35 79 16 74
      </div>
    </div>
    <div class="doc-title">
      <h1>BON DE COMMANDE</h1>
      <div class="meta">N° ${escapeHtml(order.orderNumber)}</div>
      <div class="meta">Date: ${fmtDate(order.createdAt)}</div>
    </div>
  </div>

  <div class="supplier">
    <strong>Fournisseur</strong>
    ${escapeHtml(supplier?.name || order.supplierName) || '—'}<br/>
    ${supplier?.phone ? `Tél: ${escapeHtml(supplier.phone)}<br/>` : ''}
    ${supplier?.email ? `Email: ${escapeHtml(supplier.email)}<br/>` : ''}
    ${supplier?.address ? escapeHtml(supplier.address) : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Désignation</th>
        <th>Code barre</th>
        <th class="num">Quantité</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${order.notes ? `<div class="notes"><strong>Notes :</strong><br/>${escapeHtml(order.notes).replace(/\n/g, '<br/>')}</div>` : ''}

  <div class="signatures">
    <div>Signature : _______________________</div>
    <div>Date : _______________________</div>
  </div>

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
