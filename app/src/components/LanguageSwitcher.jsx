import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ darkText = false }) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'th' ? 'en' : 'th';
    i18n.changeLanguage(nextLang);
  };

  const textColor = darkText ? '#333' : '#fff';
  const borderColor = darkText ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)';
  const bgColor = darkText ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.2)';
  const hoverBgColor = darkText ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.3)';

  return (
    <button 
      onClick={toggleLanguage}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '20px',
        padding: '5px 12px',
        color: textColor,
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        marginLeft: '15px',
        backdropFilter: 'blur(5px)',
        transition: 'all 0.3s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = hoverBgColor;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = bgColor;
      }}
    >
      <span style={{ marginRight: '5px' }}>🌐</span>
      {i18n.language === 'th' ? 'EN' : 'TH'}
    </button>
  );
}
