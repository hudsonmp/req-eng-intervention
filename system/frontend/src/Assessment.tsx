import React, { useState, useRef, useEffect } from 'react';
import { sendMessage } from './chatService';

interface Reservation {
  id: number;
  time: string;
  partySize: number;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

const ALL_TIME_SLOTS = ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];
const ALL_PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

const PROMPT_OPTIONS = [
  'Code a dinner reservation app with a diner view and an owner view with the option to select a time and party size.'
];

const TUTORIAL_STEPS = [
  { title: 'Two User Types', content: 'This app has two different viewpoints: the Diner (customer) and the Owner (restaurant manager). Each has different needs and capabilities.', highlight: 'both' },
  { title: 'Diner View', content: 'The Diner can select a time slot and party size, then confirm their reservation. They see available options and can cancel if needed.', highlight: 'diner' },
  { title: 'Owner View', content: 'The Owner can toggle which time slots and party sizes are available. They control what options diners can choose from.', highlight: 'owner' },
  { title: '⚠️ Notice the Bug', content: 'Try clicking party sizes in Owner View to disable some. Notice how the Diner View still shows ALL party sizes! The owner\'s settings aren\'t being applied.', highlight: 'bug' }
];

const FIX_OPTIONS = [
  { id: 'correct', text: 'When the owner disables a party size, the system shall immediately remove that option from the diner\'s available selections.' },
  { id: 'distractor1', text: 'Add a "Refresh" button so diners can manually update their available options.' },
  { id: 'distractor2', text: 'Show a warning message to diners that some party sizes may not be available.' }
];

