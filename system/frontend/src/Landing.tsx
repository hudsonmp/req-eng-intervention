import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudyType } from './chatService';
import './Landing.css';

function Landing() {
  const [participantId, setParticipantId] = useState('');
  const [studyId, setStudyId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bypassMode, setBypassMode] = useState(false);
  const [manualStudyType, setManualStudyType] = useState('pre-assessment');
  const navigate = useNavigate();

  const handleBypass = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedParticipantId = participantId.trim();
    const trimmedStudyId = studyId.trim();

    // Validate inputs
    if (!trimmedParticipantId) {
      setError('Please enter a Participant ID');
      return;
    }

    if (!trimmedStudyId) {
      setError('Please enter a Study ID');
      return;
    }

    const studyIdNum = parseInt(trimmedStudyId);
    if (isNaN(studyIdNum)) {
      setError('Study ID must be a number');
      return;
    }

    setError('');
    console.log('Bypass mode: Skipping backend authentication');

    // Determine route path from manual selection
    let routePath = '';
    if (manualStudyType === 'pre-assessment') {
      routePath = '/pre-assessment';
    } else if (manualStudyType === 'intervention') {
      routePath = '/intervention';
    } else if (manualStudyType === 'post-assessment') {
      routePath = '/post-assessment';
    }

    console.log(`Navigating to: ${routePath}`);

    // Navigate with IDs (bypass mode)
    navigate(routePath, {
      state: {
        participantId: trimmedParticipantId,
        studyId: studyIdNum,
        isTestMode: true, // Treat bypass as test mode
        bypassMode: true
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedParticipantId = participantId.trim();
    const trimmedStudyId = studyId.trim();

    // Validate inputs
    if (!trimmedParticipantId) {
      setError('Please enter a Participant ID');
      return;
    }

    // Validate participant ID format (P{number}) unless it's "test"
    const participantIdPattern = /^P\d+$/;
    if (trimmedParticipantId !== 'test' && !participantIdPattern.test(trimmedParticipantId)) {
      setError('Participant ID must be in format P{number} (e.g., P1, P2, P123) or "test"');
      return;
    }

    if (!trimmedStudyId) {
      setError('Please enter a Study ID');
      return;
    }

    const studyIdNum = parseInt(trimmedStudyId);
    if (isNaN(studyIdNum)) {
      setError('Study ID must be a number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Always fetch study type from backend based on study_id
      console.log(`Fetching study type for study ID: ${studyIdNum}`);
      const result = await getStudyType(studyIdNum);
      const studyType = result.type;
      console.log(`Retrieved study type: ${studyType}`);

      if (trimmedParticipantId === 'test') {
        console.log('Test mode: will skip Supabase logging');
      }

      // Determine which page to navigate to based on study type
      let routePath = '';
      if (studyType === 'pre-assessment') {
        routePath = '/pre-assessment';
      } else if (studyType === 'intervention') {
        routePath = '/intervention';
      } else if (studyType === 'post-assessment') {
        routePath = '/post-assessment';
      } else {
        setError(`Unknown study type: ${studyType}`);
        setLoading(false);
        return;
      }

      console.log(`Navigating to: ${routePath}`);

      // Navigate with IDs
      navigate(routePath, {
        state: {
          participantId: trimmedParticipantId,
          studyId: studyIdNum,
          isTestMode: trimmedParticipantId === 'test'
        }
      });
    } catch (err) {
      console.error('Error loading study:', err);
      // Fallback to bypass mode if backend fails
      console.log('Backend failed, falling back to bypass mode');
      setError('Backend unavailable. Using bypass mode.');
      setLoading(false);
      setBypassMode(true);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-card">
        <h1>Requirements Engineering Study</h1>
        <p className="landing-subtitle">Please enter your credentials to begin</p>

        <form onSubmit={handleSubmit} className="landing-form">
          <div className="form-group">
            <label htmlFor="participantId">Participant ID</label>
            <input
              id="participantId"
              type="text"
              value={participantId}
              onChange={(e) => {
                setParticipantId(e.target.value);
                setError('');
              }}
              placeholder="e.g., P1"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="studyId">Study ID</label>
            <input
              id="studyId"
              type="text"
              value={studyId}
              onChange={(e) => {
                setStudyId(e.target.value);
                setError('');
              }}
              placeholder="Enter your study ID"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          {!bypassMode ? (
            <>
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Loading...' : 'Start Study'}
              </button>
              <button
                type="button"
                onClick={() => setBypassMode(true)}
                className="bypass-button"
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#666',
                  border: '1px solid #ccc',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Use Bypass Mode (No Backend)
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="studyType">Study Type</label>
                <select
                  id="studyType"
                  value={manualStudyType}
                  onChange={(e) => setManualStudyType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                >
                  <option value="pre-assessment">Pre-Assessment</option>
                  <option value="intervention">Intervention</option>
                  <option value="post-assessment">Post-Assessment</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleBypass}
                className="submit-button"
              >
                Start (Bypass Mode)
              </button>
              <button
                type="button"
                onClick={() => setBypassMode(false)}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#666',
                  border: '1px solid #ccc',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%'
                }}
              >
                Back to Normal Mode
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default Landing;
