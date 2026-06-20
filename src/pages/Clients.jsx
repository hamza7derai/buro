import { useState } from 'react';
import { useClients } from '../hooks/useClients';
import { useToast } from '../components/Toast';

export default function Clients() {
  const { clients, loading, addClient, updateClient } = useClients();
  const toast = useToast();

  const [search, setSearch] = useState('');
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

  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' DH'; }

  const filtered = search.trim()
    ? clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.ice?.includes(search)
      )
    : clients;

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">Clients</h1>
          <p className="text-[13px] text-txt-3">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-bord rounded-lg px-3 py-2">
            <span className="text-txt-3">⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nom, téléphone ou ICE..."
              className="bg-transparent text-sm text-txt-1 outline-none w-56"
            />
          </div>
          <button onClick={openAdd} className="btn-primary">+ Ajouter</button>
        </div>
      </div>

      {/* Clients Table */}
      <div className="flex-1 overflow-y-auto bg-surface-1 border border-bord rounded-2xl">
        {loading ? (
          <div className="p-12 text-center text-txt-3">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-txt-3">
            <div className="text-4xl mb-3 opacity-30">👥</div>
            {clients.length === 0 ? 'Aucun client. Cliquez "Ajouter" pour commencer.' : 'Aucun résultat.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider sticky top-0 bg-surface-1 z-10">
                <th className="text-left p-4">Nom</th>
                <th className="text-left p-4">Téléphone</th>
                <th className="text-left p-4">ICE</th>
                <th className="text-center p-4">Type</th>
                <th className="text-right p-4">Total Dépensé</th>
                <th className="text-right p-4">Nb Achats</th>
                <th className="text-right p-4">Dernier Achat</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-bord hover:bg-surface-2/50">
                  <td className="p-4">
                    <span className="font-medium text-[13px]">{c.name}</span>
                    {c.notes && <div className="text-[11px] text-txt-3 truncate max-w-[200px]">{c.notes}</div>}
                  </td>
                  <td className="p-4 font-mono text-[13px] text-txt-2">{c.phone || '—'}</td>
                  <td className="p-4 font-mono text-[12px] text-txt-3">{c.ice || '—'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      c.type === 'business' ? 'bg-brand-500/15 text-brand-500' : 'bg-surface-3 text-txt-2'
                    }`}>
                      {c.type === 'business' ? 'Entreprise' : 'Particulier'}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-[13px] text-success">{fmt(c.totalSpent || 0)}</td>
                  <td className="p-4 text-right font-mono text-[13px] text-txt-2">{c.totalOrders || 0}</td>
                  <td className="p-4 text-right text-[12px] text-txt-3">
                    {c.lastPurchaseAt
                      ? new Date(c.lastPurchaseAt.seconds * 1000).toLocaleDateString('fr-FR')
                      : '—'
                    }
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(c)} className="btn-secondary !py-1 !px-2 !text-[11px]">Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={resetForm}>
          <div className="bg-surface-1 border border-bord rounded-2xl p-7 w-[480px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingClient ? '✏️ Modifier Client' : '➕ Nouveau Client'}</h3>
              <button onClick={resetForm} className="text-txt-3 hover:text-txt-1 text-xl">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Nom *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-field" placeholder="Nom du client" autoFocus />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Téléphone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="input-field" placeholder="+212 6XX-XXXXXX" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">ICE</label>
                  <input value={form.ice} onChange={e => setForm(f => ({...f, ice: e.target.value}))} className="input-field font-mono" placeholder="Entreprises uniquement" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-2">Type</label>
                <div className="flex gap-2">
                  {[{v: 'retail', l: 'Particulier'}, {v: 'business', l: 'Entreprise / École'}].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setForm(f => ({...f, type: opt.v}))}
                      className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                        form.type === opt.v
                          ? 'bg-brand-500/15 border-brand-500 text-brand-500'
                          : 'bg-surface-2 border-bord text-txt-2'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Adresse</label>
                <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} className="input-field" placeholder="Adresse (pour facture)" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="input-field resize-none h-20" placeholder="Notes internes..." />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetForm} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleSave} className="btn-success flex-1">
                {editingClient ? '✓ Sauvegarder' : '✓ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
