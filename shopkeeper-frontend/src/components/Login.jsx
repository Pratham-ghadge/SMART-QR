import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  LuPackage,
  LuUsers,
  LuQrCode,
  LuCreditCard,
  LuStore,
} from 'react-icons/lu';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/stores/login`, { email, password });
      console.log('Login response:', res.data);
      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Login failed';
      console.error('Login error:', { status: err.response?.status, data: err.response?.data });
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Banner */}
      <div className="auth-banner">
        <div className="banner-content">
          <div className="banner-logo">
            <LuStore />
          </div>
          <h1 className="banner-title">Welcome to SmartQR</h1>
          <p className="banner-subtitle">
            Your all-in-one merchant dashboard for managing products,
            tracking orders, and processing QR-based checkouts seamlessly.
          </p>

          <div className="banner-features">
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuPackage /></span>
              Manage your products effortlessly
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuUsers /></span>
              Monitor customer activity in real-time
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuQrCode /></span>
              Generate &amp; validate QR codes
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuCreditCard /></span>
              Track orders and payments
            </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Sign In</h2>
            <p className="auth-form-desc">Enter your credentials to access the dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                placeholder="you@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <div className="auth-footer">
            <p>Don't have a store account?</p>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="btn btn-ghost btn-block"
            >
              Create Store Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;