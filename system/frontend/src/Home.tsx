import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

function Home() {
  const [studyNum, setStudyNum] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!studyNum || !participantName) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const studyNumber = parseInt(studyNum);
    if (isNaN(studyNumber)) {
      setError('Study number must be a valid integer');
      setLoading(false);
      return;
    }

    try {
      // Verify study exists and get phase
      const { data: studyData, error: studyError } = await supabase
        .from('studies')
        .select('study_id, name, phase')
        .eq('name', studyNumber)
        .single();

      if (studyError || !studyData) {
        setError('Study number not found');
        setLoading(false);
        return;
      }

      // Test mode - skip database insert
      if (participantName.toLowerCase() === 'test') {
        localStorage.setItem('studyNum', studyNum);
        localStorage.setItem('studyId', studyData.study_id.toString());
        localStorage.setItem('participantId', 'test');
        localStorage.setItem('participantName', 'test');
        localStorage.setItem('phase', studyData.phase);
        localStorage.setItem('testMode', 'true');

        setLoading(false);

        if (studyData.phase === 'pre') {
          navigate('/pre');
        } else if (studyData.phase === 'intervention') {
          navigate('/intervention');
        } else if (studyData.phase === 'post') {
          navigate('/post');
        }
        return;
      }

      // Insert participant into users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          study_num: studyNumber,
          participant_name: participantName
        })
        .select('participant_id, study_id')
        .single();

      if (userError) {
        setError('Failed to register participant');
        setLoading(false);
        return;
      }

      // Store in localStorage for session
      localStorage.setItem('studyNum', studyNum);
      localStorage.setItem('studyId', studyData.study_id.toString());
      localStorage.setItem('participantId', userData.participant_id.toString());
      localStorage.setItem('participantName', participantName);
      localStorage.setItem('phase', studyData.phase);
      localStorage.setItem('testMode', 'false');

      setLoading(false);

      // Route based on phase
      if (studyData.phase === 'pre') {
        navigate('/pre');
      } else if (studyData.phase === 'intervention') {
        navigate('/intervention');
      } else if (studyData.phase === 'post') {
        navigate('/post');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        border: '1px solid #ccc',
        width: '400px'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
          Req Eng Intervention Study
        </h1>
        <p style={{ margin: '0 0 30px 0', fontSize: '14px', color: '#666' }}>
          Enter your study information to begin
        </p>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '8px' 
            }}>
              Study Number
            </label>
            <input
              type="text"
              value={studyNum}
              onChange={(e) => setStudyNum(e.target.value)}
              placeholder="Enter study number"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 'bold',
              marginBottom: '8px' 
            }}>
              Participant Name
            </label>
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="e.g. A1, B2"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px',
              marginBottom: '20px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              fontSize: '14px',
              border: '1px solid #ef5350'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              backgroundColor: '#007bff',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Home;
