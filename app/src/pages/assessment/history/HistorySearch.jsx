import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import Navbar from '../../../components/Navbar';
import './HistorySearch.css';
import bgImage from '../../../assets/bg-new.jpg';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/api$/, '');

export default function HistorySearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('');
  const [showId, setShowId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    const clean = identity.replace(/\D/g, '');

    if (clean.length !== 13) {
      setError(t('history.search.err_incomplete'));
      return;
    }

    setLoading(true);
    try {
      // 🟢 เรียก API เพื่อตรวจสอบว่ามีเลขบัตรนี้ในระบบหรือไม่
      const response = await axios.get(`${API_BASE}/api/master-cases/${clean}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      // 🟢 ถ้าพบข้อมูล (API ตอบกลับสำเร็จ) ค่อย Navigate ไปหน้า Result
      if (response.data) {
        navigate('/history/result', { state: { identity: clean } });
      }

    } catch (err) {
      setLoading(false);
      // 🔴 ถ้าไม่พบข้อมูล (404) หรือเกิดข้อผิดพลาดอื่น ให้แจ้งเตือนที่หน้านี้เลย
      if (err.response?.status === 404) {
        setError(t('history.search.err_not_found'));
      } else {
        setError(t('history.search.err_connection'));
      }
    }
  };


  return (
    <div
      className="history-search-container"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      ref={containerRef}
    >


      <Navbar
        showBack={true}
        backText={t('history.search.back')}
        onBack={() => navigate('/')}
      />

      <main className="history-container ">
        <div className="history-card-premium ">
          <div className="history-icon-wrapper">
            <FiSearch className="history-main-icon" />
          </div>
          <h2 className="history-title">{t('history.search.title')}</h2>
          <p className="history-desc">{t('history.search.desc')}</p>

          <form onSubmit={handleSearch} className="history-form">
            <div className="history-input-wrap">
              <input
                type={showId ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={13}
                value={identity}
                onChange={(e) => {
                  setIdentity(e.target.value.replace(/\D/g, '').slice(0, 13));
                  setError('');
                }}
                placeholder={t('history.search.placeholder')}
                className={`history-input ${error ? 'error' : ''}`}
                autoComplete="off"
              />
              <button
                type="button"
                className="history-eye"
                onClick={() => setShowId(!showId)}
              >
                {showId ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {error && (
              <div className="history-error" style={{ textAlign: 'center', marginTop: '15px' }}>
                {error}
              </div>
            )}

            <button type="submit" className="history-submit-btn" disabled={loading}>
              {loading ? (
                <div className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>{t('history.search.btn_searching')}</span>
                </div>
              ) : (
                t('history.search.btn_search')
              )}
            </button>
          </form>
        </div>
      </main>
    </div>

  );
}