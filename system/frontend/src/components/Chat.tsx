import React, { useState, useEffect, useRef } from 'react';
import '../styles/Chat.css';

interface Message {
  role: 'user' | 'alex' | 'system';
  content: string;
  timestamp: string;
  confusion_level?: number;
}

interface InterventionState {
  session_id: string;
  phase: string;
  dimensions_identified: string[];
  requirements_surfaced: any[];
  confusion_level: number;
  tests_executed: any[];
  message_count: number;
}

interface ChatProps {
  sessionId: string;
}

export function Chat({ sessionId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [state, setState] = useState<InterventionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const socket = new WebSocket(`ws://localhost:8000/ws/chat/${sessionId}`);

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setIsTyping(false);

      if (data.error) {
        console.error('Error from server:', data.content);
        return;
      }

      // Add Alex's message
      setMessages(prev => [...prev, {
        role: data.role,
        content: data.content,
        timestamp: new Date().toISOString(),
        confusion_level: data.metadata?.confusion_level
      }]);

      // Update state
      if (data.state) {
        setState(data.state);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    setWs(socket);

    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, [sessionId]);

  // Load initial message from session creation
  useEffect(() => {
    fetch(`http://localhost:8000/api/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (data.state) {
          setState(data.state);
        }
      })
      .catch(err => console.error('Error loading session:', err));
  }, [sessionId]);

  const sendMessage = () => {
    if (!ws || !input.trim() || !isConnected) return;

    // Add user message to display
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Send to server
    ws.send(input);

    // Clear input and show typing indicator
    setInput('');
    setIsTyping(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getPhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'charter_construction':
        return 'Charter Construction';
      case 'test_execution':
        return 'Test Execution';
      case 'requirement_synthesis':
        return 'Requirement Synthesis';
      default:
        return phase;
    }
  };

  const getConfusionColor = (level: number) => {
    if (level <= 2) return '#4caf50'; // Green
    if (level <= 5) return '#ff9800'; // Orange
    if (level <= 8) return '#ff5722'; // Deep orange
    return '#f44336'; // Red
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-left">
          <h3>Conversation with Alex</h3>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
        {state && (
          <div className="header-right">
            <div className="state-info">
              <span className="state-label">Phase:</span>
              <span className="state-value">{getPhaseDisplay(state.phase)}</span>
            </div>
            <div className="state-info">
              <span className="state-label">Confusion:</span>
              <span
                className="state-value confusion-level"
                style={{ color: getConfusionColor(state.confusion_level) }}
              >
                {state.confusion_level}/10
              </span>
            </div>
            <div className="state-info">
              <span className="state-label">Dimensions:</span>
              <span className="state-value">{state.dimensions_identified.length}</span>
            </div>
            <div className="state-info">
              <span className="state-label">Requirements:</span>
              <span className="state-value">{state.requirements_surfaced.length}</span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-header">
              <strong className="message-sender">
                {msg.role === 'user' ? 'You' : msg.role === 'alex' ? 'Alex' : 'System'}
              </strong>
              {msg.confusion_level !== undefined && (
                <span
                  className="message-confusion"
                  style={{ color: getConfusionColor(msg.confusion_level) }}
                >
                  Confusion: {msg.confusion_level}/10
                </span>
              )}
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {isTyping && (
          <div className="message message-alex typing-indicator">
            <div className="message-header">
              <strong className="message-sender">Alex</strong>
            </div>
            <div className="message-content">
              <span className="typing-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Shift+Enter for new line)"
          rows={2}
          disabled={!isConnected}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !isConnected}
        >
          Send
        </button>
      </div>

      {state && state.dimensions_identified.length > 0 && (
        <div className="dimensions-panel">
          <h4>Dimensions Identified:</h4>
          <ul>
            {state.dimensions_identified.map((dim, idx) => (
              <li key={idx}>{dim}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
