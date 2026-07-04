import { useState } from 'react';
import { useClients } from '../hooks/useClients';
import { useToast } from '../components/Toast';
import { Users, UserCheck, UserPlus, Wallet } from 'lucide-react';
import { formatPrice } from '../lib/pricing';

const PAGE_SIZE = 10;
const ACTIVE_WINDOW_DAYS = 90;


function isActiveClient(client) {
  if (!client.lastPurchaseAt?.seconds) return false;
  const days = (Date.now() / 1000 - client.lastPurchaseAt.seconds) / 86400;
  return days <= ACTIVE_WINDOW_DAYS;
}

function isNewThisMonth(client) {
  if (!client.createdAt?.seconds) return false;
  const created = new Date(client.createdAt.seconds * 1000);
  const now = new Date();
  return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
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

export default function Clients() {
  const { clients, loading, addClient, updateClient } = useClients();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [form, setForm] = useState({
    name: '', phone: '', ice: '', type: 'retail', address: '', notes: '',
  });

  function resetForm() {
    setForm({ name: '', phone: '', ice: '', type: 'retail', address: '', notes: '' });
    setEditingClient(null);
    setShowForm(false);
  }

  function openAdd() { resetForm(); setShowForm(true); }

  function openEdit(client) {
    setEditingClient(client);
    setForm({
      name: client.name || '',
      phone: client.phone || '',
      ice: client.ice || '',
      type: client.type || 'retail',
      address: client.address || '',
      notes: client.notes || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('Nom du client requis', 'error'); return; }
    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          ice: form.ice.trim(),
          type: form.type,
          address: form.address.trim(),
          notes: form.notes.trim(),
        });
        toast(`${form.name} mis à jour`);
      } else {
        await addClient({
          name: form.name.trim(),
          phone: form.phone.trim(),
          ice: form.ice.trim(),
          type: form.type,
          address: form.address.trim(),
          notes: form.notes.trim(),
        });
        toast(`${form.name} ajouté`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast('Erreur', 'error');
    }
  }

  const filtered = search.trim()
    ? clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.ice?.includes(search)
      )
    : clients;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const totalSpent = clients.reduce((s, c) => s + (c.totalSpent || 0), 0);
  const activeCount = clients.filter(isActiveClient).length;
  const newThisMonth = clients.filter(isNewThisMonth).length;

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e]">Clients</h1>
            <p className="text-[13px] text-gray-400">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <span className="text-gray-400">⌕</span>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Nom, téléphone ou ICE..."
                className="bg-transparent text-sm text-[#1a1a2e] outline-none w-56 placeholder:text-gray-400"
              />
            </div>
            <button onClick={openAdd} className="px-4 py-2 rounded-lg bg-[#F5A623] hover:bg-[#d6890f] text-[#1a1a2e] font-semibold text-sm transition-colors">
              + Ajouter
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Users} label="Total clients" value={clients.length} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={UserCheck} label="Clients actifs" value={activeCount} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
          <StatCard icon={UserPlus} label="Nouveaux ce mois" value={newThisMonth} iconWrapCls="bg-[#F5A623]/15" iconCls="text-[#F5A623]" />
          <StatCard icon={Wallet} label="Total achats" value={formatPrice(totalSpent)} iconWrapCls="bg-[#1e2956]/10" iconCls="text-[#1e2956]" />
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Users size={36} strokeWidth={1.5} className="text-gray-300" />
              {clients.length === 0 ? 'Aucun client. Cliquez "Ajouter" pour commencer.' : 'Aucun résultat.'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4 w-10">#</th>
                  <th className="text-left p-4">Client</th>
                  <th className="text-left p-4">Téléphone</th>
                  <th className="text-left p-4">ICE</th>
                  <th className="text-right p-4">Achats totaux</th>
                  <th className="text-right p-4">Dernier achat</th>
                  <th className="text-center p-4">Statut</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4 text-[12px] text-gray-400 font-mono">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="p-4">
                      <span className="font-medium text-[13px] text-[#1a1a2e]">{c.name}</span>
                      {c.notes && <div className="text-[11px] text-gray-400 truncate max-w-[200px]">{c.notes}</div>}
                    </td>
                    <td className="p-4 font-mono text-[13px] text-gray-500">{c.phone || '—'}</td>
                    <td className="p-4 font-mono text-[12px] text-gray-400">{c.ice || '—'}</td>
                    <td className="p-4 text-right font-mono text-[13px] text-[#22c55e]">{formatPrice(c.totalSpent || 0)}</td>
                    <td className="p-4 text-right text-[12px] text-gray-400">
                      {c.lastPurchaseAt ? new Date(c.lastPurchaseAt.seconds * 1000).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        isActiveClient(c) ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isActiveClient(c) ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => openEdit(c)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[12px] text-gray-400">
              Page {currentPage} sur {totalPages} — {filtered.length} client{filtered.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={resetForm}>
          <div className="bg-white rounded-2xl p-7 w-[480px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#1a1a2e]">{editingClient ? 'Modifier le client' : 'Nouveau client'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-[#1a1a2e] text-xl">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Nom *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                  placeholder="Nom du client"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Téléphone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                    placeholder="+212 6XX-XXXXXX"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">ICE</label>
                  <input
                    value={form.ice}
                    onChange={e => setForm(f => ({ ...f, ice: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                    placeholder="Entreprises uniquement"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Type</label>
                <div className="flex gap-2">
                  {[{ v: 'retail', l: 'Particulier' }, { v: 'business', l: 'Entreprise / École' }].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setForm(f => ({ ...f, type: opt.v }))}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                        form.type === opt.v
                          ? 'bg-[#F5A623]/15 border-[#F5A623] text-[#F5A623]'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Adresse</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                  placeholder="Adresse (pour facture)"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623] resize-none h-20"
                  placeholder="Notes internes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-[#22c55e] hover:brightness-110 text-white font-medium text-[13px] transition-all">
                {editingClient ? 'Sauvegarder' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
