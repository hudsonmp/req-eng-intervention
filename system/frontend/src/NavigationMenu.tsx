import React from 'react';
import { useNavigate } from 'react-router-dom';

export function NavigationMenu() {
  const navigate = useNavigate();

  const menuItems = [
    { title: 'Sign Informed Consent Forms', path: '/paperwork' },
    { title: 'Take Pre-Assessment', path: '/pre-assessment' },
    { title: 'Enter Learn Mode', path: '/learn' },
    { title: 'Take Post-Assessment', path: '/post-assessment' },
    { title: 'Dispatcher Mockup', path: '/mockup' }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Arial", sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        border: '1px solid #ccc',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '30px', fontSize: '20px', color: '#000' }}>
          Study Navigation
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
