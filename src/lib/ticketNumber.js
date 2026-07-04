import { db } from '../firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Atomically increments a per-day counter so ticket numbers stay sequential
// even when multiple registers check out at the same time.
export async function getNextTicketNumber() {
  const dateKey = todayKey();
  const counterRef = doc(db, 'counters', `tickets-${dateKey}`);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists() ? snap.data().seq : 0) + 1;
    tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() });
    return next;
  });
  return `TK-${dateKey}-${String(seq).padStart(3, '0')}`;
}
