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

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/stores/register`, {
        name, email, password, address, phone
      });
      console.log('Register response:', res.data);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Registration failed';
      console.error('Register error:', { status: err.response?.status, data: err.response?.data });
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
          <h1 className="banner-title">Join SmartQR</h1>
          <p className="banner-subtitle">
            Set up your store in minutes and start accepting QR-based
            self-checkout from customers instantly.
          </p>

          <div className="banner-features">
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuPackage /></span>
              Add unlimited products
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuUsers /></span>
              Real-time customer monitoring
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuQrCode /></span>
              Auto-generated QR codes
            </div>
            <div className="banner-feature">
              <span className="banner-feature-icon"><LuCreditCard /></span>
              Integrated Razorpay payments
            </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create Store Account</h2>
            <p className="auth-form-desc">Fill in the details to register your store</p>
          </div>

          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label className="form-label">Store Name</label>
              <input
                type="text"
                placeholder="Your Store Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                required
              />
            </div>

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
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Store Address</label>
              <input
                type="text"
                placeholder="Full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                placeholder="Contact number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                required
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Creating Store…' : 'Create Store Account'}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <div className="auth-footer">
            <p>Already have an account?</p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-ghost btn-block"
            >
              Sign In Instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;