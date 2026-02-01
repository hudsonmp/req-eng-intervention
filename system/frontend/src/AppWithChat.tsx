import React, { useState, useEffect } from 'react';
import './App.css';
import { Chat } from './components/Chat';

function AppWithChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'config'>('chat');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Create intervention session on mount
    fetch('http://localhost:8000/api/sessions', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        setSessionId(data.id);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error creating session:', err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="app" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{
        marginBottom: '20px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <h1 style={{
          margin: '0 0 16px 0',
          fontSize: '24px',
          color: '#333'
        }}>
          Requirements Engineering Intervention System
        </h1>

        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '-2px'
        }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              border: 'none',
              borderBottom: activeTab === 'chat' ? '3px solid #667eea' : '3px solid transparent',
              backgroundColor: activeTab === 'chat' ? '#f5f5f5' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'chat' ? '600' : '400',
              color: activeTab === 'chat' ? '#667eea' : '#666',
              transition: 'all 0.2s'
            }}
          >
            💬 Chat with Alex
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              border: 'none',
              borderBottom: activeTab === 'config' ? '3px solid #667eea' : '3px solid transparent',
              backgroundColor: activeTab === 'config' ? '#f5f5f5' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'config' ? '600' : '400',
              color: activeTab === 'config' ? '#667eea' : '#666',
              transition: 'all 0.2s'
            }}
          >
            ⚙️ Test Configuration
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          fontSize: '16px',
          color: '#666'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', fontSize: '32px' }}>⏳</div>
            <div>Creating intervention session...</div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'chat' && sessionId && (
            <div>
              <Chat sessionId={sessionId} />

              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f9f9f9',
                border: '1px solid #e0e0e0',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
                  About this Intervention
                </h4>
                <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: '#666' }}>
                  This is a pedagogical intervention system where you help Alex, a CS1 student,
                  test their vehicle assignment code. Through guided conversation, you'll help Alex
                  discover requirements via exploratory testing, experiencing the protégé effect
                  and self-explanation.
                </p>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
                  <strong>Session ID:</strong> {sessionId}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f5f5f5',
              border: '2px dashed #ccc',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#666' }}>
                Test Configuration
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: '#999' }}>
                Advanced test configuration interface coming soon.
                <br />
                For now, use the chat interface to work with Alex.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AppWithChat;
