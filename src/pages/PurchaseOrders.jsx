import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useSuppliers } from '../hooks/useSuppliers';
import { useToast } from '../components/Toast';
import { printPurchaseOrder } from '../lib/purchaseOrderPdf';
import { poStatusMeta } from '../lib/purchaseOrderStatus';
import { Truck, Clock, Send, PackageCheck, Eye, Pencil, FileText, Trash2, ShoppingBag } from 'lucide-react';

const PAGE_SIZE = 10;

function fmtDate(ts) {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function StatCard({ icon: Icon, label, value, iconWrapCls, iconCls }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconWrapCls}`}>
        <Icon size={22} strokeWidth={1.75} className={iconCls} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-[#1a1a2e] font-mono truncate">{value}</div>
        <div className="text-[12px] text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const toast = useToast();
  const { orders, loading, deletePurchaseOrder } = usePurchaseOrders();
  const { suppliers } = useSuppliers();
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const enAttente = orders.filter(o => o.status === 'brouillon').length;
  const envoyees = orders.filter(o => o.status === 'envoyée').length;
  const recues = orders.filter(o => o.status === 'reçue').length;

  function handlePdf(order) {
    const supplier = suppliers.find(s => s.id === order.supplierId);
    printPurchaseOrder(order, supplier);
  }

  async function handleDelete(order) {
    try {
      await deletePurchaseOrder(order.id);
      toast('Bon de commande supprimé');
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la suppression', 'error');
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e]">Achats</h1>
            <p className="text-[13px] text-gray-400">Gérez vos commandes fournisseurs.</p>
          </div>
          <div className="ml-auto">
            <button onClick={() => navigate('/admin/achats/nouveau')} className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm transition-colors">
              + Nouveau bon de commande
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Truck} label="Total commandes" value={orders.length} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={Clock} label="En attente d'envoi" value={enAttente} iconWrapCls="bg-gray-100" iconCls="text-gray-500" />
          <StatCard icon={Send} label="Envoyées" value={envoyees} iconWrapCls="bg-blue-50" iconCls="text-blue-600" />
          <StatCard icon={PackageCheck} label="Réceptionnées" value={recues} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement...</div>
          ) : orders.length === 0 ? (
            <div className="p-14 text-center text-gray-400 flex flex-col items-center gap-2">
              <ShoppingBag size={36} strokeWidth={1.5} className="text-gray-300" />
              Aucun bon de commande. Cliquez "+ Nouveau bon de commande" pour commencer.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4 w-10">#</th>
                  <th className="text-left p-4">N° Commande</th>
                  <th className="text-left p-4">Date</th>
                  <th className="text-left p-4">Fournisseur</th>
                  <th className="text-center p-4">Nb articles</th>
                  <th className="text-center p-4">Statut</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((o, i) => {
                  const meta = poStatusMeta(o.status);
                  return (
                    <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/achats/${o.id}`)}>
                      <td className="p-4 text-[12px] text-gray-400 font-mono">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="p-4 font-mono text-[12px] font-semibold text-[#1a1a2e]">{o.orderNumber}</td>
                      <td className="p-4 text-[12px] text-gray-400 font-mono whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                      <td className="p-4 text-[13px] text-[#1a1a2e] font-medium">{o.supplierName || '—'}</td>
                      <td className="p-4 text-center font-mono text-[13px] text-gray-500">{o.items?.length || 0}</td>
                      <td className="p-4 text-center"><span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span></td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => navigate(`/admin/achats/${o.id}`)} className="text-gray-400 hover:text-[#2563eb] transition-colors" title="Voir"><Eye size={15} /></button>
                          <button onClick={() => navigate(`/admin/achats/${o.id}`)} className="text-gray-400 hover:text-[#1a1a2e] transition-colors" title="Modifier"><Pencil size={14} /></button>
                          <button onClick={() => handlePdf(o)} className="text-gray-400 hover:text-[#1a1a2e] transition-colors" title="PDF"><FileText size={14} /></button>
                          <button onClick={() => setConfirmDelete(o)} className="text-gray-400 hover:text-[#ef4444] transition-colors" title="Supprimer"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {orders.length > PAGE_SIZE && (
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[12px] text-gray-400">
              Page {currentPage} sur {totalPages} — {orders.length} commande{orders.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Précédent</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Delete confirmation ═══ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Supprimer ce bon de commande ?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{confirmDelete.orderNumber}</strong> sera supprimé définitivement. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-lg bg-[#ef4444] hover:brightness-110 text-white font-medium text-[13px] transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
