import{C as e,K as t,M as n,N as r,O as i,P as a,S as o,T as s,U as c,_ as l,f as u,j as d,x as f}from"./index-DlbxrCkQ.js";var p=t(c(),1);function m(){let[t,r]=(0,p.useState)([]),[i,c]=(0,p.useState)(!0);return(0,p.useEffect)(()=>f(e(d(u,`suppliers`),o(`name`)),e=>{r(e.docs.map(e=>({id:e.id,...e.data()}))),c(!1)}),[]),{suppliers:t,addSupplier:async({name:e,phone:t=``,email:r=``,address:i=``,notes:o=``})=>{let c=n(d(u,`suppliers`));return await s(c,{name:e.trim(),phone:t.trim(),email:r.trim(),address:i.trim(),notes:o.trim(),createdAt:a()}),c.id},loading:i}}function h(){let[t,c]=(0,p.useState)([]),[m,h]=(0,p.useState)(!0);(0,p.useEffect)(()=>f(e(d(u,`purchaseOrders`),o(`createdAt`,`desc`)),e=>{c(e.docs.map(e=>({id:e.id,...e.data()}))),h(!1)}),[]);function g(){let e=new Date,n=`BC-${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}-`,r=t.filter(e=>e.orderNumber?.startsWith(n)).length;return n+String(r+1).padStart(3,`0`)}return{orders:t,loading:m,generateOrderNumber:g,createPurchaseOrder:async(e,t)=>{await s(n(u,`purchaseOrders`,e),t)},updatePurchaseOrder:async(e,t)=>{await s(n(u,`purchaseOrders`,e),t,{merge:!0})},deletePurchaseOrder:async e=>{await l(n(u,`purchaseOrders`,e))},receivePurchaseOrder:async(e,t)=>{let o=i(u),s=0,c=e.items.map((e,i)=>{let c=Number(t[i])||0;return e.productId&&c>0&&(o.update(n(u,`products`,e.productId),{totalStock:r(c),isOutOfStock:!1,updatedAt:a()}),s++),{...e,quantityReceived:c}});return o.update(n(u,`purchaseOrders`,e.id),{status:`reçue`,receivedAt:a(),items:c}),await o.commit(),s}}}function g(e){return(e instanceof Date?e:e?.seconds?new Date(e.seconds*1e3):new Date).toLocaleDateString(`fr-FR`,{day:`2-digit`,month:`2-digit`,year:`numeric`})}function _(e){return String(e??``).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e])}function v(e,t){let n=(e.items||[]).map((e,t)=>`
    <tr>
      <td>${t+1}</td>
      <td>${_(e.name)}</td>
      <td>${_(e.barcode)||`—`}</td>
      <td class="num">${e.quantityOrdered||0}</td>
    </tr>`).join(``),r=`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${_(e.orderNumber)||`Bon de commande`}</title>
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
      <div class="meta">N° ${_(e.orderNumber)}</div>
      <div class="meta">Date: ${g(e.createdAt)}</div>
    </div>
  </div>

  <div class="supplier">
    <strong>Fournisseur</strong>
    ${_(t?.name||e.supplierName)||`—`}<br/>
    ${t?.phone?`Tél: ${_(t.phone)}<br/>`:``}
    ${t?.email?`Email: ${_(t.email)}<br/>`:``}
    ${t?.address?_(t.address):``}
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
    <tbody>${n}</tbody>
  </table>

  ${e.notes?`<div class="notes"><strong>Notes :</strong><br/>${_(e.notes).replace(/\n/g,`<br/>`)}</div>`:``}

  <div class="signatures">
    <div>Signature : _______________________</div>
    <div>Date : _______________________</div>
  </div>

  <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`,i=window.open(``,`_blank`);i&&(i.document.open(),i.document.write(r),i.document.close())}var y={brouillon:{label:`Brouillon`,cls:`bg-gray-100 text-gray-500 border-gray-200`},envoyée:{label:`Envoyée`,cls:`bg-blue-50 text-blue-600 border-blue-200`},reçue:{label:`Reçue`,cls:`bg-green-50 text-green-600 border-green-200`},annulée:{label:`Annulée`,cls:`bg-red-50 text-red-600 border-red-200`}};function b(e){return y[e]||y.brouillon}export{m as i,v as n,h as r,b as t};