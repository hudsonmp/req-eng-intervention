import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppContext, API_URL } from './AppContext';
import { demoConversation } from './demoConversation';

export function LearnModePage() {
  const [showIntro, setShowIntro] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{
    sender: string, text: string, pairs?: any,
    messageType?: string, missingDataTypes?: string[], discoveredRequirements?: string[]
  }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentAgentData, setCurrentAgentData] = useState<any>(null);
  // Input mode: 'chat' | 'test'
  const [inputMode, setInputMode] = useState<'chat' | 'test'>('chat');
  const [testDataTypes, setTestDataTypes] = useState('');
  const [testCase, setTestCase] = useState('');
  const [testExpected, setTestExpected] = useState('');
  // Workspace state
  const [scratchpad, setScratchpad] = useState('');
  const [notes, setNotes] = useState<Array<{id: string, timestamp: number, tag?: string, content: string}>>([]);
  const { user, elapsedMinutes } = React.useContext(AppContext);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Detect demo mode from URL parameter
  const isDemo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === 'true';
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Fetch initial AI message when entering learn mode (skip in demo mode)
  useEffect(() => {
    if (!showIntro && !isDemo) {
      fetch(`${API_URL}/chat/init`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setChatHistory([{
              sender: 'assistant',
              text: data.reply,
              pairs: data.agent_attribute_pairs,
              messageType: data.message_type || 'test_scenario',
              missingDataTypes: data.missing_data_types || [],
              discoveredRequirements: data.discovered_requirements || []
            }]);
            if (data.agent_attribute_pairs && Object.keys(data.agent_attribute_pairs).length > 0) {
              setCurrentAgentData(data.agent_attribute_pairs);
            }
          }
        })
        .catch(err => console.error('Failed to load initial message:', err));
    }
  }, [showIntro, isDemo]);

  // Clear stale state on mount, start fresh each session
  useEffect(() => {
    if (user) {
      localStorage.removeItem(`learn_workspace_${user.id}`);
      localStorage.removeItem(`learn_chat_${user.id}`);
      setScratchpad('');
      setNotes([]);
    }
  }, [user]);

  // Save workspace to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`learn_workspace_${user.id}`, JSON.stringify({ scratchpad, notes }));
    }
  }, [user, scratchpad, notes]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    if (user && !isDemo) {
      const savedChat = localStorage.getItem(`learn_chat_${user.id}`);
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatHistory(parsed);
          }
        } catch {}
      }
    }
  }, [user, isDemo]);

  // Persist chat history to localStorage on change
  useEffect(() => {
    if (user && chatHistory.length > 0 && !isDemo) {
      localStorage.setItem(`learn_chat_${user.id}`, JSON.stringify(chatHistory));
    }
  }, [user, chatHistory, isDemo]);

  // Load demo conversation when ?demo=true and intro is dismissed
  useEffect(() => {
    if (isDemo && !showIntro) {
      setChatHistory(demoConversation);
      // Set grid to the last scenario with agent data
      const lastWithPairs = [...demoConversation].reverse().find(m => m.pairs && Object.keys(m.pairs).length > 0);
      if (lastWithPairs?.pairs) {
        setCurrentAgentData(lastWithPairs.pairs);
      }
    }
  }, [isDemo, showIntro]);

  // Compute all discovered requirements across chat history
  const allDiscoveredRequirements = useMemo(() => {
    const reqs: string[] = [];
    const seen = new Set<string>();
    chatHistory.forEach(msg => {
      if (msg.discoveredRequirements) {
        msg.discoveredRequirements.forEach(r => {
          if (!seen.has(r)) {
            seen.add(r);
            reqs.push(r);
          }
        });
      }
    });
    return reqs;
  }, [chatHistory]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !user || isSending) return;

    const userMessage = chatMessage;
    setChatMessage('');
    setIsSending(true);

    setChatHistory(prev => [...prev, { sender: 'user', text: userMessage }]);

    try {
      // Build conversation history for context
      const history = chatHistory.slice(-20).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: userMessage,
          timestamp_minutes: elapsedMinutes,
          history
        })
      });

      const data = await response.json();

      if (data.success) {
        let displayText = data.reply;
        displayText = displayText.replace(/```json\s*\{.*?\}\s*```/gs, '').trim();

        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: displayText,
          pairs: data.agent_attribute_pairs,
          messageType: data.message_type || 'clarification',
          missingDataTypes: data.missing_data_types || [],
          discoveredRequirements: data.discovered_requirements || []
        }]);

        if (data.agent_attribute_pairs && Object.keys(data.agent_attribute_pairs).length > 0) {
          setCurrentAgentData(data.agent_attribute_pairs);
        }
      } else {
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: 'Sorry, I encountered an error processing your message.'
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, {
        sender: 'assistant',
        text: 'Unable to connect to server. Please try again.'
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!testDataTypes.trim() && !testCase.trim() && !testExpected.trim()) return;
    if (!user || isSending) return;

    const testMessage = `[RUN_TEST]\nData Types:\n${testDataTypes}\n\nTest Case:\n${testCase}\n\nExpected Output:\n${testExpected}`;

    setIsSending(true);
    setChatHistory(prev => [...prev, {
      sender: 'user',
      text: testMessage,
      messageType: 'run_test'
    }]);

    try {
      const history = chatHistory.slice(-20).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          message: testMessage,
          timestamp_minutes: elapsedMinutes,
          history
        })
      });

      const data = await response.json();

      if (data.success) {
        let displayText = data.reply;
        displayText = displayText.replace(/```json\s*\{.*?\}\s*```/gs, '').trim();

        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: displayText,
          pairs: data.agent_attribute_pairs,
          messageType: data.message_type || 'clarification',
          missingDataTypes: data.missing_data_types || [],
          discoveredRequirements: data.discovered_requirements || []
        }]);

        if (data.agent_attribute_pairs && Object.keys(data.agent_attribute_pairs).length > 0) {
          setCurrentAgentData(data.agent_attribute_pairs);
        }
      } else {
        setChatHistory(prev => [...prev, {
          sender: 'assistant',
          text: 'Sorry, I encountered an error processing your test.'
        }]);
      }
    } catch (error) {
      console.error('Test error:', error);
      setChatHistory(prev => [...prev, {
        sender: 'assistant',
        text: 'Unable to connect to server. Please try again.'
      }]);
    } finally {
      setIsSending(false);
      setTestDataTypes('');
      setTestCase('');
      setTestExpected('');
    }
  };

  const addToWorkspace = (content: string, tag?: string) => {
    setNotes(prev => [...prev, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      tag,
      content
    }]);
  };

  const removeNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const parseLocation = (location: string): { x: number, y: number } | null => {
    if (!location) return null;
    const coordMatch = location.match(/\((\d+),\s*(\d+)\)/);
    if (coordMatch) {
      return { x: parseInt(coordMatch[1]), y: parseInt(coordMatch[2]) };
    }
    return null;
  };

  const getAgentColor = (agentName: string): string => {
    if (agentName.includes('rider')) return '#2196f3';
    if (agentName.includes('vehicle')) return '#f44336';
    return '#333';
  };

  const getAgentIcon = (agentName: string): string => {
    if (agentName.startsWith('rider')) return '/icons/rider.svg';
    if (agentName.startsWith('vehicle')) return '/icons/vehicle.svg';
    return '/icons/system.svg';
  };

  const getAgentFilter = (agentName: string): string => {
    if (agentName.includes('rider')) return 'invert(42%) sepia(93%) saturate(1352%) hue-rotate(196deg) brightness(100%) contrast(101%)';
    if (agentName.includes('vehicle')) return 'invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)';
    return 'none';
  };

  const getAgentLabel = (agentName: string): string => {
    if (agentName.startsWith('rider')) return 'R' + (agentName.match(/\d+/)?.[0] || '');
    if (agentName.startsWith('vehicle')) return 'V' + (agentName.match(/\d+/)?.[0] || '');
    return agentName[0].toUpperCase();
  };

  const renderAgentsOnGrid = () => {
    if (!currentAgentData) return null;
    const agents: any[] = [];
    Object.keys(currentAgentData).forEach((agentName) => {
      const agentAttrs = currentAgentData[agentName];
      let location: { x: number; y: number } | null = null;
      if (agentAttrs.pickup_location) {
        location = parseLocation(agentAttrs.pickup_location);
      } else if (agentAttrs.car_cur_location) {
        location = parseLocation(agentAttrs.car_cur_location);
      }
      if (location) {
        location.x = Math.min(location.x, 19);
        location.y = Math.min(location.y, 19);
        agents.push({ name: agentName, location, color: getAgentColor(agentName), icon: getAgentIcon(agentName), filter: getAgentFilter(agentName), label: getAgentLabel(agentName), attrs: agentAttrs });
      }
    });
    return agents;
  };

  const agentsToDisplay = renderAgentsOnGrid();

  if (showIntro) {
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
          maxWidth: '640px',
          lineHeight: '1.6'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Rideshare Matching System</h2>
          <p style={{ marginBottom: '12px', color: '#333' }}>
            A city operates a fleet of autonomous vehicles that provide on-demand rides to passengers.
            Passengers request rides through an app, and the system matches them with available vehicles,
            aiming to minimize wait time and pickup distance.
          </p>
          <div style={{ backgroundColor: '#f0f4ff', border: '1px solid #c0d0f0', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>Your Role: Teaching Assistant</div>
            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#333' }}>
              You will interact with <strong>Alex</strong>, a CS1 student who is building this rideshare system.
              Alex's code has bugs and missing requirements — your job is to help Alex discover them through testing.
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: '#444' }}>
              <li style={{ marginBottom: '4px' }}>Guide Alex to write test cases that expose flawed matching logic</li>
              <li style={{ marginBottom: '4px' }}>Help identify missing data fields (e.g., timestamps, accessibility flags)</li>
              <li style={{ marginBottom: '4px' }}>Use the simulation grid to visualize test scenarios with riders and vehicles</li>
              <li>Specify your own tests in natural language and observe the results</li>
            </ul>
          </div>
          <button
            onClick={() => setShowIntro(false)}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Begin Session
          </button>
        </div>
      </div>
    );
  }

  const CELL = 32;
  const GRID = 20;

  const sectionHeader = (text: string) => (
    <div style={{ fontSize: '11px', fontWeight: 700, color: '#333', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #e0e0e0' }}>
      {text}
    </div>
  );

  // Tag colors for workspace notes
  const tagColors: Record<string, {bg: string, border: string, text: string}> = {
    requirement: { bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32' },
    'test-idea': { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' },
    observation: { bg: '#fff8e1', border: '#ffe082', text: '#f57f17' },
  };

  // Simple markdown renderer for chat messages
  const renderMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    // Split by code blocks first, then handle inline formatting
    const segments = text.split(/(`[^`]+`)/g);
    segments.forEach((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        parts.push(<code key={i} style={{ backgroundColor: 'rgba(0,0,0,0.15)', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }}>{seg.slice(1, -1)}</code>);
      } else {
        // Handle **bold** and *italic*
        const boldItalic = seg.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        boldItalic.forEach((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            parts.push(<strong key={`${i}-${j}`}>{part.slice(2, -2)}</strong>);
          } else if (part.startsWith('*') && part.endsWith('*')) {
            parts.push(<em key={`${i}-${j}`}>{part.slice(1, -1)}</em>);
          } else {
            parts.push(part);
          }
        });
      }
    });
    return parts;
  };

  // Structured chat card renderer
  const renderChatMessage = (msg: typeof chatHistory[0], idx: number) => {
    if (msg.sender === 'user') {
      if (msg.messageType === 'run_test') {
        // Parse structured test from the message
        const parts = msg.text.split('\n\n');
        return (
          <div key={idx} style={{ marginBottom: '12px', maxWidth: '90%', marginLeft: 'auto' }}>
            <div style={{ borderRight: '3px solid #e65100', backgroundColor: '#fff3e0', borderRadius: '4px 0 0 4px', overflow: 'hidden' }}>
              <div style={{ padding: '6px 12px', borderBottom: '1px solid #ffcc8033', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#e65100', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>TEST SUBMITTED</span>
              </div>
              <pre style={{ padding: '8px 12px', fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap' as const, color: '#333', lineHeight: '1.5', fontFamily: 'monospace' }}>
                {msg.text.replace('[RUN_TEST]\n', '')}
              </pre>
            </div>
          </div>
        );
      }
      return (
        <div key={idx} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#007bff', color: '#fff', fontSize: '13px', maxWidth: '85%', borderRadius: '4px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.4' }}>
            {renderMarkdown(msg.text)}
          </div>
        </div>
      );
    }

    // Determine card style based on messageType
    const mtype = msg.messageType || 'clarification';
    const cardStyles: Record<string, {borderColor: string, bgColor: string, label: string}> = {
      probe: { borderColor: '#ff9800', bgColor: '#fff8e1', label: 'NEEDS INPUT' },
      test_scenario: { borderColor: '#4caf50', bgColor: '#f1f8e9', label: 'TEST SCENARIO' },
      discovery: { borderColor: '#2196f3', bgColor: '#e3f2fd', label: 'REQUIREMENT DISCOVERED' },
      clarification: { borderColor: '#e0e0e0', bgColor: '#f5f5f5', label: '' },
    };
    const style = cardStyles[mtype] || cardStyles.clarification;

    // For plain clarification, render a simple bubble
    if (mtype === 'clarification') {
      return (
        <div key={idx} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#e8e8e8', color: '#000', fontSize: '13px', maxWidth: '85%', borderRadius: '4px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.4' }}>
            {renderMarkdown(msg.text)}
            {msg.pairs && Object.keys(msg.pairs).length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '10px', opacity: 0.7, borderTop: '1px solid rgba(0,0,0,0.15)', paddingTop: '4px' }}>
                Grid updated
              </div>
            )}
          </div>
        </div>
      );
    }

    // Structured card for probe, test_scenario, discovery
    return (
      <div key={idx} style={{ marginBottom: '12px', maxWidth: '90%' }}>
        <div style={{ borderLeft: `3px solid ${style.borderColor}`, backgroundColor: style.bgColor, borderRadius: '0 4px 4px 0', overflow: 'hidden' }}>
          {/* Card header */}
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${style.borderColor}20`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: style.borderColor, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
              {style.label}
            </span>
          </div>
          {/* Card body */}
          <div style={{ padding: '10px 12px', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' as const, color: '#333' }}>
            {renderMarkdown(msg.text)}
          </div>
          {/* Missing data chips for probes */}
          {mtype === 'probe' && msg.missingDataTypes && msg.missingDataTypes.length > 0 && (
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
              {msg.missingDataTypes.map((dt, i) => (
                <span key={i} style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '12px', color: '#e65100' }}>
                  ? {dt}
                </span>
              ))}
            </div>
          )}
          {/* Test scenario JSON preview */}
          {mtype === 'test_scenario' && msg.pairs && Object.keys(msg.pairs).length > 0 && (
            <div style={{ padding: '0 12px 10px' }}>
              <pre style={{ backgroundColor: '#263238', color: '#aed581', padding: '8px', fontSize: '10px', borderRadius: '3px', overflow: 'auto', maxHeight: '120px', margin: 0 }}>
                {JSON.stringify(msg.pairs, null, 2)}
              </pre>
            </div>
          )}
          {/* Discovered requirements */}
          {mtype === 'discovery' && msg.discoveredRequirements && msg.discoveredRequirements.length > 0 && (
            <div style={{ padding: '0 12px 10px' }}>
              {msg.discoveredRequirements.map((req, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#1565c0', flex: 1 }}>{req}</span>
                  <button
                    onClick={() => addToWorkspace(req, 'requirement')}
                    style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #90caf9', backgroundColor: '#e3f2fd', color: '#1565c0', cursor: 'pointer', borderRadius: '3px', whiteSpace: 'nowrap' as const }}
                  >
                    + Save
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Save test to workspace button */}
          {mtype === 'test_scenario' && msg.pairs && Object.keys(msg.pairs).length > 0 && (
            <div style={{ padding: '0 12px 8px' }}>
              <button
                onClick={() => addToWorkspace(`Test: ${msg.text.slice(0, 80)}...\n${JSON.stringify(msg.pairs, null, 2)}`, 'test-idea')}
                style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #a5d6a7', backgroundColor: '#e8f5e9', color: '#2e7d32', cursor: 'pointer', borderRadius: '3px' }}
              >
                + Save to Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', backgroundColor: '#f8f8f8' }}>

      {/* === LEFT PANEL: Dialogue with Alex (35%) === */}
      <div style={{ width: '35%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #d0d0d0', backgroundColor: '#fff' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#007bff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 700 }}>A</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Alex</div>
              <div style={{ fontSize: '11px', color: '#888' }}>CS1 Student</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', padding: '3px 8px', border: '1px solid #ddd', borderRadius: '3px' }}>{elapsedMinutes} min</div>
        </div>

        {/* Chat/Test mode toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
          <button
            onClick={() => setInputMode('chat')}
            style={{
              flex: 1, padding: '6px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer',
              backgroundColor: inputMode === 'chat' ? '#007bff' : '#f5f5f5',
              color: inputMode === 'chat' ? '#fff' : '#666',
              borderBottom: inputMode === 'chat' ? '2px solid #0056b3' : '2px solid transparent'
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setInputMode('test')}
            style={{
              flex: 1, padding: '6px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer',
              backgroundColor: inputMode === 'test' ? '#e65100' : '#f5f5f5',
              color: inputMode === 'test' ? '#fff' : '#666',
              borderBottom: inputMode === 'test' ? '2px solid #bf360c' : '2px solid transparent'
            }}
          >
            Run Test
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#fafafa' }}>
          {chatHistory.map((msg, idx) => renderChatMessage(msg, idx))}
          <div ref={chatEndRef} />
        </div>

        {inputMode === 'chat' ? (
          <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              value={chatMessage}
              onChange={(e) => {
                setChatMessage(e.target.value);
                // Auto-expand
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message Alex (describe tests, ask questions, define requirements)... Shift+Enter for newline"
              disabled={isSending}
              rows={1}
              style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid #ccc', outline: 'none', borderRadius: '3px', resize: 'none' as const, lineHeight: '1.4', fontFamily: 'inherit', overflow: 'hidden', minHeight: '36px', maxHeight: '160px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isSending}
              style={{ padding: '8px 16px', fontSize: '12px', border: 'none', backgroundColor: isSending ? '#ccc' : '#007bff', color: '#fff', cursor: isSending ? 'not-allowed' : 'pointer', borderRadius: '3px', flexShrink: 0 }}
            >
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '10px', borderTop: '2px solid #e65100', backgroundColor: '#fff3e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#e65100', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Submit Test Case</div>
              <button
                onClick={() => {
                  setTestCase('There is only one vehicle currently active in the system. It is currently occupied with passengers. Rider 1 is located five blocks from the current location of the vehicle while it travels to its destination. Rider 2 is located three blocks away from the current location of the vehicle. Rider 2 requested a ride at 13:10, while Rider 1 requested a ride ten minutes earlier at 13:00. The vehicle is currently occupied and en route to a destination that is one block north of Rider 1\'s pickup location. The destination of Rider 1 is two blocks away from Rider 2\'s pickup location.');
                  setTestExpected('Assign itself to Rider 1 while en route to its drop off location, drop off its current passengers, pick up Rider 1, assign itself to Rider 2, drop off Rider 1, pick up Rider 2.');
                }}
                style={{ fontSize: '10px', padding: '2px 8px', border: '1px solid #e65100', backgroundColor: 'transparent', color: '#e65100', cursor: 'pointer', borderRadius: '3px', fontWeight: 600 }}
              >
                Demo
              </button>
            </div>
            <textarea
              value={testDataTypes}
              onChange={(e) => setTestDataTypes(e.target.value)}
              placeholder="Data types & values, e.g.:\nrider_1.pickup_location = (3, 4)\nvehicle_1.car_cur_location = (1, 2)\nvehicle_1.occupied = false"
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', resize: 'vertical' as const, minHeight: '50px', fontFamily: 'monospace', marginBottom: '4px' }}
            />
            <textarea
              value={testCase}
              onChange={(e) => setTestCase(e.target.value)}
              placeholder="Test case: what action/scenario to test, e.g.:\nRider 1 requests a ride. Which vehicle is assigned?"
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', resize: 'vertical' as const, minHeight: '36px', marginBottom: '4px' }}
            />
            <textarea
              value={testExpected}
              onChange={(e) => setTestExpected(e.target.value)}
              placeholder="Expected output, e.g.:\nvehicle_1 is assigned to rider_1"
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', resize: 'vertical' as const, minHeight: '36px', marginBottom: '6px' }}
            />
            <button
              onClick={handleSubmitTest}
              disabled={isSending}
              style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: 600, border: 'none', backgroundColor: isSending ? '#ccc' : '#e65100', color: '#fff', cursor: isSending ? 'not-allowed' : 'pointer', borderRadius: '3px' }}
            >
              {isSending ? 'Running...' : 'Run Test'}
            </button>
          </div>
        )}
      </div>

      {/* === CENTER PANEL: Simulation Grid (40%) === */}
      <div style={{ width: '40%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #d0d0d0', backgroundColor: '#fff', overflowY: 'auto' }}>
        <div style={{ padding: '16px' }}>
          {sectionHeader('Simulation Grid')}
          <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`, gap: '0px', width: 'fit-content', border: '1px solid #ccc' }}>
              {Array.from({ length: GRID * GRID }, (_, i) => (
                <div key={i} style={{ borderRight: '1px solid #e8e8e8', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fff', width: `${CELL}px`, height: `${CELL}px` }} />
              ))}
            </div>
            {agentsToDisplay && agentsToDisplay.map((agent, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${agent.location.x * CELL + 1}px`,
                  top: `${agent.location.y * CELL + 1}px`,
                  width: `${CELL}px`,
                  height: `${CELL}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none' as const
                }}
                title={`${agent.name}: ${JSON.stringify(agent.attrs)}`}
              >
                <img
                  src={agent.icon}
                  alt={agent.label}
                  style={{ width: `${CELL - 2}px`, height: `${CELL - 2}px`, filter: agent.filter }}
                />
              </div>
            ))}
          </div>

          {currentAgentData && Object.keys(currentAgentData).length > 0 && (
            <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600 }}>Current Scenario:</span>
                <button onClick={() => setCurrentAgentData(null)} style={{ fontSize: '10px', border: '1px solid #ccc', backgroundColor: '#fff', padding: '1px 6px', cursor: 'pointer' }}>Clear</button>
              </div>
              {Object.entries(currentAgentData).map(([name, attrs]: [string, any]) => (
                <div key={name} style={{ color: '#555' }}>
                  <span style={{ fontWeight: 600, color: getAgentColor(name) }}>{name}:</span>{' '}
                  {Object.entries(attrs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === RIGHT PANEL: Workspace (25%) === */}
      <div style={{ width: '25%', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', overflowY: 'auto' }}>
        <div style={{ padding: '16px' }}>
          {sectionHeader('Workspace')}

          <textarea
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            style={{ width: '100%', minHeight: '120px', padding: '8px', fontSize: '12px', border: '1px solid #ccc', resize: 'vertical' as const, fontFamily: 'inherit', borderRadius: '3px', marginBottom: '8px', lineHeight: '1.5' }}
            placeholder="Write notes, draft test ideas, document requirements..."
          />
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
            {(['requirement', 'test-idea', 'observation'] as const).map(tag => (
              <button
                key={tag}
                onClick={() => { if (scratchpad.trim()) { addToWorkspace(scratchpad.trim(), tag); setScratchpad(''); } }}
                disabled={!scratchpad.trim()}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: '10px', border: `1px solid ${tagColors[tag]?.border || '#ccc'}`,
                  backgroundColor: scratchpad.trim() ? (tagColors[tag]?.bg || '#f5f5f5') : '#f5f5f5',
                  color: scratchpad.trim() ? (tagColors[tag]?.text || '#666') : '#aaa',
                  cursor: scratchpad.trim() ? 'pointer' : 'not-allowed', borderRadius: '3px', fontWeight: 600
                }}
              >
                + {tag}
              </button>
            ))}
          </div>

          {/* Requirements Discovered counter */}
          {allDiscoveredRequirements.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '10px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#1565c0', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                  Requirements Discovered
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#1565c0', backgroundColor: '#bbdefb', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {allDiscoveredRequirements.length}
                </span>
              </div>
              {allDiscoveredRequirements.map((req, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px', fontSize: '11px', color: '#333', lineHeight: '1.4' }}>
                  <span style={{ color: '#1565c0', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{req}</span>
                </div>
              ))}
            </div>
          )}

          {notes.length > 0 && (
            <>
              {sectionHeader(`Notes (${notes.length})`)}
              {notes.map(note => (
                <div key={note.id} style={{ marginBottom: '8px', padding: '8px', backgroundColor: tagColors[note.tag || '']?.bg || '#f9f9f9', border: `1px solid ${tagColors[note.tag || '']?.border || '#e0e0e0'}`, borderRadius: '3px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    {note.tag && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: tagColors[note.tag]?.text || '#666', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>
                        {note.tag}
                      </span>
                    )}
                    <button
                      onClick={() => removeNote(note.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: '#999', padding: '0' }}
                    >
                      {'\u00d7'}
                    </button>
                  </div>
                  <div style={{ color: '#333', whiteSpace: 'pre-wrap' as const, lineHeight: '1.4' }}>{note.content}</div>
                </div>
              ))}
            </>
          )}

          {notes.length === 0 && (
            <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic', textAlign: 'center' as const, padding: '20px 0' }}>
              Notes you save will appear here. Use the buttons above or "Save" from chat cards.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
