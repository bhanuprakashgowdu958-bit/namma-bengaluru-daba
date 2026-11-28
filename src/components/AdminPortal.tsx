import { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from 'firebase/auth';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  ChefHat,
  Clock,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Phone,
  Search,
  Sparkles,
  User,
  UtensilsCrossed,
  XCircle
} from 'lucide-react';
import { RESTAURANT_CONFIG } from '../data/menu';
import type { OrderRecord, OrderStatus } from '../types/order';
import { auth } from '../utils/firebase';
import { formatINR } from '../utils/format';
import { subscribeAllOrders, updateOrderStatus } from '../utils/orders';
import { DietaryBadge } from './DietaryBadge';

type FilterTab = 'active' | 'pending' | 'preparing' | 'ready' | 'served' | 'all';

function playNewOrderChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const tone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    tone(880, 0, 0.16);
    tone(1174.66, 0.14, 0.28);
  } catch {
    // Audio playback may be blocked until first user interaction
  }
}

function formatTimeAgo(timestampMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  return new Date(timestampMs).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

function isSameLocalDay(ts: number, refMs: number): boolean {
  const a = new Date(ts);
  const b = new Date(refMs);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const STATUS_BADGE: Record<OrderStatus, { label: string; cls: string }> = {
  pending: {
    label: 'New Order',
    cls: 'border-[#F59E0B]/50 bg-[#F59E0B]/15 text-[#FCD34D]'
  },
  preparing: {
    label: 'Preparing',
    cls: 'border-[#D96B27]/55 bg-[#D96B27]/20 text-[#F4A26E]'
  },
  ready: {
    label: 'Ready',
    cls: 'border-[#22C55E]/50 bg-[#22C55E]/15 text-[#86EFAC]'
  },
  served: {
    label: 'Served',
    cls: 'border-white/20 bg-white/10 text-[#D6D0C8]'
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'border-red-500/45 bg-red-500/15 text-red-300'
  }
};

export function AdminPortal() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('active');
  const [groupByTable, setGroupByTable] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const initialSnapshotLoadedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      initialSnapshotLoadedRef.current = false;
      seenOrderIdsRef.current.clear();
      return;
    }

    const unsub = subscribeAllOrders(
      (list) => {
        setOrdersError(null);
        setOrders(list);

        if (!initialSnapshotLoadedRef.current) {
          list.forEach((o) => seenOrderIdsRef.current.add(o.id));
          initialSnapshotLoadedRef.current = true;
          return;
        }

        let hasNewPending = false;
        for (const o of list) {
          if (!seenOrderIdsRef.current.has(o.id)) {
            seenOrderIdsRef.current.add(o.id);
            if (o.status === 'pending') hasNewPending = true;
          }
        }
        if (hasNewPending && soundEnabled) {
          playNewOrderChime();
        }
      },
      (err) => {
        setOrdersError(
          err.message ||
            'Could not read Firestore orders. Check your Firestore Rules in Firebase Console.'
        );
      }
    );

    return () => unsub();
  }, [user, soundEnabled]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email.trim() || !password) {
      setAuthError('Enter your staff email and password.');
      return;
    }

    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code.includes('operation-not-allowed')) {
        setAuthError(
          'Email/Password login is not enabled yet in Firebase Console → Authentication → Sign-in method.'
        );
      } else if (
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found')
      ) {
        setAuthError('Invalid email or password. Check Firebase Authentication → Users.');
      } else {
        setAuthError('Sign-in failed. Please verify your Firebase Auth configuration.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } catch {
      setOrdersError('Failed to update order status. Check Firestore update rules.');
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = useMemo(() => {
    let activeCount = 0;
    let pendingCount = 0;
    let todayCount = 0;
    let todayRevenue = 0;

    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready') {
        activeCount += 1;
      }
      if (o.status === 'pending') pendingCount += 1;
      if (isSameLocalDay(o.createdAt, nowMs) && o.status !== 'cancelled') {
        todayCount += 1;
        todayRevenue += o.totalAmount;
      }
    }
    return { activeCount, pendingCount, todayCount, todayRevenue };
  }, [orders, nowMs]);

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return orders.filter((o) => {
      if (filterTab === 'active') {
        if (o.status !== 'pending' && o.status !== 'preparing' && o.status !== 'ready') {
          return false;
        }
      } else if (filterTab !== 'all' && o.status !== filterTab) {
        return false;
      }

      if (!q) return true;
      const haystack = `${o.orderNumber} ${o.tableNumber} ${o.customerName} ${o.customerPhone} ${o.cookingNotes}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, filterTab, searchText]);

  const groupedTables = useMemo(() => {
    if (!groupByTable) return null;
    const map = new Map<string, { orders: OrderRecord[]; total: number }>();
    for (const o of filteredOrders) {
      const key =
        o.orderType === 'takeaway'
          ? `Takeaway • ${o.customerName || o.orderNumber}`
          : `Table #${o.tableNumber || 'Walk-In'}`;
      const existing = map.get(key) ?? { orders: [], total: 0 };
      existing.orders.push(o);
      if (o.status !== 'cancelled') existing.total += o.totalAmount;
      map.set(key, existing);
    }
    return Array.from(map.entries());
  }, [filteredOrders, groupByTable]);

  const renderOrderCard = (order: OrderRecord) => {
    const badge = STATUS_BADGE[order.status];
    const ageMinutes = Math.floor((nowMs - order.createdAt) / 60000);
    const isDelayed =
      (order.status === 'pending' || order.status === 'preparing') && ageMinutes >= 15;
    const busy = updatingId === order.id;

    return (
      <article
        key={order.id}
        className={`rounded-2xl border bg-[#121216] p-4 shadow-lg transition-colors ${
          order.status === 'pending'
            ? 'border-[#F59E0B]/45'
            : 'border-white/12'
        }`}
      >
        {/* Header: Order #, Table badge, elapsed time & status */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#D96B27] px-2.5 py-1 text-xs font-bold text-[#F7F3EC]">
              {order.orderType === 'takeaway'
                ? 'Takeaway'
                : `Table #${order.tableNumber}`}
            </span>
            <span className="font-mono text-sm font-bold text-[#F7F3EC]">
              {order.orderNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
                isDelayed ? 'text-red-400' : 'text-[#A8A29E]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatTimeAgo(order.createdAt, nowMs)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
        </div>

        {/* Customer Details */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-[#18181D] px-3 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-[#F7F3EC]">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <User className="h-3.5 w-3.5 text-[#D96B27]" />
              {order.customerName || 'Walk-in Guest'}
            </span>
            {order.customerPhone ? (
              <a
                href={`tel:${order.customerPhone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-[#F4A26E] underline decoration-[#D96B27]/50 underline-offset-2"
              >
                <Phone className="h-3.5 w-3.5" />
                {order.customerPhone}
              </a>
            ) : (
              <span className="text-[#A8A29E]/70">No phone provided</span>
            )}
          </div>
          <span className="text-[11px] text-[#A8A29E]">
            {new Date(order.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* Items List */}
        <div className="mt-3 divide-y divide-white/8">
          {order.items.map((line, i) => (
            <div
              key={`${line.id}-${line.variantLabel}-${i}`}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <DietaryBadge type={line.diet} />
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums text-[#F4A26E]">
                  {line.quantity}x
                </span>
                <span className="truncate font-medium text-[#F7F3EC]">
                  {line.name}
                  {line.variantLabel !== 'Regular' ? (
                    <span className="ml-1 text-xs text-[#A8A29E]">
                      ({line.variantLabel})
                    </span>
                  ) : null}
                </span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-[#F7F3EC]">
                {formatINR(line.lineTotal)}
              </span>
            </div>
          ))}
        </div>

        {/* Cooking Preferences */}
        {order.cookingNotes && (
          <div className="mt-2.5 rounded-xl border border-[#D96B27]/40 bg-[#D96B27]/12 px-3 py-2 text-xs text-[#F4A26E]">
            <strong className="font-semibold">Kitchen Note:</strong> {order.cookingNotes}
          </div>
        )}

        {/* Total + Action Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#A8A29E]">
              Total ({order.totalCount} items)
            </p>
            <p className="text-base font-bold tabular-nums text-[#F7F3EC]">
              {formatINR(order.totalAmount)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'pending' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange(order.id, 'cancelled')}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-red-400/35 bg-red-500/10 px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange(order.id, 'preparing')}
                  className="liquid-glass-saffron inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/25 px-3.5 text-xs font-semibold text-[#F7F3EC] transition hover:brightness-110 disabled:opacity-50"
                >
                  <ChefHat className="h-3.5 w-3.5" />
                  Accept &amp; Prepare
                </button>
              </>
            )}

            {order.status === 'preparing' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange(order.id, 'ready')}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#22C55E]/45 bg-[#22C55E]/20 px-3.5 text-xs font-semibold text-[#86EFAC] transition hover:bg-[#22C55E]/30 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Mark Ready
              </button>
            )}

            {order.status === 'ready' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleStatusChange(order.id, 'served')}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 text-xs font-semibold text-[#F7F3EC] transition hover:bg-white/25 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E]" />
                Mark Served
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709] text-[#F7F3EC]">
        <p className="text-sm text-[#A8A29E]">Connecting to Namma Bengaluru Admin…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070709] px-4 py-10 text-[#F7F3EC]">
        <div className="liquid-glass w-full max-w-md rounded-3xl border border-white/15 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D96B27]/45 bg-[#D96B27]/15 px-3 py-1 text-[11px] font-semibold text-[#F4A26E]">
              <Lock className="h-3 w-3" />
              Staff Portal
            </span>
            <a
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#A8A29E] hover:text-[#F7F3EC]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Customer Menu
            </a>
          </div>

          <h1 className="mt-4 font-serif text-2xl font-semibold text-[#F7F3EC]">
            {RESTAURANT_CONFIG.brandName}
          </h1>
          <p className="mt-1 text-xs text-[#A8A29E]">
            Sign in with your Firebase staff email &amp; password to view live customer orders.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
              >
                Staff Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@nammabengalurudaba.in"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#141418] px-3.5 py-2.5 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/55 outline-none focus:border-[#D96B27]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]"
              >
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-white/15 bg-[#141418] px-3.5 py-2.5 pr-10 text-sm text-[#F7F3EC] placeholder-[#A8A29E]/55 outline-none focus:border-[#D96B27]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#A8A29E] hover:text-[#F7F3EC]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="liquid-glass-saffron flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 text-sm font-semibold text-[#F7F3EC] transition hover:brightness-110 disabled:opacity-60"
            >
              {signingIn ? 'Signing in…' : 'Open Kitchen & Order Portal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] pb-16 text-[#F7F3EC]">
      {/* Sticky Admin Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0B0E]/92 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D96B27]/20 text-[#F4A26E]">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-lg font-semibold tracking-tight sm:text-xl">
                  Admin Orders Portal
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#22C55E]/40 bg-[#22C55E]/15 px-2 py-0.5 text-[10px] font-semibold text-[#86EFAC]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-[#A8A29E]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              title={soundEnabled ? 'Mute order chime' : 'Enable order chime'}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium text-[#F7F3EC] hover:bg-white/10"
            >
              {soundEnabled ? (
                <Bell className="h-4 w-4 text-[#D96B27]" />
              ) : (
                <BellOff className="h-4 w-4 text-[#A8A29E]" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>

            <a
              href="/"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium text-[#F7F3EC] hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Menu
            </a>

            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-medium text-[#A8A29E] hover:text-[#F7F3EC]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 pt-5 sm:px-6">
        {/* Today Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="rounded-2xl border border-white/12 bg-[#121216] p-3.5 sm:p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]">
              Active Queue
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#F7F3EC]">
              {stats.activeCount}
              {stats.pendingCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-[#FCD34D]">
                  ({stats.pendingCount} new)
                </span>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#121216] p-3.5 sm:p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]">
              Today&apos;s Orders
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#F7F3EC]">
              {stats.todayCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[#121216] p-3.5 sm:p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#A8A29E]">
              Today Revenue
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#F4A26E]">
              {formatINR(stats.todayRevenue)}
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                ['active', 'Active'],
                ['pending', 'New'],
                ['preparing', 'Preparing'],
                ['ready', 'Ready'],
                ['served', 'Served'],
                ['all', 'All']
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterTab(key)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  filterTab === key
                    ? 'border-[#D96B27] bg-[#D96B27] text-[#F7F3EC]'
                    : 'border-white/12 bg-[#141418] text-[#A8A29E] hover:text-[#F7F3EC]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A29E]" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search table, guest, phone, #NB..."
                className="w-full rounded-xl border border-white/12 bg-[#141418] py-2 pl-9 pr-3 text-xs text-[#F7F3EC] placeholder-[#A8A29E]/60 outline-none focus:border-[#D96B27]"
              />
            </div>
            <button
              type="button"
              onClick={() => setGroupByTable((g) => !g)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                groupByTable
                  ? 'border-[#D96B27] bg-[#D96B27]/20 text-[#F4A26E]'
                  : 'border-white/12 bg-[#141418] text-[#A8A29E] hover:text-[#F7F3EC]'
              }`}
            >
              {groupByTable ? 'Table View' : 'Ticket Feed'}
            </button>
          </div>
        </div>

        {ordersError && (
          <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-4 text-xs text-red-300">
            {ordersError}
          </div>
        )}

        {/* Order Feed / Grouped By Table */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#121216] px-6 py-14 text-center">
            <ChefHat className="mx-auto h-9 w-9 text-[#D96B27]/80" />
            <p className="mt-3 font-serif text-lg text-[#F7F3EC]">No orders in this view</p>
            <p className="mt-1 text-xs text-[#A8A29E]">
              New orders placed from customer tables will appear here automatically.
            </p>
          </div>
        ) : groupedTables ? (
          <div className="space-y-6">
            {groupedTables.map(([tableLabel, group]) => (
              <section
                key={tableLabel}
                className="rounded-3xl border border-white/12 bg-[#0E0E12] p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h2 className="font-serif text-lg font-semibold text-[#F7F3EC]">
                    {tableLabel}{' '}
                    <span className="text-xs font-normal text-[#A8A29E]">
                      ({group.orders.length}{' '}
                      {group.orders.length === 1 ? 'order' : 'orders'})
                    </span>
                  </h2>
                  <span className="text-base font-bold tabular-nums text-[#F4A26E]">
                    Table Total: {formatINR(group.total)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {group.orders.map(renderOrderCard)}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            {filteredOrders.map(renderOrderCard)}
          </div>
        )}
      </main>
    </div>
  );
}
