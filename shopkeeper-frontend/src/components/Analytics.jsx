import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Analytics.css';

const API = import.meta.env.VITE_API_BASE_URL;

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, style = {} }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'inline-block', flexShrink: 0, ...style }}>
    <path d={d} />
  </svg>
);
const IC = {
  up:    "M22 7 L12 17 7 12 2 17 M18 7 h4 v4",
  down:  "M22 17 L12 7 7 12 2 7 M18 17 h4 v-4",
  cash:  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  cart:  "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  user:  "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  clock: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM12 6v6l4 2",
  cal:   "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  map:   "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 11.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
  qr:    "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 17h3v3h-3zM14 14h3",
  arrow: "M5 12h14M12 5l7 7-7 7",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  check: "M20 6L9 17l-5-5",
  pkg:   "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n) => n >= 10000 ? `₹${(n/1000).toFixed(1)}k` : `₹${(n||0).toLocaleString()}`;
const pct  = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skel = ({ h = 32, w = '100%', r = 10 }) => (
  <div className="an-skel" style={{ height: h, width: w, borderRadius: r }} />
);

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
const BarChart = ({ data, labels, color = '#6366f1' }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '130px', width: '100%' }}>
      {data.map((v, i) => (
        <div key={i} title={`${v}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ width: '100%', height: `${(v / max) * 100}%`, background: `linear-gradient(to top,${color},${color}99)`, borderRadius: '5px 5px 0 0', minHeight: 2, transition: 'height 0.5s ease' }} />
          {labels && <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginTop: 4 }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
};

// ── SVG Line Chart ────────────────────────────────────────────────────────────
const LineChart = ({ data }) => {
  if (!data || data.length < 2) return <div className="an-empty-chart">No data yet</div>;
  const W = 500, H = 100;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / (max - min || 1)) * (H - 10) - 5;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '120px' }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${pts.join(' ')} ${W},${H} 0,${H}`} fill="url(#lg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart = ({ slices }) => {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return <div className="an-empty-chart">No orders yet</div>;
  const r = 52, cx = 64, cy = 64, stroke = 20, circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {slices.map((s, i) => {
        const p = s.value / total;
        const off = -(cum * circ);
        cum += p;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${p * circ} ${circ}`}
          strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cy})`} />;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">{total}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="600">ORDERS</text>
    </svg>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('daily');
  const [filter, setFilter] = useState('Last 7 days');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        // Get store profile first to get the storeId
        const profileRes = await axios.get(`${API}/api/stores/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const storeId = profileRes.data._id;
        const analyticsRes = await axios.get(`${API}/api/stores/analytics/${storeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData({ ...analyticsRes.data, store: profileRes.data });
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Build chart arrays from API data
  const getChartData = () => {
    if (!data?.graphs) return { revenues: [], orders: [], labels: [] };
    const g = range === 'daily'   ? data.graphs.dailyGraph
             : range === 'weekly' ? data.graphs.weeklyGraph
             : data.graphs.monthlyGraph;
    if (!g || g.length === 0) return { revenues: [], orders: [], labels: [] };
    return {
      revenues: g.map(d => d.revenue || 0),
      orders:   g.map(d => d.orders  || 0),
      labels:   g.map(d => {
        if (range === 'daily')   return d._id?.slice(5) || '';   // MM-DD
        if (range === 'weekly')  return `W${d._id}`;
        return d._id?.slice(0,7) || '';                           // YYYY-MM
      }),
    };
  };

  const { revenues, orders: orderVol, labels } = getChartData();

  // KPIs derived from real data
  const ov = data?.overview || {};
  const todayGrowth = ov.yesterday > 0 ? Math.round(((ov.today - ov.yesterday) / ov.yesterday) * 100) : 0;
  const convRate = ov.totalCustomers > 0 && ov.activeVisitors >= 0
    ? ((ov.totalOrders / (ov.totalCustomers || 1)) * 100).toFixed(1)
    : '0.0';

  // Order status
  const statusMap = {};
  (data?.statusBreakdown || []).forEach(s => { statusMap[s._id] = s.count; });
  const totalOrdsAll = Object.values(statusMap).reduce((a, b) => a + b, 0);

  // Funnel
  const f = data?.funnel || {};
  const funnelSteps = [
    { label: 'Store Visited',    count: f.totalVisits || 0, pct: 100 },
    { label: 'Added to Cart',    count: f.addedToCart || 0, pct: pct(f.addedToCart, f.totalVisits) },
    { label: 'Checkout Started', count: f.checkedOut  || 0, pct: pct(f.checkedOut,  f.totalVisits) },
    { label: 'Purchased',        count: f.purchased   || 0, pct: pct(f.purchased,   f.totalVisits) },
  ];

  if (error) return (
    <div className="an-root" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="an-card" style={{ textAlign: 'center', maxWidth: 400 }}>
        <Icon d={IC.alert} size={36} style={{ color: '#ef4444', marginBottom: 12 }} />
        <p style={{ color: '#0f172a', fontWeight: 700, marginBottom: 8 }}>Failed to Load Analytics</p>
        <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="an-root">

      {/* Header */}
      <div className="an-header">
        <div>
          <h1 className="an-title">
            <span className="an-title-icon"><Icon d={IC.up} size={18} style={{ color: '#fff' }} /></span>
            Store Intelligence
          </h1>
          {data?.store && <p className="an-subtitle">Real-time analytics for <strong>{data.store.name}</strong></p>}
        </div>
        <div className="an-filter-bar">
          {['Today', 'Last 7 days', 'Last 30 days'].map(f => (
            <button key={f} className={`an-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
          <div className="an-filter-divider" />
          <button className="an-filter-cal"><Icon d={IC.cal} size={18} /></button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="an-kpi-grid">
        {loading ? Array(8).fill(0).map((_, i) => (
          <div key={i} className="an-kpi-card">
            <Skel h={40} w={40} r={12} />
            <div style={{ marginTop: 12 }}><Skel h={10} w={80} /><div style={{ marginTop: 8 }}><Skel h={28} w={100} /></div></div>
          </div>
        )) : [
          { label: 'Total Revenue',   value: fmt(ov.totalRevenue),    growth: todayGrowth,        ic: IC.cash,  accent: '#6366f1', bg: '#eef2ff' },
          { label: 'Total Orders',    value: ov.totalOrders || 0,     growth: 0,                  ic: IC.cart,  accent: '#0ea5e9', bg: '#e0f2fe' },
          { label: 'Customers',       value: ov.totalCustomers || 0,  growth: 0,                  ic: IC.users, accent: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Active Now',      value: ov.activeVisitors || 0,  growth: 0,                  ic: IC.user,  accent: '#10b981', bg: '#ecfdf5' },
          { label: 'Today Revenue',   value: fmt(ov.today),           growth: todayGrowth,        ic: IC.cash,  accent: '#f59e0b', bg: '#fffbeb' },
          { label: 'This Week',       value: fmt(ov.last7Days),       growth: 0,                  ic: IC.up,    accent: '#ec4899', bg: '#fdf2f8' },
          { label: 'Avg Order Value', value: fmt(ov.aov),             growth: 0,                  ic: IC.cart,  accent: '#14b8a6', bg: '#f0fdfa' },
          { label: 'New Customers',   value: ov.newCustomersThisMonth || 0, growth: 0,            ic: IC.users, accent: '#f97316', bg: '#fff7ed' },
        ].map((k, i) => (
          <div key={i} className="an-kpi-card">
            <div className="an-kpi-top">
              <div className="an-kpi-icon" style={{ background: k.bg, color: k.accent }}>
                <Icon d={k.ic} size={18} />
              </div>
              {k.growth !== 0 && (
                <span className="an-kpi-growth" style={{ color: k.growth >= 0 ? '#10b981' : '#ef4444' }}>
                  <Icon d={k.growth >= 0 ? IC.up : IC.down} size={11} />
                  {Math.abs(k.growth)}%
                </span>
              )}
            </div>
            <p className="an-kpi-label">{k.label}</p>
            <p className="an-kpi-value">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart + Funnel */}
      <div className="an-grid-2-1">
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <h2 className="an-card-title">Revenue Trend</h2>
              <p className="an-card-sub">Real paid orders revenue over time (₹)</p>
            </div>
            <div className="an-range-pills">
              {[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']].map(([v,l]) => (
                <button key={v} className={`an-range-btn ${range === v ? 'active' : ''}`} onClick={() => setRange(v)}>{l}</button>
              ))}
            </div>
          </div>
          {loading ? <Skel h={120} /> : revenues.length > 0
            ? <LineChart data={revenues} />
            : <div className="an-empty-chart">No revenue data for this period yet</div>
          }
          {!loading && (
            <div className="an-chart-stats">
              <div className="an-chart-stat">
                <p className="an-chart-stat-val">{fmt(ov.today)}</p>
                <p className="an-chart-stat-label">Today</p>
              </div>
              <div className="an-chart-stat">
                <p className="an-chart-stat-val">{fmt(ov.last7Days)}</p>
                <p className="an-chart-stat-label">Last 7 Days</p>
              </div>
              <div className="an-chart-stat">
                <p className="an-chart-stat-val">{fmt(ov.last30Days)}</p>
                <p className="an-chart-stat-label">Last 30 Days</p>
              </div>
            </div>
          )}
        </div>

        {/* Funnel */}
        <div className="an-card an-dark" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="an-dark-glow" />
          <h2 className="an-card-title" style={{ color: '#fff' }}>Customer Journey</h2>
          <p className="an-card-sub" style={{ color: '#94a3b8', marginBottom: 20 }}>Conversion funnel – all time</p>
          <div className="an-funnel">
            {loading ? Array(4).fill(0).map((_, i) => <Skel key={i} h={40} />) :
              funnelSteps.map((s, i) => (
                <div key={i} className="an-funnel-step">
                  <div className="an-funnel-label-row">
                    <span style={{ color: '#c7d2fe', fontSize: 12, fontWeight: 600 }}>Step {i+1}: {s.label}</span>
                    <span style={{ color: '#818cf8', fontSize: 12, fontWeight: 800 }}>{s.pct}%</span>
                  </div>
                  <div className="an-funnel-track">
                    <div className="an-funnel-fill" style={{ width: `${Math.max(s.pct, 2)}%` }} />
                  </div>
                  <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginTop: 3 }}>{s.count.toLocaleString()} visits</p>
                </div>
              ))
            }
          </div>
          {!loading && (
            <div className="an-dark-note" style={{ marginTop: 16 }}>
              <p className="an-dark-note-title">Conversion Rate</p>
              <p className="an-dark-note-body">{convRate}% of known customers have placed at least 1 order.</p>
            </div>
          )}
        </div>
      </div>

      {/* Orders Volume + Status */}
      <div className="an-grid-2-1">
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <h2 className="an-card-title">Orders Volume</h2>
              <p className="an-card-sub">Order count per {range === 'daily' ? 'day' : range === 'weekly' ? 'week' : 'month'}</p>
            </div>
            <span className="an-badge-indigo">{ov.totalOrders || 0} Total</span>
          </div>
          {loading ? <Skel h={130} /> : orderVol.length > 0
            ? <BarChart data={orderVol} labels={labels} />
            : <div className="an-empty-chart">No order data yet</div>
          }
        </div>

        <div className="an-card">
          <h2 className="an-card-title">Order Status</h2>
          <p className="an-card-sub" style={{ marginBottom: 20 }}>All-time breakdown</p>
          {loading ? <Skel h={130} /> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <DonutChart slices={[
                  { value: statusMap['paid']     || 0, color: '#10b981' },
                  { value: statusMap['pending']   || 0, color: '#f59e0b' },
                  { value: statusMap['failed']    || 0, color: '#ef4444' },
                  { value: statusMap['not_required'] || 0, color: '#94a3b8' },
                ]} />
              </div>
              {[
                { label: 'Paid',         count: statusMap['paid']         || 0, dot: '#10b981' },
                { label: 'Pending',      count: statusMap['pending']       || 0, dot: '#f59e0b' },
                { label: 'Failed',       count: statusMap['failed']        || 0, dot: '#ef4444' },
                { label: 'Free/Entry',   count: statusMap['not_required']  || 0, dot: '#94a3b8' },
              ].map((s, i) => (
                <div key={i} className="an-status-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{s.count}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>
                      {totalOrdsAll > 0 ? `${Math.round((s.count / totalOrdsAll) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Top Products + Recent Orders */}
      <div className="an-grid-1-1">
        {/* Top Products */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <h2 className="an-card-title">Best Sellers</h2>
              <p className="an-card-sub">Top products by units sold (paid orders)</p>
            </div>
          </div>
          {loading ? Array(5).fill(0).map((_, i) => <div key={i} style={{ marginBottom: 12 }}><Skel h={50} /></div>) :
            data?.topProducts?.length > 0 ? data.topProducts.map((p, i) => (
              <div key={i} className="an-product-row">
                <span className="an-rank">{i + 1}</span>
                <div className="an-product-avatar">{(p.name || '?').charAt(0)}</div>
                <div className="an-product-info">
                  <p className="an-product-name">{p.name || 'Unknown Product'}</p>
                  <p className="an-product-meta">{p.category} · {p.totalSold} sold</p>
                </div>
                <div className="an-product-right">
                  <p className="an-product-rev">{fmt(p.totalRevenue)}</p>
                  {p.stock !== null && (
                    <span className={`an-stock-badge ${p.stock <= 10 ? 'low' : 'ok'}`}>
                      {p.stock <= 10 ? `⚠ Low (${p.stock})` : 'In Stock'}
                    </span>
                  )}
                </div>
              </div>
            )) : (
              <div className="an-empty-chart">No sales data yet — products will appear here after first orders.</div>
            )
          }

          {/* Low Stock Alerts */}
          {!loading && data?.lowStock?.length > 0 && (
            <div style={{ marginTop: 20, padding: '14px', background: '#fef2f2', borderRadius: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                ⚠ Low Stock Alerts
              </p>
              {data.lowStock.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{p.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="an-card">
          <div className="an-card-header">
            <div>
              <h2 className="an-card-title">Recent Transactions</h2>
              <p className="an-card-sub">Latest customer checkout events</p>
            </div>
          </div>
          {loading ? Array(5).fill(0).map((_, i) => <div key={i} style={{ marginBottom: 12 }}><Skel h={56} /></div>) :
            data?.recentOrders?.length > 0 ? data.recentOrders.map((o, i) => {
              const name = o.customerId?.name || o.customerId?.email || 'Guest';
              const statusColor = o.paymentStatus === 'paid' ? '#10b981' : o.paymentStatus === 'pending' ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} className="an-order-row">
                  <div className="an-order-avatar">{name.charAt(0).toUpperCase()}</div>
                  <div className="an-order-info">
                    <p className="an-order-name">{name}</p>
                    <p className="an-order-meta">
                      <Icon d={IC.clock} size={10} /> {timeAgo(o.createdAt)} · #{o._id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                  <div className="an-order-right">
                    <p className="an-order-amount">{fmt(o.totalAmount)}</p>
                    <span className="an-order-status" style={{ color: statusColor }}>{o.paymentStatus}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="an-empty-chart">No orders yet — they'll appear here in real-time.</div>
            )
          }
        </div>
      </div>

      {/* Customer Analytics + QR */}
      <div className="an-grid-1-1">
        <div className="an-card">
          <h2 className="an-card-title" style={{ marginBottom: 4 }}>Customer Analytics</h2>
          <p className="an-card-sub" style={{ marginBottom: 24 }}>Based on all-time order data</p>
          <div className="an-cust-grid">
            {[
              { title: 'Total Customers',     value: ov.totalCustomers || 0,       sub: 'Unique visitors', color: '#6366f1' },
              { title: 'Active In Store',      value: ov.activeVisitors || 0,       sub: 'Right now',       color: '#10b981' },
              { title: 'New This Month',       value: ov.newCustomersThisMonth || 0, sub: 'Last 30 days',   color: '#0ea5e9' },
              { title: 'Avg Order Value',      value: fmt(ov.aov),                  sub: 'Per paid order',  color: '#f59e0b' },
            ].map((s, i) => (
              loading ? <Skel key={i} h={100} /> :
              <div key={i} className="an-cust-card">
                <p className="an-cust-label">{s.title}</p>
                <p className="an-cust-value">{s.value}</p>
                <p className="an-cust-sub">{s.sub}</p>
                <div style={{ height: 3, background: s.color, borderRadius: 999, marginTop: 10, opacity: 0.4 }} />
              </div>
            ))}
          </div>
        </div>

        {/* QR Section */}
        <div className="an-card an-dark" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="an-dark-glow" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, position: 'relative', zIndex: 1 }}>
            <div className="an-kpi-icon" style={{ background: 'rgba(255,255,255,0.1)', color: '#818cf8' }}>
              <Icon d={IC.qr} size={18} />
            </div>
            <div>
              <h2 className="an-card-title" style={{ color: '#fff' }}>QR Code Analytics</h2>
              <p className="an-card-sub" style={{ color: '#94a3b8' }}>Store entry QR performance</p>
            </div>
          </div>

          <div className="an-qr-stats" style={{ position: 'relative', zIndex: 1 }}>
            {loading ? Array(3).fill(0).map((_, i) => <Skel key={i} h={70} r={14} />) : [
              ['Total Scans',   f.totalVisits || 0],
              ['Unique Users',  ov.totalCustomers || 0],
              ['Conversion',    `${pct(f.purchased, f.totalVisits)}%`],
            ].map(([l, v], i) => (
              <div key={i} className="an-qr-stat">
                <p className="an-qr-val">{v}</p>
                <p className="an-qr-label">{l}</p>
              </div>
            ))}
          </div>

          <div className="an-dark-note" style={{ position: 'relative', zIndex: 1, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d={IC.pkg} size={14} style={{ color: '#34d399' }} />
              <p className="an-dark-note-title" style={{ color: '#34d399', margin: 0 }}>Store Status</p>
            </div>
            <p className="an-dark-note-body">
              {data?.store?.isOpen ? '🟢 Store is currently Open' : '🔴 Store is currently Closed'}.
              {data?.store?.disableOrders ? ' Orders are disabled.' : ' Orders are being accepted.'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Analytics;
