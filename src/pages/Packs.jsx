import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePacks } from '../hooks/usePacks';
import { useToast } from '../components/Toast';
import { Gift, PackageCheck, ShoppingBag, Wallet } from 'lucide-react';
import Thumb from '../components/Thumb';
import { formatPrice } from '../lib/pricing';

const PAGE_SIZE = 10;


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

export default function Packs() {
  const { packs, loading, deletePack, duplicatePack } = usePacks();
  const toast = useToast();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const totalPages = Math.max(1, Math.ceil(packs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = packs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const packsActifs = packs.filter(p => p.status === 'active').length;
  const packsVendus = packs.reduce((s, p) => s + (p.soldCount || 0), 0);
  const caPacks = packs.reduce((s, p) => s + (p.revenue || 0), 0);

  async function handleDuplicate(pack) {
    try {
      await duplicatePack(pack);
      toast(`${pack.name} dupliqué`);
    } catch (err) {
      console.error(err);
      toast('Erreur', 'error');
    }
  }

  async function handleDelete(pack) {
    try {
      await deletePack(pack.id);
      toast(`${pack.name} supprimé`);
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
            <h1 className="text-xl font-bold text-[#1a1a2e]">Packs scolaires</h1>
            <p className="text-[13px] text-gray-400">Créez et gérez vos packs de rentrée.</p>
          </div>
          <button onClick={() => navigate('/packs/nouveau')} className="ml-auto px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm transition-colors">
            + Créer un pack
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Gift} label="Total packs" value={packs.length} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={PackageCheck} label="Packs actifs" value={packsActifs} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
          <StatCard icon={ShoppingBag} label="Packs vendus" value={packsVendus} iconWrapCls="bg-[#F5A623]/15" iconCls="text-[#F5A623]" />
          <StatCard icon={Wallet} label="CA packs" value={formatPrice(caPacks)} iconWrapCls="bg-[#1e2956]/10" iconCls="text-[#1e2956]" />
        </div>

        {/* Packs table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement...</div>
          ) : packs.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Gift size={36} strokeWidth={1.5} className="text-gray-300" />
              Aucun pack. Cliquez "Créer un pack" pour commencer.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4 w-10">#</th>
                  <th className="text-left p-4"></th>
                  <th className="text-left p-4">Pack</th>
                  <th className="text-left p-4">Niveau / Classe</th>
                  <th className="text-left p-4">École</th>
                  <th className="text-center p-4">Articles</th>
                  <th className="text-right p-4">Prix original</th>
                  <th className="text-right p-4">Prix pack</th>
                  <th className="text-center p-4">Remise</th>
                  <th className="text-center p-4">Statut</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p, i) => {
                  const remise = p.totalItemsPrice > 0 ? Math.round((1 - (p.packPrice || 0) / p.totalItemsPrice) * 100) : 0;
                  return (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-[12px] text-gray-400 font-mono">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="p-4"><Thumb src={p.mainImage} className="w-9 h-9" /></td>
                      <td className="p-4 font-medium text-[13px] text-[#1a1a2e]">{p.name}</td>
                      <td className="p-4">
                        {(p.level || p.grade) ? (
                          <span className="text-[11px] font-medium text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full">
                            {[p.level, p.grade].filter(Boolean).join(' — ')}
                          </span>
                        ) : <span className="text-[12px] text-gray-400">—</span>}
                      </td>
                      <td className="p-4 text-[12px] text-gray-500">{p.schoolName || '—'}</td>
                      <td className="p-4 text-center font-mono text-[13px] text-gray-500">{p.itemsCount ?? 0}</td>
                      <td className="p-4 text-right font-mono text-[13px] text-gray-400 line-through">{formatPrice(p.totalItemsPrice)}</td>
                      <td className="p-4 text-right font-mono text-[13px] font-semibold text-[#22c55e]">{formatPrice(p.packPrice)}</td>
                      <td className="p-4 text-center font-mono text-[12px] text-[#ef4444]">-{remise}%</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.status === 'active' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {p.status === 'active' ? 'Actif' : 'Brouillon'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => navigate(`/packs/${p.id}`)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Modifier</button>
                          <button onClick={() => handleDuplicate(p)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Dupliquer</button>
                          <button onClick={() => setConfirmDelete(p)} className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 transition-colors">Suppr.</button>
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
        {packs.length > PAGE_SIZE && (
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[12px] text-gray-400">Page {currentPage} sur {totalPages} — {packs.length} packs</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Précédent</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Supprimer ce pack ?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{confirmDelete.name}</strong> sera supprimé définitivement. Cette action est irréversible.
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
