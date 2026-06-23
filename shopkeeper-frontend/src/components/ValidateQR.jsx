import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Scanner } from '@yudiel/react-qr-scanner';
import {
  LuScanLine,
  LuCamera,
  LuCircleCheckBig,
  LuCircleX,
} from 'react-icons/lu';

const ValidateQR = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleScan = async (scannedData) => {
    if (loading || result) return;

    const qrText = scannedData[0]?.rawValue || scannedData;
    if (!qrText) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/api/shopkeeper/validate-exit-qr`,
        { qrData: qrText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResult({
        success: true,
        message: res.data.message,
        exitType: res.data.exitType
      });
    } catch (err) {
      console.error('QR Validation failed', err);
      const errMsg = err.response?.data?.message || err.message || 'Validation failed';
      setResult({
        success: false,
        message: errMsg
      });
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="validate-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <LuScanLine /> Validate Exit QR
          </h1>
          <p className="page-desc">Scan a customer's exit QR code to authorize departure</p>
        </div>
      </div>

      <div className="card scanner-card">
        {!result && !loading && (
          <div className="scanner-section">
            <p className="scanner-instruction">
              <LuCamera /> Point the camera at the customer's exit QR code
            </p>
            <div className="scanner-wrapper">
              <Scanner
                onScan={(result) => handleScan(result)}
                onError={(err) => console.log(err)}
              />
            </div>
          </div>
        )}

        {loading && (
          <div className="scanner-processing">
            <div className="spinner"></div>
            <p>Validating QR Code…</p>
          </div>
        )}

        {result && (
          <div className={`scan-result ${result.success ? 'scan-result-success' : 'scan-result-error'}`}>
            <span className="scan-result-icon">
              {result.success ? <LuCircleCheckBig /> : <LuCircleX />}
            </span>
            <h3 className="scan-result-title">
              {result.success ? 'Validation Successful' : 'Validation Failed'}
            </h3>
            <p className="scan-result-message">{result.message}</p>
            {result.exitType && (
              <span className="badge badge-success" style={{ marginBottom: '16px', display: 'inline-flex' }}>
                {result.exitType}
              </span>
            )}
            <br />
            <button onClick={resetScanner} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <LuScanLine /> Scan Another QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidateQR;
