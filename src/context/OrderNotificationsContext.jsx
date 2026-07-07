import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

const OrderNotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30000;
const LOOKBACK_MS = 60 * 60 * 1000;

// Two-tone ascending chime (≈300ms total) for new-order alerts.
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const tones = [
      { freq: 587.33, start: 0, dur: 0.15 },   // D5
      { freq: 880.00, start: 0.15, dur: 0.15 }, // A5
    ];
    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    });
    setTimeout(() => ctx.close(), 400);
  } catch {
    // Web Audio unavailable/blocked — fail silently.
  }
}

export function OrderNotificationsProvider({ children }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [banner, setBanner] = useState(null);
  const [pulseKey, setPulseKey] = useState(0);
  const seenIds = useRef(null); // null until the first poll establishes a baseline

  const poll = useCallback(async () => {
    try {
      const since = new Date(Date.now() - LOOKBACK_MS);
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'pending'),
        where('createdAt', '>=', Timestamp.fromDate(since))
      );
      const snap = await getDocs(q);
      const current = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingCount(current.length);

      if (seenIds.current === null) {
        seenIds.current = new Set(current.map(o => o.id));
        return;
      }

      const freshOrders = current.filter(o => !seenIds.current.has(o.id));
      current.forEach(o => seenIds.current.add(o.id));

      if (freshOrders.length > 0) {
        const newest = freshOrders[0];
        playNotificationChime();
        setBanner({ id: newest.id, orderNumber: newest.orderNumber, clientName: newest.clientName || 'Client' });
        setPulseKey(k => k + 1);
      }
    } catch (err) {
      console.error('Order notification polling error:', err);
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(null), 10000);
    return () => clearTimeout(timeout);
  }, [banner]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  return (
    <OrderNotificationsContext.Provider value={{ pendingCount, banner, dismissBanner, pulseKey }}>
      {children}
    </OrderNotificationsContext.Provider>
  );
}

export function useOrderNotifications() {
  const ctx = useContext(OrderNotificationsContext);
  if (!ctx) throw new Error('useOrderNotifications must be used within OrderNotificationsProvider');
  return ctx;
}