function Assessment() {
  const isTestMode = localStorage.getItem('testMode') === 'true';

  // Chat state (for AI code generation)
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [appBuilt, setAppBuilt] = useState(false);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialComplete, setTutorialComplete] = useState(false);

  // Fix state
  const [selectedFix, setSelectedFix] = useState('');
  const [isFixed, setIsFixed] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  // Interview state
  const [interviewMode, setInterviewMode] = useState(false);
  
  // Interview chat state (connected to Anthropic/Supabase)
  const [interviewMessages, setInterviewMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: "Welcome to your interview, I'm just getting set up, so one moment please!" },
    { id: 2, role: 'assistant', content: "Just a heads up, if you define a requirement that fixes the app on the left, it won't fix in real life, but you can play around with it to hypothesize broken features of the reservation system :)" }
  ]);
  const [interviewInput, setInterviewInput] = useState('');
  const [isSendingInterview, setIsSendingInterview] = useState(false);
  const [turnNumber, setTurnNumber] = useState(0);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const interviewChatRef = useRef<HTMLDivElement>(null);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(10 * 60); // 10 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  
  // What-if table state
  interface WhatIfRow {
    id: number;
    viewpoint: string;
    scenario: string;
    expectedBehavior: string;
    dataRequired: string;
    conflict: string;
    resolution: string;
  }
  const [whatIfRows, setWhatIfRows] = useState<WhatIfRow[]>([
    { id: 1, viewpoint: '', scenario: '', expectedBehavior: '', dataRequired: '', conflict: '', resolution: '' },
    { id: 2, viewpoint: '', scenario: '', expectedBehavior: '', dataRequired: '', conflict: '', resolution: '' },
    { id: 3, viewpoint: '', scenario: '', expectedBehavior: '', dataRequired: '', conflict: '', resolution: '' }
  ]);
  const [expandedCell, setExpandedCell] = useState<{rowId: number, field: string} | null>(null);
  
  // Session info
  const studyId = parseInt(localStorage.getItem('studyId') || '0');
  const participantId = localStorage.getItem('participantId') || 'test';

  // Start interview when entering interview mode
  useEffect(() => {
    if (interviewMode && !interviewStarted) {
      startInterview();
    }
  }, [interviewMode]);

  const startInterview = async () => {
    setInterviewStarted(true);
    setIsSendingInterview(true);
    setTimerActive(true); // Start the timer
    
    try {
      const response = await sendMessage(
        '[START_INTERVIEW]',
        studyId,
        participantId,
        0
      );
      
      // Add the AI's first real message after the welcome messages
      setInterviewMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: response.response
      }]);
      setTurnNumber(response.turn_number);
    } catch (error) {
      console.error('Failed to start interview:', error);
      setInterviewMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Failed to connect. Please refresh and try again.' }]);
    } finally {
      setIsSendingInterview(false);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setTimerActive(false);
          setShowWhatIf(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addWhatIfRow = () => {
    const newId = Math.max(...whatIfRows.map(r => r.id)) + 1;
    setWhatIfRows([...whatIfRows, { id: newId, viewpoint: '', scenario: '', expectedBehavior: '', dataRequired: '', conflict: '', resolution: '' }]);
  };

  const removeWhatIfRow = (id: number) => {
    if (whatIfRows.length > 1) {
      setWhatIfRows(whatIfRows.filter(r => r.id !== id));
    }
  };

  const updateWhatIfRow = (id: number, field: keyof WhatIfRow, value: string) => {
    setWhatIfRows(whatIfRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleWhatIfSubmit = async () => {
    // Save to Supabase via API
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    try {
      await fetch(`${API_URL}/whatif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          study_id: studyId,
          participant_id: participantId,
          rows: whatIfRows
        })
      });
      alert('Submitted successfully!');
    } catch (error) {
      alert('Failed to submit. Please try again.');
    }
  };

  const handleResetData = async () => {
    if (!window.confirm('Clear all test data from Supabase?')) return;
    setIsResetting(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      await fetch(`${API_URL}/reset`, { method: 'POST' });
      // Reset local state
      setInterviewMessages([
        { id: 1, role: 'assistant', content: "Welcome to your interview, I'm just getting set up, so one moment please!" },
        { id: 2, role: 'assistant', content: "Just a heads up, if you define a requirement that fixes the app on the left, it won't fix in real life, but you can play around with it to hypothesize broken features of the reservation system :)" }
      ]);
      setTurnNumber(0);
      setInterviewStarted(false);
      alert('Data cleared successfully');
    } catch (error) {
      alert('Failed to reset data');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendInterview = async () => {
    if (!interviewInput.trim() || isSendingInterview) return;
    
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: interviewInput.trim()
    };
    
    setInterviewMessages(prev => [...prev, userMessage]);
    setInterviewInput('');
    setIsSendingInterview(true);
    
    try {
      const response = await sendMessage(
        userMessage.content,
        studyId,
        participantId,
        turnNumber
      );
      
      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response
      };
      
      setInterviewMessages(prev => [...prev, assistantMessage]);
      setTurnNumber(response.turn_number);
    } catch (error) {
      console.error('Failed to send message:', error);
      setInterviewMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Sorry, there was an error. Please try again.' }]);
    } finally {
      setIsSendingInterview(false);
    }
  };

  useEffect(() => {
    interviewChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interviewMessages]);

  // App state
  const [selectedTime, setSelectedTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [waitlist, setWaitlist] = useState<Reservation[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Owner settings (NOT synced to diner - intentional violation until fixed)
  const [ownerTimes, setOwnerTimes] = useState<string[]>(ALL_TIME_SLOTS);
  const [ownerPartySizes, setOwnerPartySizes] = useState<number[]>(ALL_PARTY_SIZES);

  // Diner sees all options (bug) OR owner's options (after fix)
  const dinerTimes = isFixed ? ownerTimes : ALL_TIME_SLOTS;
  const dinerPartySizes = isFixed ? ownerPartySizes : ALL_PARTY_SIZES;

  const toggleTime = (time: string) => {
    setOwnerTimes(prev => 
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const togglePartySize = (size: number) => {
    setOwnerPartySizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleBook = () => {
    if (!selectedTime) return;
    const newRes: Reservation = { id: Date.now(), time: selectedTime, partySize };
    setReservation(newRes);
    setWaitlist([...waitlist, newRes]);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 3000);
  };

  const handleCancel = () => {
    if (reservation) {
      setWaitlist(waitlist.filter(r => r.id !== reservation.id));
      setReservation(null);
      setSelectedTime('');
    }
  };

  const handleSend = () => {
    if (!selectedPrompt) return;
    
    // Add user message
    setMessages([...messages, { id: Date.now(), role: 'user', content: selectedPrompt }]);
    setSelectedPrompt('');
    setIsBuilding(true);

    // Simulate building
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Done! I\'ve built your reservation app with a diner view and owner view.' }]);
      setIsBuilding(false);
      setAppBuilt(true);
    }, 2000);
  };

  const handleStartTutorial = () => {
    setShowTutorial(true);
    setTutorialStep(0);
  };

  const handleNextStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
      setTutorialComplete(true);
    }
  };

  const handleSendFix = () => {
    if (!selectedFix) return;
    
    const fixOption = FIX_OPTIONS.find(f => f.id === selectedFix);
    if (!fixOption) return;

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: fixOption.text }]);
    setSelectedFix('');
    setIsFixing(true);

    setTimeout(() => {
      if (selectedFix === 'correct') {
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Great catch! I\'ve updated the code so that when the owner changes available party sizes or time slots, those changes are immediately reflected in the diner\'s view.' }]);
        setIsFixed(true);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'That approach wouldn\'t fully solve the issue. The core problem is that the diner\'s options should automatically sync with the owner\'s settings in real-time.' }]);
      }
      setIsFixing(false);
    }, 1500);
  };

  const handleBeginInterview = () => {
    setMessages([
      { id: Date.now(), role: 'assistant', content: 'Welcome to your interview, I\'m just getting set up, so one moment please!' },
      { id: Date.now() + 1, role: 'assistant', content: 'Just a heads up, if you define a requirement that fixes the app on the left, it won\'t fix in real life, but you can play around with it to hypothesize broken features of the reservation system :)' }
    ]);
    setInterviewMode(true);
  };

  const currentStep = TUTORIAL_STEPS[tutorialStep];

  // What-If interface (Second Part of Interview)
  if (showWhatIf) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box', background: '#f5f5f5' }}>
        {/* Test Mode Controls */}
        {isTestMode && (
          <div style={{ display: 'flex', gap: '8px', padding: '4px', marginBottom: '10px', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#e65100', fontWeight: 'bold' }}>TEST MODE</span>
            <button
              onClick={handleResetData}
              disabled={isResetting}
              style={{ padding: '4px 8px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: '#f44336', color: 'white', cursor: isResetting ? 'not-allowed' : 'pointer' }}
            >
              {isResetting ? 'Clearing...' : 'Clear Supabase'}
            </button>
          </div>
        )}
        
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#333' }}>Second Part of the Interview</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
          Think about different scenarios involving restaurant owners and diners. Fill in the table below.
        </p>
        
        {/* Spreadsheet-like table */}
        <div style={{ flex: 1, overflow: 'auto', background: '#fff', border: '1px solid #e0e0e0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', width: '30px' }}></th>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', width: '140px', textAlign: 'left' }}>Viewpoint</th>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', width: '180px', textAlign: 'left' }}>Scenario</th>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', textAlign: 'left' }}>Expected Behavior</th>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', width: '160px', textAlign: 'left' }}>Data Required</th>
                <th style={{ padding: '10px', borderRight: '1px solid #e0e0e0', textAlign: 'left' }}>Conflict</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Resolution</th>
              </tr>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e0e0e0', color: '#999', fontSize: '11px', fontStyle: 'italic' }}>
                <th></th>
                <th style={{ padding: '6px 10px', borderRight: '1px solid #e0e0e0', fontWeight: 'normal' }}>(select)</th>
                <th style={{ padding: '6px 10px', borderRight: '1px solid #e0e0e0', fontWeight: 'normal' }}>What does the viewpoint do?</th>
                <th style={{ padding: '6px 10px', borderRight: '1px solid #e0e0e0', fontWeight: 'normal' }}>What should happen?</th>
                <th style={{ padding: '6px 10px', borderRight: '1px solid #e0e0e0', fontWeight: 'normal' }}>What must be stored?</th>
                <th style={{ padding: '6px 10px', borderRight: '1px solid #e0e0e0', fontWeight: 'normal' }}>How do needs conflict?</th>
                <th style={{ padding: '6px 10px', fontWeight: 'normal' }}>How to resolve?</th>
              </tr>
            </thead>
            <tbody>
              {whatIfRows.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '8px', borderRight: '1px solid #e0e0e0', textAlign: 'center', color: '#999' }}>
                    {idx + 1}
                    <br />
                    <button onClick={() => removeWhatIfRow(row.id)} style={{ border: 'none', background: 'none', color: '#f44336', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </td>
                  <td style={{ padding: '4px', borderRight: '1px solid #e0e0e0' }}>
                    <select
                      value={row.viewpoint}
                      onChange={(e) => updateWhatIfRow(row.id, 'viewpoint', e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ccc', fontSize: '13px' }}
                    >
                      <option value="">—</option>
                      <option value="restaurant_owner">Restaurant Owner</option>
                      <option value="diner">Diner</option>
                    </select>
                  </td>
                  {(['scenario', 'expectedBehavior', 'dataRequired', 'conflict', 'resolution'] as const).map(field => (
                    <td key={field} style={{ padding: '4px', borderRight: field !== 'resolution' ? '1px solid #e0e0e0' : 'none' }}>
                      {expandedCell?.rowId === row.id && expandedCell?.field === field ? (
                        <textarea
                          autoFocus
                          value={row[field]}
                          onChange={(e) => updateWhatIfRow(row.id, field, e.target.value)}
                          onBlur={() => setExpandedCell(null)}
                          style={{ width: '100%', minHeight: '100px', padding: '8px', border: '1px solid #007bff', fontSize: '13px', resize: 'vertical' }}
                          placeholder={field === 'expectedBehavior' ? 'System should...' : field === 'dataRequired' ? 'e.g., reservation ID, timestamp...' : field === 'conflict' ? 'Select viewpoint first' : field === 'resolution' ? 'Resolved by...' : ''}
                        />
                      ) : (
                        <div
                          onClick={() => setExpandedCell({ rowId: row.id, field })}
                          style={{ 
                            padding: '8px', 
                            minHeight: '40px', 
                            cursor: 'text', 
                            background: row[field] ? '#fff' : '#fafafa',
                            border: '1px solid transparent',
                            fontSize: '13px',
                            color: row[field] ? '#333' : '#999'
                          }}
                        >
                          {row[field] || (field === 'expectedBehavior' ? 'System should...' : field === 'dataRequired' ? 'e.g., reservation ID, timestamp...' : field === 'conflict' ? 'Select viewpoint first' : field === 'resolution' ? 'Resolved by...' : '')}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Actions */}
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={addWhatIfRow}
            style={{ padding: '10px 20px', fontSize: '13px', border: '1px solid #007bff', background: '#fff', color: '#007bff', cursor: 'pointer' }}
          >
            + Add Row
          </button>
          <button
            onClick={handleWhatIfSubmit}
            style={{ padding: '10px 20px', fontSize: '13px', border: 'none', background: '#007bff', color: '#fff', cursor: 'pointer' }}
          >
            Submit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '8px', gap: '8px', boxSizing: 'border-box' }}>
      {/* Timer */}
      {interviewMode && timerActive && (
        <div style={{ 
          padding: '8px 16px', 
          backgroundColor: timeRemaining <= 60 ? '#ffebee' : '#e3f2fd', 
          border: `1px solid ${timeRemaining <= 60 ? '#ef5350' : '#90caf9'}`,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '15px',
          fontSize: '16px',
          fontWeight: 'bold',
          color: timeRemaining <= 60 ? '#c62828' : '#1565c0'
        }}>
          ⏱️ Time Remaining: {formatTime(timeRemaining)}
          {isTestMode && (
            <button
              onClick={() => { setTimerActive(false); setShowWhatIf(true); }}
              style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #ccc', backgroundColor: '#ff9800', color: 'white', cursor: 'pointer', fontWeight: 'normal' }}
            >
              Skip Timer →
            </button>
          )}
        </div>
      )}
      
      {/* Test Mode Controls */}
      {isTestMode && (
        <div style={{ display: 'flex', gap: '8px', padding: '4px', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#e65100', fontWeight: 'bold' }}>TEST MODE</span>
          {!interviewMode && (
            <button
              onClick={() => setInterviewMode(true)}
              style={{ padding: '4px 8px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: '#4caf50', color: 'white', cursor: 'pointer' }}
            >
              Skip Example →
            </button>
          )}
          <button
            onClick={handleResetData}
            disabled={isResetting}
            style={{ padding: '4px 8px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: '#f44336', color: 'white', cursor: isResetting ? 'not-allowed' : 'pointer' }}
          >
            {isResetting ? 'Clearing...' : 'Clear Supabase'}
          </button>
        </div>
      )}
      
      <div style={{ display: 'flex', flex: 1, gap: '8px', overflow: 'hidden' }}>
      {/* Left side - two stacked containers */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '33%', gap: '8px' }}>
        {!appBuilt && !interviewMode ? (
          /* Placeholder before app is built */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0', background: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ textAlign: 'center', color: '#999' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💻</div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>Code</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, padding: '4px', boxSizing: 'border-box', position: 'relative' }}>
              {/* Upper left - Customer Reservation System */}
              <div style={{ 
                border: showTutorial && (currentStep?.highlight === 'diner' || currentStep?.highlight === 'both' || currentStep?.highlight === 'bug') ? '2px solid #2e7d32' : '1px solid #e0e0e0', 
                background: '#fff', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                borderRadius: '4px', 
                overflow: 'hidden',
                boxShadow: showTutorial && (currentStep?.highlight === 'diner' || currentStep?.highlight === 'both' || currentStep?.highlight === 'bug') ? '0 0 8px rgba(46,125,50,0.3)' : 'none'
              }}>
                {/* App header */}
                <div style={{ background: '#2e7d32', color: '#fff', padding: '8px 10px', fontSize: '13px', fontWeight: 500 }}>
                  🍽️ Diner View
                </div>
                
                {/* App content */}
                <div style={{ padding: '10px', flex: 1, overflow: 'auto' }}>
                  {showConfirmation && (
                    <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', padding: '8px', marginBottom: '10px', fontSize: '12px', borderRadius: '4px' }}>
                      ✓ Reservation confirmed for {reservation?.time}, party of {reservation?.partySize}
                    </div>
                  )}

                  {!reservation ? (
                    <>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#555' }}>Select Time</label>
                        <select 
                          value={selectedTime} 
                          onChange={e => setSelectedTime(e.target.value)}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', fontSize: '12px', borderRadius: '4px' }}
                        >
                          <option value="">Choose a time slot</option>
                          {dinerTimes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#555' }}>Party Size</label>
                        <select 
                          value={partySize} 
                          onChange={e => setPartySize(Number(e.target.value))}
                          style={{ width: '100%', padding: '6px', border: '1px solid #ccc', fontSize: '12px', borderRadius: '4px' }}
                        >
                          {dinerPartySizes.map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                        </select>
                      </div>

                      <button 
                        onClick={handleBook} 
                        disabled={!selectedTime}
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          background: selectedTime ? '#2e7d32' : '#ccc', 
                          color: '#fff', 
                          border: 'none', 
                          fontSize: '12px',
                          borderRadius: '4px',
                          cursor: selectedTime ? 'pointer' : 'not-allowed' 
                        }}
                      >
                        Confirm Reservation
                      </button>
                    </>
                  ) : (
                    <div>
                      <div style={{ background: '#f8f8f8', padding: '8px', marginBottom: '10px', fontSize: '12px', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 500, marginBottom: '2px' }}>Your Reservation</div>
                        <div style={{ color: '#555' }}>{reservation.time} · {reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}</div>
                      </div>
                      <button 
                        onClick={handleCancel} 
                        style={{ width: '100%', padding: '8px', background: '#fff', border: '1px solid #ccc', fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel Reservation
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Tutorial callout arrow for Diner */}
              {showTutorial && (currentStep?.highlight === 'diner' || currentStep?.highlight === 'both' || currentStep?.highlight === 'bug') && (
                <div style={{
                  position: 'absolute',
                  right: '-220px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 10
                }}>
                  {/* Arrow */}
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '12px solid #2e7d32'
                  }} />
                  {/* Callout box */}
                  <div style={{
                    background: '#fff',
                    border: '2px solid #2e7d32',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    width: '180px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: currentStep?.highlight === 'bug' ? '#d32f2f' : '#2e7d32' }}>
                      {tutorialStep + 1}/{TUTORIAL_STEPS.length}: {currentStep?.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.4, marginBottom: '8px' }}>
                      {currentStep?.content}
                    </div>
                    <button
                      onClick={handleNextStep}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        background: '#2e7d32',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: '4px', boxSizing: 'border-box', position: 'relative' }}>
              {/* Lower left - Owner Dashboard */}
              <div style={{ 
                border: showTutorial && (currentStep?.highlight === 'owner' || currentStep?.highlight === 'both' || currentStep?.highlight === 'bug') ? '2px solid #1976d2' : '1px solid #e0e0e0', 
                background: '#fff', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                borderRadius: '4px', 
                overflow: 'hidden',
                boxShadow: showTutorial && (currentStep?.highlight === 'owner' || currentStep?.highlight === 'both' || currentStep?.highlight === 'bug') ? '0 0 8px rgba(25,118,210,0.3)' : 'none'
              }}>
                {/* Owner header */}
                <div style={{ background: '#1976d2', color: '#fff', padding: '8px 10px', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚙️</span>
                  <span>Owner View</span>
                </div>
                
                {/* Owner content */}
                <div style={{ padding: '10px', flex: 1, overflow: 'auto' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500 }}>Available Time Slots</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ALL_TIME_SLOTS.map(time => (
                        <button
                          key={time}
                          onClick={() => toggleTime(time)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: ownerTimes.includes(time) ? '#e3f2fd' : '#f5f5f5',
                            color: ownerTimes.includes(time) ? '#1976d2' : '#999',
                            cursor: 'pointer'
                          }}
                        >
                          {ownerTimes.includes(time) ? '✓ ' : ''}{time}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 500 }}>Allowed Party Sizes</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ALL_PARTY_SIZES.map(size => (
                        <button
                          key={size}
                          onClick={() => togglePartySize(size)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            background: ownerPartySizes.includes(size) ? '#e3f2fd' : '#f5f5f5',
                            color: ownerPartySizes.includes(size) ? '#1976d2' : '#999',
                            cursor: 'pointer'
                          }}
                        >
                          {ownerPartySizes.includes(size) ? '✓ ' : ''}{size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#f9f9f9', padding: '8px', borderRadius: '4px', fontSize: '11px', color: '#666' }}>
                    <div style={{ fontWeight: 500, marginBottom: '2px' }}>Current Settings</div>
                    <div>{ownerTimes.length} time slots · {ownerPartySizes.length} party sizes</div>
                  </div>

                  {waitlist.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, marginBottom: '4px' }}>Reservations ({waitlist.length})</div>
                      {waitlist.map(r => (
                        <div key={r.id} style={{ fontSize: '10px', padding: '4px 6px', background: '#fff', border: '1px solid #e0e0e0', marginBottom: '2px', borderRadius: '2px' }}>
                          {r.time} · {r.partySize} guests
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Tutorial callout arrow for Owner */}
              {showTutorial && (currentStep?.highlight === 'owner') && (
                <div style={{
                  position: 'absolute',
                  right: '-220px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 10
                }}>
                  {/* Arrow */}
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    borderRight: '12px solid #1976d2'
                  }} />
                  {/* Callout box */}
                  <div style={{
                    background: '#fff',
                    border: '2px solid #1976d2',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    width: '180px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#1976d2' }}>
                      {tutorialStep + 1}/{TUTORIAL_STEPS.length}: {currentStep?.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#555', lineHeight: 1.4, marginBottom: '8px' }}>
                      {currentStep?.content}
                    </div>
                    <button
                      onClick={handleNextStep}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        background: '#1976d2',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'Next' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right side - Chat interface */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden', background: '#fff', height: '100%' }}>
        {/* Chat header - fixed */}
        <div style={{ background: '#f5f5f5', padding: '10px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: interviewMode ? '#ff9800' : '#7c4dff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
            {interviewMode ? '👨‍💼' : '🤖'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{interviewMode ? 'Interviewer' : 'Code Assistant'}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>{interviewMode ? 'Requirements discussion' : 'Build your app'}</div>
          </div>
        </div>

        {/* Chat messages - scrollable */}
        <div style={{ flex: '1 1 0', padding: '12px', overflowY: 'auto', background: '#fafafa' }}>
          {!interviewMode && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', fontSize: '13px', marginTop: '40px' }}>
              Select a prompt below to get started
            </div>
          )}
          {!interviewMode && messages.map(msg => (
            <div key={msg.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: 1.5,
                background: msg.role === 'user' ? '#007bff' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                border: msg.role === 'user' ? 'none' : '1px solid #e0e0e0'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {/* Interview mode chat */}
          {interviewMode && interviewMessages.map(msg => (
            <div key={msg.id} style={{ marginBottom: '10px', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: 1.5,
                background: msg.role === 'user' ? '#007bff' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#333',
                border: msg.role === 'user' ? 'none' : '1px solid #e0e0e0'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {interviewMode && isSendingInterview && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', background: '#fff', border: '1px solid #e0e0e0' }}>
                Interviewer is typing...
              </div>
            </div>
          )}
          {(isBuilding || isFixing) && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', background: '#fff', border: '1px solid #e0e0e0' }}>
                <span>{isBuilding ? 'Building' : 'Fixing'}...</span>
              </div>
            </div>
          )}
          <div ref={interviewChatRef} />
        </div>

        {/* Prompt selection - before app built */}
        {!appBuilt && !interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Select a prompt:</div>
            {PROMPT_OPTIONS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPrompt(prompt)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  border: selectedPrompt === prompt ? '2px solid #007bff' : '1px solid #ccc',
                  borderRadius: '4px',
                  background: selectedPrompt === prompt ? '#e3f2fd' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '6px'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* See Example Interaction button - after app built, before tutorial */}
        {appBuilt && !showTutorial && !tutorialComplete && !interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff' }}>
            <button
              onClick={handleStartTutorial}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid #007bff',
                borderRadius: '4px',
                background: '#fff',
                color: '#007bff',
                cursor: 'pointer'
              }}
            >
              👁️ See Example Interaction
            </button>
          </div>
        )}

        {/* Fix dropdown - after tutorial complete */}
        {tutorialComplete && !isFixed && !interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff' }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>How should we fix this?</div>
            {FIX_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setSelectedFix(option.id)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  lineHeight: 1.4,
                  border: selectedFix === option.id ? '2px solid #007bff' : '1px solid #ccc',
                  borderRadius: '4px',
                  background: selectedFix === option.id ? '#e3f2fd' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '6px'
                }}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}

        {/* Begin Interview button - after correct fix */}
        {isFixed && !interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff' }}>
            <button
              onClick={handleBeginInterview}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '4px',
                background: '#ff9800',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              Begin Interview
            </button>
          </div>
        )}

        {/* Send button */}
        {!interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff' }}>
            {!appBuilt ? (
              <button
                onClick={handleSend}
                disabled={!selectedPrompt || isBuilding}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '4px',
                  background: selectedPrompt && !isBuilding ? '#007bff' : '#ccc',
                  color: '#fff',
                  cursor: selectedPrompt && !isBuilding ? 'pointer' : 'not-allowed'
                }}
              >
                {isBuilding ? 'Building...' : 'Send'}
              </button>
            ) : tutorialComplete && !isFixed ? (
              <button
                onClick={handleSendFix}
                disabled={!selectedFix || isFixing}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '4px',
                  background: selectedFix && !isFixing ? '#007bff' : '#ccc',
                  color: '#fff',
                  cursor: selectedFix && !isFixing ? 'pointer' : 'not-allowed'
                }}
              >
                {isFixing ? 'Fixing...' : 'Send'}
              </button>
            ) : isFixed && !interviewMode ? (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#2e7d32', padding: '10px' }}>
                ✓ Bug fixed! The app now syncs owner settings to diner view.
              </div>
            ) : null}
          </div>
        )}
        
        {/* Interview mode input */}
        {interviewMode && (
          <div style={{ padding: '10px', borderTop: '1px solid #e0e0e0', background: '#fff', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={interviewInput}
              onChange={(e) => setInterviewInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendInterview()}
              placeholder="Type your response..."
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button
              onClick={handleSendInterview}
              disabled={isSendingInterview || !interviewInput.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                borderRadius: '4px',
                background: !isSendingInterview && interviewInput.trim() ? '#007bff' : '#ccc',
                color: '#fff',
                cursor: !isSendingInterview && interviewInput.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              {isSendingInterview ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default Assessment;
