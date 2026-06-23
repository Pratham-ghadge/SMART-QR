import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  LuLayoutDashboard,
  LuPackage,
  LuStore,
  LuMail,
  LuMapPin,
  LuPhone,
  LuHash,
  LuQrCode,
  LuDownload,
  LuTriangleAlert,
  LuPackagePlus,
  LuImagePlus,
  LuImage,
  LuClock,
  LuCalendar,
  LuCircle,
  LuPencil,
  LuSave,
  LuX,
  LuUsers,
  LuTrendingUp,
  LuTags,
  LuSettings,
  LuRefreshCw
} from 'react-icons/lu';

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState({ activeVisitors: 0, sales: { today: 0, yesterday: 0, last7Days: 0 }, dailyGraph: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', phone: '', category: '', operatingHours: { mon_fri: '', sat_sun: '' } });
  
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchStore(), fetchProducts()]);
    if (store?._id) await fetchStats(store._id);
    setLoading(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchStore();
    fetchProducts();
  }, [navigate]);

  useEffect(() => {
    if (store?._id) {
      fetchStats(store._id);
    }
  }, [store]);

  const fetchStore = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/stores/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStore(res.data);
      setEditForm({
        name: res.data.name || '',
        address: res.data.address || '',
        phone: res.data.phone || '',
        category: res.data.category || 'General Store',
        operatingHours: {
          mon_fri: res.data.operatingHours?.mon_fri || '9 AM – 10 PM',
          sat_sun: res.data.operatingHours?.sat_sun || '10 AM – 11 PM'
        }
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching store:', err);
      setError(err.response?.data?.error || 'Failed to load store profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (sid) => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/stores/stats/${sid}`);
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const updateStoreProfile = async (updateData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(`${import.meta.env.VITE_API_BASE_URL}/api/stores/profile`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStore(res.data);
      setIsEditing(false);
      alert('Store profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update store profile.');
    }
  };

  const handleSaveInfo = () => {
    updateStoreProfile(editForm);
  };

  const handleStatusToggle = (field) => {
    updateStoreProfile({ [field]: !store[field] });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'smartqr';

    if (!cloudName) {
      alert("Cloudinary configuration missing!");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, formData);
      updateStoreProfile({ imageUrl: res.data.secure_url });
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported!');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateStoreProfile({ coordinates: [position.coords.longitude, position.coords.latitude] });
      },
      () => alert('Location retrieval failed!')
    );
  };

  const downloadQR = (dataUrl, productName) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${productName.replace(/\s+/g, '_')}_QR.png`;
    link.click();
  };

  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Syncing dashboard...</p></div>;

  if (error) return (
    <div className="page-error">
      <div className="error-card">
        <LuTriangleAlert size={48} color="#ef4444" />
        <p>{error}</p>
        <button onClick={() => navigate('/login')} className="btn btn-primary">Retry Login</button>
      </div>
    </div>
  );

  // Simple Graph Component using SVG
  const SalesChart = ({ data }) => {
    if (!data || data.length === 0) return <p className="td-muted">No sales data for graph</p>;
    const max = Math.max(...data.map(d => d.amount), 1);
    const chartHeight = 120;
    const barWidth = 40;
    const gap = 15;

    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: `${gap}px`, height: `${chartHeight}px`, overflowX: 'auto', paddingBottom: '10px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div 
                style={{ 
                  width: `${barWidth}px`, 
                  height: `${(d.amount / max) * chartHeight}px`, 
                  background: 'var(--brand-gradient)', 
                  borderRadius: '6px 6px 0 0',
                  position: 'relative'
                }}
                title={`₹${d.amount}`}
              >
                <span style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', fontWeight: 'bold' }}>₹{d.amount > 1000 ? (d.amount/1000).toFixed(1)+'k' : d.amount}</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px' }}>{d._id.split('-').slice(1).join('/')}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title"><LuLayoutDashboard /> Smart Dashboard</h1>
          <p className="page-desc">Manage your storefront and monitor real-time growth</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
           <button 
             className="btn btn-ghost btn-sm"
             onClick={handleRefresh}
             title="Reload Dashboard"
           >
             <LuRefreshCw /> Refresh
           </button>
           <button 
             className={`badge ${store?.isOpen ? 'badge-success' : 'badge-danger'}`} 
             style={{ border: 'none', cursor: 'pointer', padding: '8px 16px' }}
             onClick={() => handleStatusToggle('isOpen')}
           >
             <LuCircle /> {store?.isOpen ? 'Store Open' : 'Store Closed'}
           </button>
           <button 
            className="btn btn-ghost btn-sm"
            onClick={() => handleStatusToggle('disableOrders')}
            title="Toggle Order Acceptance"
           >
             <LuSettings /> {store?.disableOrders ? 'Enable Orders' : 'Disable Orders'}
           </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}><LuUsers /></div>
          <div className="stat-info">
            <span className="stat-value">{stats.activeVisitors}</span>
            <span className="stat-label">Visitors Inside</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ECFDF5', color: '#10B981' }}><LuTrendingUp /></div>
          <div className="stat-info">
            <span className="stat-value">₹{stats.sales.today.toLocaleString()}</span>
            <span className="stat-label">Sales Today</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FFF1F2', color: '#F43F5E' }}><LuPackage /></div>
          <div className="stat-info">
            <span className="stat-value">{products.length}</span>
            <span className="stat-label">Live Inventory</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F0F9FF', color: '#0EA5E9' }}><LuCalendar /></div>
          <div className="stat-info">
            <span className="stat-value">₹{stats.sales.last7Days.toLocaleString()}</span>
            <span className="stat-label">Last 7 Days</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', marginBottom: '32px' }}>
        {/* Left Side: Graph + Detailed Analysis */}
        <div className="card" style={{ padding: '24px' }}>
          <div className="card-header" style={{ border: 'none', padding: 0, marginBottom: '20px' }}>
            <h2 className="card-title">Weekly Revenue Trends</h2>
            <div className="badge badge-primary">Growth: {((stats.sales.today / (stats.sales.yesterday || 1)) * 100 - 100).toFixed(1)}%</div>
          </div>
          <SalesChart data={stats.dailyGraph} />
          
          <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-muted)', borderRadius: '12px' }}>
              <p className="detail-label"><LuTrendingUp /> Yesterday's Revenue</p>
              <p className="detail-value">₹{stats.sales.yesterday.toLocaleString()}</p>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-muted)', borderRadius: '12px' }}>
              <p className="detail-label"><LuTags /> Store Category</p>
              <p className="detail-value" style={{ color: 'var(--accent-primary)' }}>{store?.category || '—'}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Map + Quick Status */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '16px' }}><LuMapPin /> Map Preview</h2>
          {store?.location?.coordinates?.[0] !== 0 ? (
            <div style={{ borderRadius: '12px', overflow: 'hidden', height: '180px', border: '1px solid var(--border)' }}>
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={`https://maps.google.com/maps?q=${store.location.coordinates[1]},${store.location.coordinates[0]}&z=15&output=embed`}
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div className="banner-placeholder" style={{ height: '180px' }}>
              <p className="td-muted">Pin location to view map</p>
            </div>
          )}
          
          <div style={{ marginTop: '24px' }}>
            <h3 className="detail-label" style={{ marginBottom: '12px' }}><LuClock /> Operating Hours</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span className="td-muted">Mon–Fri:</span>
                <span style={{ fontWeight: '700' }}>{store?.operatingHours?.mon_fri || '9 AM – 10 PM'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span className="td-muted">Sat–Sun:</span>
                <span style={{ fontWeight: '700' }}>{store?.operatingHours?.sat_sun || '10 AM – 11 PM'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      {store && (
        <div className="card store-info-card">
          <div className="card-header highlight-card-header">
            <h2 className="card-title"><LuStore /> Store Information</h2>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => isEditing ? handleSaveInfo() : setIsEditing(true)}
            >
              {isEditing ? <><LuSave /> Save Changes</> : <><LuPencil /> Edit Details</>}
            </button>
          </div>

          <div className="store-info-grid">
            <div className="store-details-section">
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Store Name</label>
                    <input type="text" className="form-input" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-input" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                      <option value="Groceries">Groceries</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Food & Restaurant">Food & Restaurant</option>
                      <option value="Hardware & Tools">Hardware & Tools</option>
                      <option value="Stationery">Stationery</option>
                      <option value="General Store">General Store</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input type="text" className="form-input" value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="text" className="form-input" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                   <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Weekday Hours</label>
                      <input type="text" className="form-input" value={editForm.operatingHours.mon_fri} onChange={(e) => setEditForm({...editForm, operatingHours: {...editForm.operatingHours, mon_fri: e.target.value}})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Weekend Hours</label>
                      <input type="text" className="form-input" value={editForm.operatingHours.sat_sun} onChange={(e) => setEditForm({...editForm, operatingHours: {...editForm.operatingHours, sat_sun: e.target.value}})} />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detail-row">
                    <span className="detail-label"><LuTags /> Store Category</span>
                    <span className="detail-value" style={{ color: 'var(--accent-primary)' }}>{store.category || 'General Store'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><LuMail /> Official Email</span>
                    <span className="detail-value">{store.email}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><LuMapPin /> Address</span>
                    <span className="detail-value">{store.address || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><LuPhone /> Contact</span>
                    <span className="detail-value">{store.phone || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label"><LuHash /> System ID</span>
                    <span className="detail-value detail-mono">{store._id}</span>
                  </div>
                </>
              )}
            </div>
            
            <div className="store-right-col">
              <div className="store-profile-section">
                <div>
                  <span className="detail-label"><LuImage /> Brand Banner</span>
                  {store.imageUrl ? (
                    <img src={store.imageUrl} alt="Store" className="store-banner-preview" />
                  ) : (
                    <div className="banner-placeholder">
                      <LuImage size={30} color="#94a3b8" />
                    </div>
                  )}
                  <label className="btn btn-ghost btn-sm btn-block" style={{ marginTop: '10px' }}>
                    <LuImagePlus /> Change Image
                    <input type="file" style={{ display: 'none' }} onChange={handleImageUpload} accept="image/*" />
                  </label>
                </div>

                <div className="location-control">
                  <span className="detail-label"><LuMapPin /> GEO Tagging</span>
                  {store.location?.coordinates?.[0] !== 0 ? (
                    <p className="location-status success">✓ Accuracy Verified</p>
                  ) : (
                    <p className="location-status warning">Discovery disabled</p>
                  )}
                  <button onClick={handleGetLocation} className="btn btn-primary btn-sm btn-block">
                    <LuMapPin /> Refresh GPS Position
                  </button>
                </div>
              </div>

              <div className="store-qr-section" style={{ background: 'white' }}>
                <p className="qr-label">Entrance Gateway</p>
                <p className="qr-hint">Instant check-in QR code</p>
                {store.qrCode ? (
                  <>
                    <img src={store.qrCode} alt="QR" className="store-qr-image" />
                    <button className="btn-download btn-sm btn-block" onClick={() => downloadQR(store.qrCode, store.name + '_Entry')}>
                      <LuDownload /> Save to Files
                    </button>
                  </>
                ) : <p className="qr-missing">Unavailable</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Section */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title"><LuPackage /> Direct Inventory</h2>
          <button onClick={() => navigate('/add-product')} className="btn btn-primary btn-sm">
            <LuPackagePlus /> New Entry
          </button>
        </div>

        {products.length > 0 ? (
          <div className="card">
            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Visual</th>
                    <th>Product Details</th>
                    <th>Market Price</th>
                    <th>Category</th>
                    <th>Inventory</th>
                    <th>QR Tag</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={product._id}>
                      <td className="td-muted">{index + 1}</td>
                      <td>
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '10px' }} /> 
                        : <div style={{ width: '50px', height: '50px', backgroundColor: '#f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LuPackage color="#cbd5e1" /></div>}
                      </td>
                      <td>
                        <div className="product-info-cell">
                          <span className="p-name">{product.name}</span>
                          <span className="p-desc">{product.description || 'No description provided'}</span>
                        </div>
                      </td>
                      <td className="price-cell">₹{product.price.toLocaleString()}</td>
                      <td>{product.category ? <span className="badge badge-info">{product.category}</span> : <span className="td-muted">—</span>}</td>
                      <td><span className={`stock-cell ${product.stock <= 5 ? 'low-stock' : ''}`}>{product.stock} units</span></td>
                      <td>{product.qrCode ? <img src={product.qrCode} alt="QR" className="table-qr-image" /> : <span className="td-muted">No QR</span>}</td>
                      <td>
                        {product.qrCode && (
                          <button className="btn-download" onClick={() => downloadQR(product.qrCode, product.name)}><LuDownload /> Get QR</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <span className="empty-icon"><LuPackagePlus /></span>
              <p className="empty-text">Inventory is empty</p>
              <p className="empty-hint">Start adding products to enable scanning for customers</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;