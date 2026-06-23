import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LuLayoutDashboard,
  LuPackagePlus,
  LuClipboardList,
  LuScanLine,
  LuLogOut,
  LuMenu,
  LuX,
  LuStore,
  LuTrendingUp
} from 'react-icons/lu';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LuLayoutDashboard /> },
    { path: '/analytics', label: 'Analytics', icon: <LuTrendingUp /> },
    { path: '/add-product', label: 'Add Product', icon: <LuPackagePlus /> },
    { path: '/monitor', label: 'Orders Monitor', icon: <LuClipboardList /> },
    { path: '/validate-qr', label: 'Validate Exit QR', icon: <LuScanLine /> },
  ];

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">
            <LuStore />
          </span>
          <span className="brand-text">SmartQR</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              onClick={closeSidebarOnMobile}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <span className="nav-icon">
              <LuLogOut />
            </span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <LuX /> : <LuMenu />}
          </button>
          <div className="topbar-right">
            <span className="topbar-badge">
              <LuStore />
              Store Panel
            </span>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
