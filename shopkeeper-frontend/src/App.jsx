import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AddProduct from './components/AddProduct';
import Monitor from './components/Monitor';
import ValidateQR from './components/ValidateQR';
import Analytics from './components/Analytics';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth routes — no sidebar */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated routes — wrapped in Layout (sidebar + topbar) */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-product" element={<AddProduct />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/validate-qr" element={<ValidateQR />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;