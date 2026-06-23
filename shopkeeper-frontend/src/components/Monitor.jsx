import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  LuClipboardList,
  LuDollarSign,
  LuClock,
  LuRefreshCw,
  LuTriangleAlert,
  LuShoppingCart,
  LuFilter
} from 'react-icons/lu';

const Monitor = () => {
  const [orders, setOrders] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const initData = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        console.log('✅ Token found, fetching store data...');

        const storeRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/stores/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log('🏪 Store data:', storeRes.data);

        const id = storeRes.data._id || storeRes.data.id;
        const name = storeRes.data.name;

        setStoreId(id);
        setStoreName(name);

        await fetchOrdersForStore(id, token);

      } catch (err) {
        console.error('❌ Error initializing:', err);
        const errorMsg = err.response?.data?.error || err.message || 'Failed to load data';
        setError(errorMsg);
        setLoading(false);
      }
    };

    initData();
  }, [navigate]);

  const fetchOrdersForStore = async (sid, token) => {
    try {
      console.log(`📊 Fetching orders for store: ${sid}`);

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/api/shopkeeper/monitor/${sid}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('✅ Orders fetched:', response.data);
      setOrders(response.data.orders || []);
      setError('');
      setLoading(false);

    } catch (err) {
      console.error('❌ Error fetching orders:', err);

      if (err.response?.status === 404) {
        setOrders([]);
        setError('');
        setLoading(false);
      } else {
        const errorMsg = err.response?.data?.message || err.message || 'Error fetching orders';
        setError(errorMsg);
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleRefresh = async () => {
    if (!storeId) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetchOrdersForStore(storeId, token);
  };

  // Advanced Filtering & Sorting
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // 1. Date Filter
    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);

      result = result.filter(order => {
        const entryDate = new Date(order.entryTime);
        entryDate.setHours(0, 0, 0, 0);
        
        if (dateFilter === 'today') return entryDate.getTime() === today.getTime();
        if (dateFilter === 'yesterday') return entryDate.getTime() === yesterday.getTime();
        if (dateFilter === 'week') return entryDate >= last7Days;
        return true;
      });
    }

    // 2. Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(order => {
        const isVisitOnly = order.paymentStatus === 'not_required' || (order.paymentStatus === 'pending' && order.cart?.length === 0 && order.exitTime);
        
        if (statusFilter === 'in-store') return !order.exitTime;
        if (statusFilter === 'left-store') return Boolean(order.exitTime);
        if (statusFilter === 'paid') return order.paymentStatus === 'paid';
        if (statusFilter === 'visit-only') return isVisitOnly;
        if (statusFilter === 'pending') return order.paymentStatus === 'pending' && (!order.exitTime || order.cart?.length > 0);
        return true;
      });
    }

    // 3. Sort Order
    result.sort((a, b) => {
      const timeA = new Date(a.entryTime).getTime();
      const timeB = new Date(b.entryTime).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [orders, dateFilter, statusFilter, sortOrder]);

  // Computed stats reflect currently filtered view
  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');
  const pendingOrders = filteredOrders.filter((o) =>
    o.paymentStatus === 'pending' && (!o.exitTime || o.cart?.length > 0)
  );
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading orders…</p>
      </div>
    );
  }

  return (
    <div className="monitor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <LuClipboardList /> Orders Monitor
          </h1>
          <p className="page-desc">{storeName} — Real-time order tracking</p>
        </div>
        <button onClick={handleRefresh} className="btn btn-ghost btn-sm">
          <LuRefreshCw /> Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <LuTriangleAlert /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-primary-light)', color: 'var(--accent-primary)' }}>
            <LuClipboardList />
          </div>
          <div className="stat-info">
            <span className="stat-value">{orders.length}</span>
            <span className="stat-label">Total Orders</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-success-light)', color: 'var(--accent-success)' }}>
            <LuDollarSign />
          </div>
          <div className="stat-info">
            <span className="stat-value">₹{totalRevenue.toFixed(2)}</span>
            <span className="stat-label">Revenue (Paid)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-warning-light)', color: 'var(--accent-warning)' }}>
            <LuClock />
          </div>
          <div className="stat-info">
            <span className="stat-value">{pendingOrders.length}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="card-title"><LuShoppingCart /> All Orders</h2>
            <span className="badge badge-muted">{filteredOrders.length} records</span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <LuFilter size={14} color="#64748B" />
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
              </select>
            </div>

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
            >
              <option value="all">Any Status</option>
              <option value="in-store">Inside Store</option>
              <option value="left-store">Left Store</option>
              <option value="paid">Paid</option>
              <option value="visit-only">Visit Only</option>
              <option value="pending">Pending</option>
            </select>

            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon"><LuClipboardList /></span>
            <p className="empty-text">No orders found</p>
            <p className="empty-hint">Orders will appear here when customers visit your store</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Entry Time</th>
                  <th>Tracking</th>
                  <th>Items</th>
                  <th>Cart</th>
                  <th>Total</th>
                  <th>Payment Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  // Clean up older pending statuses that were actually empty exits
                  const isVisitOnly = order.paymentStatus === 'not_required' ||
                    (order.paymentStatus === 'pending' && order.cart?.length === 0 && order.exitTime);

                  const displayStatus = isVisitOnly ? 'VISIT ONLY' : order.paymentStatus.toUpperCase();

                  let badgeClass = 'danger';
                  if (isVisitOnly) badgeClass = 'info';
                  else if (order.paymentStatus === 'paid') badgeClass = 'success';
                  else if (order.paymentStatus === 'pending') badgeClass = 'warning';

                  return (
                    <tr key={order.orderId}>
                      <td className="td-bold">{order.customerName || 'N/A'}</td>
                      <td>{order.customerEmail || 'N/A'}</td>
                      <td>{order.customerPhone || 'N/A'}</td>
                      <td className="td-muted td-small">{formatDate(order.entryTime)}</td>
                      <td>
                        {order.exitTime ? (
                          <span className="badge badge-muted">Left Store</span>
                        ) : (
                          <span className="badge badge-success">Inside Store</span>
                        )}
                      </td>
                      <td className="td-center">
                        <span className="badge badge-primary">{order.cart.length}</span>
                      </td>
                      <td>
                        <div className="cart-detail-list">
                          {order.cart.map((item, idx) => (
                            <div key={idx} className="cart-detail-item">
                              <strong>{item.productName}</strong> ×{item.quantity} @ ₹{item.price.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="td-bold td-success">₹{order.totalAmount.toFixed(2)}</td>
                      <td>
                        <span className={`badge badge-${badgeClass}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td>{order.paymentMethod || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="monitor-footer-info">
        <LuClock /> Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default Monitor;