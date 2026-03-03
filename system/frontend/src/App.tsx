import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import 'katex/dist/katex.min.css';
import { LibraryMockup } from './LibraryMockup';
import { SlideViewer } from './SlideViewer';
import { MockupPage } from './MockupPage';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface User {
  id: string;
  subject_number: number;
  preferred_name: string;
}

interface AppContextType {
  user: User | null;
  studyStartTime: number | null;
  elapsedMinutes: number;
}

const AppContext = React.createContext<AppContextType>({
  user: null,
  studyStartTime: null,
  elapsedMinutes: 0
});

function LoginPage({ onLogin }: { onLogin: (user: User, startTime: number) => void }) {
  const [subjectNumber, setSubjectNumber] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!subjectNumber.trim() || !preferredName.trim()) {
      setLoginError('Please fill in both fields');
      return;
    }

    const numericSubjectNumber = parseInt(subjectNumber);
    if (isNaN(numericSubjectNumber)) {
      setLoginError('Subject number must be a valid number');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_number: numericSubjectNumber,
          preferred_name: preferredName
        })
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.user, Date.now());
      } else {
        setLoginError('Registration failed');
      }
    } catch (error) {
      setLoginError('Unable to connect to server');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        width: '400px'
      }}>
        <h2 style={{ marginTop: '0', marginBottom: '24px', fontSize: '20px', color: '#000' }}>
          Study Login
        </h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#000' }}>
            Subject Number
          </label>
          <input
            type="text"
            value={subjectNumber}
            onChange={(e) => setSubjectNumber(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ccc',
              outline: 'none'
            }}
            disabled={isLoading}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#000' }}>
            Preferred Name
          </label>
          <input
            type="text"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ccc',
              outline: 'none'
            }}
            disabled={isLoading}
          />
        </div>

        {loginError && (
          <div style={{
            padding: '8px',
            marginBottom: '16px',
            backgroundColor: '#fee',
            color: '#c00',
            fontSize: '13px',
            border: '1px solid #fcc'
          }}>
            {loginError}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #007bff',
            backgroundColor: isLoading ? '#ccc' : '#007bff',
            color: 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Loading...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function NavigationMenu() {
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

function PaperworkPage() {
  const [latexContent, setLatexContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { user } = React.useContext(AppContext);
  const navigate = useNavigate();

  const [participantSignature, setParticipantSignature] = useState('');
  const [participantDate, setParticipantDate] = useState('');
  const [printedName, setPrintedName] = useState('');

  useEffect(() => {
    // Load informed consent form on mount
    fetch('/informed_consent.tex')
      .then(response => response.text())
      .then(content => {
        setLatexContent(content);
        compileLatex(content);
      })
      .catch(err => {
        setError('Failed to load consent form');
        console.error('Load error:', err);
      });
  }, []);

  const compileLatex = async (content: string) => {
    setIsCompiling(true);
    setError('');

    try {
      if (previewRef.current) {
        const lines = content.split('\n');
        let html = '<div style="font-family: \'Times New Roman\', Times, serif; font-size: 11pt; line-height: 1.6; max-width: 8.5in; margin: 0 auto; padding: 1in; background: white;">';
        let inDocument = false;
        let inCenter = false;
        let inTabular = false;
        let skipNextLine = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (skipNextLine) {
            skipNextLine = false;
            continue;
          }
          
          let line = lines[i];
          
          if (line.includes('\\begin{document}')) {
            inDocument = true;
            continue;
          }
          if (line.includes('\\end{document}')) {
            break;
          }
          if (!inDocument) continue;
          
          // Handle center environment
          if (line.includes('\\begin{center}')) {
            inCenter = true;
            html += '<div style="text-align: center; margin-bottom: 1.5em;">';
            continue;
          }
          if (line.includes('\\end{center}')) {
            inCenter = false;
            html += '</div>';
            continue;
          }
          
          // Handle tabular for signatures
          if (line.includes('\\begin{tabular}')) {
            inTabular = true;
            html += '<div style="margin-top: 2em;"><table style="width: 100%; border-collapse: collapse;">';
            continue;
          }
          if (line.includes('\\end{tabular}')) {
            inTabular = false;
            html += '</table></div>';
            continue;
          }
          
          if (inTabular) {
            if (line.includes('\\hrulefill')) {
              const parts = line.split('&');
              
              // Peek at next line for labels
              if (i + 1 < lines.length) {
                const labelLine = lines[i + 1];
                
                if (parts.length === 5) {
                  // Single row: Participant Signature, Printed Name, Date
                  const labelMatch = labelLine.match(/([^&]+)&\s*&\s*([^&]+)&\s*&\s*([^\\]+)/);
                  const today = new Date().toISOString().split('T')[0];
                  html += '<tr>';
                  html += `<td style="width: 32%; padding: 12px 4px; vertical-align: bottom;"><input type="text" class="sig-field sig-cursive" data-field="participantSignature" placeholder="Type your name" style="width: 100%; border: none; border-bottom: 1px solid #000; padding: 6px 2px; font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 16pt; background: transparent;" /></td>`;
                  html += '<td style="width: 2%;"></td>';
                  html += `<td style="width: 32%; padding: 12px 4px; vertical-align: bottom;"><input type="text" class="sig-field" data-field="printedName" placeholder="Print your name" style="width: 100%; border: none; border-bottom: 1px solid #000; padding: 6px 2px; font-family: 'Times New Roman', Times, serif; font-size: 11pt; background: transparent;" /></td>`;
                  html += '<td style="width: 2%;"></td>';
                  html += `<td style="width: 32%; padding: 12px 4px; vertical-align: bottom;"><input type="date" class="sig-field" data-field="participantDate" value="${today}" style="width: 100%; border: none; border-bottom: 1px solid #000; padding: 6px 2px; font-family: 'Times New Roman', Times, serif; font-size: 11pt; background: transparent;" /></td>`;
                  html += '</tr>';
                  if (labelMatch) {
                    html += '<tr>';
                    html += `<td style="font-size: 10pt; padding: 4px 4px 0 4px;">${labelMatch[1].trim()}</td>`;
                    html += '<td></td>';
                    html += `<td style="font-size: 10pt; padding: 4px 4px 0 4px;">${labelMatch[2].trim()}</td>`;
                    html += '<td></td>';
                    html += `<td style="font-size: 10pt; padding: 4px 4px 0 4px;">${labelMatch[3].trim()}</td>`;
                    html += '</tr>';
                  }
                  skipNextLine = true;
                }
              }
            }
            continue;
          }
          
          // Handle spacing commands
          if (line.includes('\\vspace')) {
            const match = line.match(/\\vspace\{([\d.]+)em\}/);
            if (match) {
              html += `<div style="height: ${match[1]}em;"></div>`;
            }
            continue;
          }
          
          // Skip empty lines
          if (line.trim() === '') {
            continue;
          }
          
          // Process text lines
          let processedLine = line
            .replace(/\\textbf\{\\large ([^}]+)\}/g, '<strong style="font-size: 1.15em; display: block;">$1</strong>')
            .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
            .replace(/\\noindent/g, '')
            .replace(/\\\\\[[\d.]+em\]/g, '<br>')
            .replace(/\\\\/g, '<br>')
            .replace(/\$\\\$(\d+)\$\$/g, '$$1')
            .replace(/\$/g, '');
          
          if (processedLine.trim()) {
            if (inCenter) {
              html += `<div style="margin-bottom: 0.4em; line-height: 1.4;">${processedLine}</div>`;
            } else {
              html += `<p style="margin: 0 0 1em 0; text-align: justify; text-indent: 0; line-height: 1.6;">${processedLine}</p>`;
            }
          }
        }
        
        html += '</div>';
        previewRef.current.innerHTML = html;
        
        // Attach event listeners to signature fields
        const sigFields = previewRef.current.querySelectorAll('.sig-field');
        sigFields.forEach((field) => {
          const inputField = field as HTMLInputElement;
          const dataField = inputField.getAttribute('data-field');
          
          // Set initial values
          if (dataField === 'participantDate') {
            setParticipantDate(inputField.value);
          }
          
          inputField.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            if (dataField === 'participantSignature') setParticipantSignature(target.value);
            else if (dataField === 'participantDate') setParticipantDate(target.value);
            else if (dataField === 'printedName') setPrintedName(target.value);
          });
        });
      }
    } catch (err) {
      setError(`Compilation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('LaTeX compilation error:', err);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSubmit = async () => {
    if (!participantSignature || !participantDate || !printedName) {
      setError('Please fill in all required signature fields');
      return;
    }

    if (!user) {
      setError('User not logged in');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Create consent data object
      const consentData = {
        user_id: user.id || null,
        subject_number: user.subject_number,
        participant_signature: participantSignature,
        participant_date: participantDate,
        printed_name: printedName,
        submitted_at: new Date().toISOString()
      };

      // Store in Supabase
      const response = await fetch(`${API_URL}/consent/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consentData)
      });

      const data = await response.json();

      if (data.success) {
        setSubmitSuccess(true);
        // Redirect to menu after 1.5 seconds
        setTimeout(() => {
          navigate('/menu');
        }, 1500);
      } else {
        setError('Failed to submit consent form');
      }
    } catch (err) {
      setError('Unable to connect to server');
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Arial", sans-serif'
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #ccc',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#000' }}>
            Sign Informed Consent Forms
          </h2>

          {isCompiling && (
            <div style={{ fontSize: '14px', color: '#666' }}>
              Loading consent form...
            </div>
          )}

          {error && (
            <div style={{ fontSize: '14px', color: '#c00', padding: '8px', backgroundColor: '#fee', border: '1px solid #fcc' }}>
              {error}
            </div>
          )}

          {submitSuccess && (
            <div style={{ fontSize: '14px', color: '#060', padding: '8px', backgroundColor: '#efe', border: '1px solid #cfc' }}>
              Consent form submitted successfully! Redirecting to menu...
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/menu')}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            border: '1px solid #666',
            backgroundColor: 'white',
            color: '#000',
            cursor: 'pointer',
            marginLeft: '20px'
          }}
        >
          Return to Menu
        </button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '8.5in',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0'
        }}>
          <div
            ref={previewRef}
            className="latex-document"
            style={{
              backgroundColor: 'white',
              padding: latexContent ? '0' : '0',
              minHeight: latexContent ? '600px' : '0',
              border: latexContent ? '1px solid #ccc' : 'none',
              boxShadow: latexContent ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          />

          {latexContent && !submitSuccess && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                padding: '14px 40px',
                fontSize: '15px',
                border: '1px solid #007bff',
                backgroundColor: isSubmitting ? '#ccc' : '#007bff',
                color: 'white',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: '20px',
                width: '100%'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Consent Form'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreAssessmentPage() {
  const { user } = React.useContext(AppContext);
  const navigate = useNavigate();
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(1200); // 20 minutes in seconds

  // Question responses
  const [q1Response, setQ1Response] = useState('');
  const [sampleInteractions, setSampleInteractions] = useState([
    {
      scenario: 'Borrower searches for "Pride and Prejudice," hoping to check out the book.',
      systemResponse: 'Displays the title, the number of available copies, and the loan duration.',
      agents: '',
      when: '',
      systemShould: '',
      using: ''
    },
    {
      scenario: 'Borrower borrows "Pride and Prejudice."',
      systemResponse: 'Confirms the loan and displays the due date.',
      agents: '',
      when: '',
      systemShould: '',
      using: ''
    }
  ]);
  const [q2DataTypes, setQ2DataTypes] = useState('');
  const [q2Agents, setQ2Agents] = useState('');
  const [q2When, setQ2When] = useState('');
  const [q2SystemShould, setQ2SystemShould] = useState('');
  const [q2Using, setQ2Using] = useState('');
  const [extraneousScenarios, setExtraneousScenarios] = useState([
    {
      inputs: 'borrowerID = 1234\nborrowerName = Jane Doe\nbookCheckedOut = True\nbookName = Hitchhiker\'s Guide to the Galaxy\nbookID = 1001\nbookExpiration = 1/27/2026\ncurrentDate = 1/29/2026\nextensionsRemaining = 0',
      agents: '',
      when: '',
      systemShould: '',
      using: '',
      description: ''
    },
    {
      inputs: 'book = "The Hitchhiker\'s Guide to the Galaxy"\nnumberOfBooks = 10\nnumBooksCheckedOut = 9\nnumPeopleOnWaitlist = 2\nuserID = [leave this blank]\nuserOnWaitlist = False\n\nAction: User Attempts To Request Book',
      agents: '',
      when: '',
      systemShould: '',
      using: '',
      description: ''
    }
  ]);
  const [edgeCases, setEdgeCases] = useState([
    { scenario: '', agents: '', when: '', systemShould: '', using: '' },
    { scenario: '', agents: '', when: '', systemShould: '', using: '' },
    { scenario: '', agents: '', when: '', systemShould: '', using: '' }
  ]);
  const [q5Response, setQ5Response] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Load or start assessment and timer
  useEffect(() => {
    if (!user) return;

    const loadAssessment = async () => {
      try {
        setIsLoading(true);

        // Try to get existing assessment
        const getResponse = await fetch(`${API_URL}/assessment/pre/${user.id}`);

        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.success && getData.assessment) {
            loadResponsesFromData(getData.assessment);
            return;
          }
        }

        // Start new assessment if none exists
        const startResponse = await fetch(`${API_URL}/assessment/pre/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            subject_number: user.subject_number
          })
        });

        const startData = await startResponse.json();
        if (startData.success && startData.assessment) {
          loadResponsesFromData(startData.assessment);
        }
      } catch (err) {
        setError('Failed to load assessment');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssessment();

    // Initialize timer from localStorage or start new
    const timerKey = `pre_assessment_timer_${user.id}`;
    const savedTimer = localStorage.getItem(timerKey);
    
    if (savedTimer) {
      const { startTime, duration } = JSON.parse(savedTimer);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeRemaining(remaining);
    } else {
      // Start new timer
      localStorage.setItem(timerKey, JSON.stringify({
        startTime: Date.now(),
        duration: 1200
      }));
    }
  }, [user]);

  // Timer countdown
  useEffect(() => {
    if (!user || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = Math.max(0, prev - 1);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [user, timeRemaining]);

  const loadResponsesFromData = (assessment: any) => {
    setAssessmentId(assessment.id);
    const responses = assessment.responses || {};

    if (responses.q1Response) setQ1Response(responses.q1Response);
    if (responses.sampleInteractions) setSampleInteractions(responses.sampleInteractions);
    if (responses.q2DataTypes) setQ2DataTypes(responses.q2DataTypes);
    if (responses.q2Agents) setQ2Agents(responses.q2Agents);
    if (responses.q2When) setQ2When(responses.q2When);
    if (responses.q2SystemShould) setQ2SystemShould(responses.q2SystemShould);
    if (responses.q2Using) setQ2Using(responses.q2Using);
    if (responses.extraneousScenarios) setExtraneousScenarios(responses.extraneousScenarios);
    if (responses.edgeCases) setEdgeCases(responses.edgeCases);
    if (responses.q5Response) setQ5Response(responses.q5Response);

    // Check if already submitted
    if (assessment.submitted_at) {
      setIsSubmitted(true);
    }
  };

  // Auto-save function
  const saveAssessment = async () => {
    if (!assessmentId || isSaving) return;

    try {
      setIsSaving(true);
      const responses = {
        q1Response,
        sampleInteractions,
        q2DataTypes,
        q2Agents,
        q2When,
        q2SystemShould,
        q2Using,
        extraneousScenarios,
        edgeCases,
        q5Response
      };

      await fetch(`${API_URL}/assessment/pre/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses })
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save on change (debounced)
  useEffect(() => {
    if (!assessmentId) return;
    const timer = setTimeout(() => {
      saveAssessment();
    }, 2000);
    return () => clearTimeout(timer);
  }, [q1Response, sampleInteractions, q2DataTypes, q2Agents, q2When, q2SystemShould, q2Using, extraneousScenarios, edgeCases, q5Response]);

  const handleSubmit = async () => {
    if (!assessmentId) return;

    setIsSubmitting(true);
    setError('');

    try {
      await saveAssessment();

      const response = await fetch(`${API_URL}/assessment/pre/${assessmentId}/submit`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setSubmitSuccess(true);
        setIsSubmitted(true);
        setIsEditMode(false);
        setTimeout(() => {
          setSubmitSuccess(false);
        }, 3000);
      } else {
        setError('Failed to submit assessment');
      }
    } catch (err) {
      setError('Unable to connect to server');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm('Are you sure you want to reset? This will clear all your answers and restart the timer.')) {
      return;
    }

    // Clear all responses
    setQ1Response('');
    setSampleInteractions([
      {
        scenario: 'Borrower searches for "Pride and Prejudice," hoping to check out the book.',
        systemResponse: 'Displays the title, the number of available copies, and the loan duration.',
        agents: '',
        when: '',
        systemShould: '',
        using: ''
      },
      {
        scenario: 'Borrower borrows "Pride and Prejudice."',
        systemResponse: 'Confirms the loan and displays the due date.',
        agents: '',
        when: '',
        systemShould: '',
        using: ''
      }
    ]);
    setQ2DataTypes('');
    setQ2Agents('');
    setQ2When('');
    setQ2SystemShould('');
    setQ2Using('');
    setExtraneousScenarios([
      {
        inputs: 'borrowerID = 1234\nborrowerName = Jane Doe\nbookCheckedOut = True\nbookName = Hitchhiker\'s Guide to the Galaxy\nbookID = 1001\nbookExpiration = 1/27/2026\ncurrentDate = 1/29/2026\nextensionsRemaining = 0',
        agents: '',
        when: '',
        systemShould: '',
        using: '',
        description: ''
      },
      {
        inputs: 'book = "The Hitchhiker\'s Guide to the Galaxy"\nnumberOfBooks = 10\nnumBooksCheckedOut = 9\nnumPeopleOnWaitlist = 2\nuserID = [leave this blank]\nuserOnWaitlist = False\n\nAction: User Attempts To Request Book',
        agents: '',
        when: '',
        systemShould: '',
        using: '',
        description: ''
      }
    ]);
    setEdgeCases([
      { scenario: '', agents: '', when: '', systemShould: '', using: '' },
      { scenario: '', agents: '', when: '', systemShould: '', using: '' },
      { scenario: '', agents: '', when: '', systemShould: '', using: '' }
    ]);
    setQ5Response('');
    setIsSubmitted(false);
    setIsEditMode(false);

    // Reset timer
    if (user) {
      const timerKey = `pre_assessment_timer_${user.id}`;
      localStorage.setItem(timerKey, JSON.stringify({
        startTime: Date.now(),
        duration: 1200
      }));
      setTimeRemaining(1200);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Loading assessment...</div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '900px',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Arial", sans-serif'
    }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 5px 0' }}>Digital Library Lending System</h1>
          <p style={{ margin: 0, color: '#666' }}>Study Pre-Assessment - 20 mins</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            color: timeRemaining <= 300 ? '#c00' : '#000',
            marginBottom: '5px',
            fontFamily: 'monospace'
          }}>
            {formatTime(timeRemaining)}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
            {isSaving ? 'Saving...' : 'Auto-saved'}
          </div>
          <button
            onClick={() => navigate('/menu')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fee', color: '#c00', border: '1px solid #fcc' }}>
          {error}
        </div>
      )}

      {submitSuccess && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#efe', color: '#060', border: '1px solid #cfc' }}>
          Assessment submitted successfully!
        </div>
      )}

      {isSubmitted && !isEditMode && timeRemaining > 0 && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
          <strong>Assessment Submitted</strong> - You can edit your responses until the timer runs out.
        </div>
      )}

      {timeRemaining === 0 && (
        <div style={{ padding: '15px', marginBottom: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
          <strong>Time's Up!</strong> - The assessment period has ended. {isSubmitted ? 'Your submission has been recorded.' : 'Please submit your assessment.'}
        </div>
      )}

      {/* System Description */}
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', marginBottom: '30px', border: '1px solid #ddd' }}>
        <h2 style={{ marginTop: 0 }}>System Description</h2>
        <p>
          A public library operates a <strong>digital</strong> lending system for <strong>ebooks</strong>.
          Borrowers can borrow <strong>digital</strong> titles for a limited time. The library <strong>does not</strong> carry
          any physical books. Each title has a <strong>limited number</strong> of simultaneous copies available,
          as defined by the library's licensing agreement with the publisher.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Your task:</strong> Analyze the functional requirements for this system, identify errors,
          and create test cases that expose further requirements.
        </p>
      </div>

      {/* Interactive Mockup */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px' }}>Interactive System Demo</h3>
        <LibraryMockup />
      </div>

      {/* Given Information */}
      <div style={{ marginBottom: '30px' }}>
        <h3>Given Information</h3>
        <div style={{ padding: '15px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', marginBottom: '10px' }}>
          <strong>Example question:</strong> Identify up to three types of users of the library system.
          <br />
          <em style={{ fontSize: '13px' }}>Example answer: Google Classroom's users are the teacher and the student,
          and Google Docs is used to attach supplemental assignments, which is also a system stakeholder.</em>
        </div>
        <ul>
          <li>The library account holder who wants to use the digital library</li>
          <li>The library (not the library platform, but rather the library organization)</li>
          <li>Each book/library material</li>
        </ul>
      </div>

      {/* Question 1 */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', marginBottom: '15px' }}>
          <strong>Question 1:</strong> Reread the system description. List the main things this system must be able
          to do --- the core capabilities. Don't worry about edge cases (extraneous solutions) yet; just identify
          the primary functions and features.
        </div>
        <textarea
          value={q1Response}
          onChange={(e) => setQ1Response(e.target.value)}
          disabled={isSubmitted && !isEditMode}
          style={{
            width: '100%',
            minHeight: '150px',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ccc',
            fontFamily: 'inherit',
            backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
            cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
          }}
          placeholder="Type your answer here..."
        />
      </div>

      {/* Sample Interactions Table */}
      <div style={{ marginBottom: '40px' }}>
        <h3>Sample Interactions</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <thead>
            <tr style={{ backgroundColor: '#4285f4' }}>
              <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '20%' }}>Scenario</th>
              <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '20%' }}>System Response</th>
              <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '60%' }}>Functional Requirement</th>
            </tr>
          </thead>
          <tbody>
            {sampleInteractions.map((row, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px', border: '1px solid #ddd', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '13px' }}>{row.scenario}</div>
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '13px' }}>{row.systemResponse}</div>
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Agent(s):</label>
                    <input
                      type="text"
                      value={row.agents}
                      onChange={(e) => {
                        const newRows = [...sampleInteractions];
                        newRows[idx].agents = e.target.value;
                        setSampleInteractions(newRows);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                      placeholder="e.g., Borrower, Book, Library System"
                    />
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>When [trigger/condition]:</label>
                    <input
                      type="text"
                      value={row.when}
                      onChange={(e) => {
                        const newRows = [...sampleInteractions];
                        newRows[idx].when = e.target.value;
                        setSampleInteractions(newRows);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                      placeholder="e.g., borrower searches for a book"
                    />
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>The system should [behavior]:</label>
                    <input
                      type="text"
                      value={row.systemShould}
                      onChange={(e) => {
                        const newRows = [...sampleInteractions];
                        newRows[idx].systemShould = e.target.value;
                        setSampleInteractions(newRows);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                      placeholder="e.g., display matching titles"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Using [data needed]:</label>
                    <input
                      type="text"
                      value={row.using}
                      onChange={(e) => {
                        const newRows = [...sampleInteractions];
                        newRows[idx].using = e.target.value;
                        setSampleInteractions(newRows);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                      placeholder="e.g., book title, available copies, loan duration"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '13px', color: '#666' }}>
          <strong>Meanings:</strong><br />
          <strong>Scenario</strong> ("what if [scenario]?") --- What is the user doing (consider all different user types)<br />
          <strong>System Response</strong> ("now what [should the system do]?") --- In the specified scenario, what should the digital library system do?
        </p>
      </div>

      {/* Question 2 */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', marginBottom: '15px' }}>
          <strong>Question 2:</strong> Consider the two input and system response scenarios above. To the best of your ability,
          define the data types (i.e., book name) and functional system requirements needed to execute the system response.
          <br /><br />
          <em>Functional goals underlie services that the system is expected to deliver.</em>
          <br /><br />
          <strong>Example:</strong> <em>At an ATM, the machine must dispense cash from the user's bank account.
          To do this, the ATM needs the user's account number, account balance, and requested withdrawal amount.
          Each of these would be a data type. The functional requirements include checking that the withdrawal amount
          doesn't exceed the account balance and validating the account number.</em>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <strong>What must the system know about the user, book, and library to execute the task (data)?</strong>
          <textarea
            value={q2DataTypes}
            onChange={(e) => setQ2DataTypes(e.target.value)}
            disabled={isSubmitted && !isEditMode}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ccc',
              fontFamily: 'inherit',
              marginTop: '10px',
              backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
              cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
            }}
            placeholder="List data types..."
          />
        </div>

        <div>
          <strong>How can these be translated into functional requirements?</strong>
          <div style={{ marginTop: '10px', padding: '15px', border: '1px solid #ddd', backgroundColor: '#fafafa' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Agent(s):</label>
              <input
                type="text"
                value={q2Agents}
                onChange={(e) => setQ2Agents(e.target.value)}
                disabled={isSubmitted && !isEditMode}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  fontFamily: 'inherit',
                  backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                }}
                placeholder="e.g., Borrower, Book, Library System"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>When [trigger/condition]:</label>
              <input
                type="text"
                value={q2When}
                onChange={(e) => setQ2When(e.target.value)}
                disabled={isSubmitted && !isEditMode}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  fontFamily: 'inherit',
                  backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                }}
                placeholder="e.g., borrower requests to borrow a book"
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>The system should [behavior]:</label>
              <input
                type="text"
                value={q2SystemShould}
                onChange={(e) => setQ2SystemShould(e.target.value)}
                disabled={isSubmitted && !isEditMode}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  fontFamily: 'inherit',
                  backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                }}
                placeholder="e.g., check availability and assign the book"
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Using [data needed]:</label>
              <input
                type="text"
                value={q2Using}
                onChange={(e) => setQ2Using(e.target.value)}
                disabled={isSubmitted && !isEditMode}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ccc',
                  fontFamily: 'inherit',
                  backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                }}
                placeholder="e.g., book ID, available copies, borrower ID, loan duration"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Question 3: Extraneous Scenarios */}
      <div style={{ marginBottom: '40px' }}>
        <h3>Extraneous Scenarios</h3>
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', marginBottom: '15px' }}>
          <strong>Question 3:</strong> Consider the following extraneous scenarios. Based on the requirements that you
          specified above, how should the system respond? <em>Fill in the outputs.</em>
        </div>

        {extraneousScenarios.map((scenario, idx) => (
          <div key={idx} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#4285f4' }}>
                  <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '40%' }}>Input</th>
                  <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '60%' }}>How should the system respond? Write functional requirement(s)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '10px', border: '1px solid #ddd', verticalAlign: 'top' }}>
                    <textarea
                      value={scenario.inputs}
                      onChange={(e) => {
                        const newScenarios = [...extraneousScenarios];
                        newScenarios[idx].inputs = e.target.value;
                        setExtraneousScenarios(newScenarios);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        minHeight: '150px',
                        padding: '8px',
                        fontSize: '12px',
                        border: 'none',
                        fontFamily: 'monospace',
                        resize: 'none',
                        overflow: 'auto',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
                        cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
                      }}
                    />
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Agent(s):</label>
                      <input
                        type="text"
                        value={scenario.agents}
                        onChange={(e) => {
                          const newScenarios = [...extraneousScenarios];
                          newScenarios[idx].agents = e.target.value;
                          setExtraneousScenarios(newScenarios);
                        }}
                        disabled={isSubmitted && !isEditMode}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '13px',
                          border: '1px solid #ddd',
                          fontFamily: 'inherit',
                          backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>When [trigger/condition]:</label>
                      <input
                        type="text"
                        value={scenario.when}
                        onChange={(e) => {
                          const newScenarios = [...extraneousScenarios];
                          newScenarios[idx].when = e.target.value;
                          setExtraneousScenarios(newScenarios);
                        }}
                        disabled={isSubmitted && !isEditMode}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '13px',
                          border: '1px solid #ddd',
                          fontFamily: 'inherit',
                          backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                        }}
                      />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>The system should [behavior]:</label>
                      <input
                        type="text"
                        value={scenario.systemShould}
                        onChange={(e) => {
                          const newScenarios = [...extraneousScenarios];
                          newScenarios[idx].systemShould = e.target.value;
                          setExtraneousScenarios(newScenarios);
                        }}
                        disabled={isSubmitted && !isEditMode}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '13px',
                          border: '1px solid #ddd',
                          fontFamily: 'inherit',
                          backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Using [data needed]:</label>
                      <input
                        type="text"
                        value={scenario.using}
                        onChange={(e) => {
                          const newScenarios = [...extraneousScenarios];
                          newScenarios[idx].using = e.target.value;
                          setExtraneousScenarios(newScenarios);
                        }}
                        disabled={isSubmitted && !isEditMode}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '13px',
                          border: '1px solid #ddd',
                          fontFamily: 'inherit',
                          backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                        }}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
              <strong>Use natural language to describe the scenario in one sentence:</strong>
              <textarea
                value={scenario.description}
                onChange={(e) => {
                  const newScenarios = [...extraneousScenarios];
                  newScenarios[idx].description = e.target.value;
                  setExtraneousScenarios(newScenarios);
                }}
                disabled={isSubmitted && !isEditMode}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '8px',
                  fontSize: '13px',
                  border: '1px solid #ddd',
                  fontFamily: 'inherit',
                  marginTop: '5px',
                  resize: 'none',
                  overflow: 'auto',
                  backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
                  cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
                }}
                placeholder="Describe this scenario..."
              />
            </div>
          </div>
        ))}
      </div>

      {/* Question 4: Additional Edge Cases */}
      <div style={{ marginBottom: '40px' }}>
        <h3>Additional Edge Cases</h3>
        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', marginBottom: '15px' }}>
          <strong>Question 4:</strong> What scenarios could cause it to fail or behave incorrectly? Instead of focusing
          on exposing security bugs, focus on actions the account holder could take that require additional functionality
          beyond what you have previously specified. <em>Add three additional extraneous scenarios.</em>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
          <thead>
            <tr style={{ backgroundColor: '#4285f4' }}>
              <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '40%' }}>Scenario</th>
              <th style={{ padding: '10px', color: 'white', border: '1px solid #ddd', textAlign: 'left', width: '60%' }}>System Response<br /><span style={{ fontWeight: 'normal', fontSize: '12px' }}>What must the system know? How can these be translated into functional requirements?</span></th>
            </tr>
          </thead>
          <tbody>
            {edgeCases.map((edge, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <textarea
                    value={edge.scenario}
                    onChange={(e) => {
                      const newEdges = [...edgeCases];
                      newEdges[idx].scenario = e.target.value;
                      setEdgeCases(newEdges);
                    }}
                    disabled={isSubmitted && !isEditMode}
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: '8px',
                      fontSize: '13px',
                      border: '1px solid #ddd',
                      fontFamily: 'inherit',
                      resize: 'none',
                      overflow: 'auto',
                      backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
                      cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
                    }}
                    placeholder="Describe an edge case scenario..."
                  />
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Agent(s):</label>
                    <input
                      type="text"
                      value={edge.agents}
                      onChange={(e) => {
                        const newEdges = [...edgeCases];
                        newEdges[idx].agents = e.target.value;
                        setEdgeCases(newEdges);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>When [trigger/condition]:</label>
                    <input
                      type="text"
                      value={edge.when}
                      onChange={(e) => {
                        const newEdges = [...edgeCases];
                        newEdges[idx].when = e.target.value;
                        setEdgeCases(newEdges);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>The system should [behavior]:</label>
                    <input
                      type="text"
                      value={edge.systemShould}
                      onChange={(e) => {
                        const newEdges = [...edgeCases];
                        newEdges[idx].systemShould = e.target.value;
                        setEdgeCases(newEdges);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Using [data needed]:</label>
                    <input
                      type="text"
                      value={edge.using}
                      onChange={(e) => {
                        const newEdges = [...edgeCases];
                        newEdges[idx].using = e.target.value;
                        setEdgeCases(newEdges);
                      }}
                      disabled={isSubmitted && !isEditMode}
                      style={{
                        width: '100%',
                        padding: '6px',
                        fontSize: '13px',
                        border: '1px solid #ddd',
                        fontFamily: 'inherit',
                        backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white'
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Question 5: Hold Queue Analysis */}
      <div style={{ marginBottom: '40px' }}>
        <h3>Hold Queue Analysis</h3>
        <div style={{ padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', marginBottom: '15px' }}>
          <p style={{ marginTop: 0 }}>
            The library owns 2 digital copies of "The Hitchhiker's Guide to the Galaxy."
          </p>
          <p><strong>Current state:</strong></p>
          <ul style={{ marginBottom: '10px', paddingLeft: '20px' }}>
            <li style={{ marginBottom: '5px' }}><em>Copy 1:</em> Checked out to Borrower A (due in 3 days)</li>
            <li style={{ marginBottom: '5px' }}><em>Copy 2:</em> Checked out to Borrower B (due in 7 days)</li>
            <li style={{ marginBottom: '5px' }}><em>Hold queue (not necessarily in order):</em> Borrower C, Borrower D, Borrower A</li>
          </ul>
          <p style={{ marginBottom: 0 }}><strong>Subsequent event:</strong> <em>Borrower A returns Copy 1 early (at 2:00:00 PM)</em></p>
        </div>

        <div style={{ padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', marginBottom: '15px' }}>
          <p style={{ marginTop: 0 }}>
            <strong>Note:</strong> Once a borrower is placed in the hold queue and the book becomes available,
            they will automatically be given the book.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Question 5:</strong> Do we have enough information to determine whether <em>Borrower C</em> or{' '}
            <em>Borrower D</em> should receive <em>Copy 1</em>? Should they both receive a copy? If so, who should
            receive Copy 1? Justify your answer. If not, what additional information do we need? Justify your answer.
          </p>
        </div>

        <textarea
          value={q5Response}
          onChange={(e) => setQ5Response(e.target.value)}
          disabled={isSubmitted && !isEditMode}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #ccc',
            fontFamily: 'inherit',
            backgroundColor: isSubmitted && !isEditMode ? '#f5f5f5' : 'white',
            cursor: isSubmitted && !isEditMode ? 'not-allowed' : 'text'
          }}
          placeholder="Type your analysis here..."
        />
      </div>

      {/* Submit/Edit/Reset Buttons */}
      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
        {!isSubmitted || isEditMode ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || submitSuccess}
              style={{
                flex: 1,
                padding: '15px',
                fontSize: '16px',
                border: '1px solid #2196f3',
                backgroundColor: isSubmitting || submitSuccess ? '#ccc' : '#2196f3',
                color: 'white',
                cursor: isSubmitting || submitSuccess ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isSubmitting ? 'Submitting...' : submitSuccess ? 'Submitted!' : isEditMode ? 'Resubmit Assessment' : 'Submit Assessment'}
            </button>
            <button
              onClick={handleReset}
              disabled={isSubmitting}
              style={{
                padding: '15px 30px',
                fontSize: '16px',
                border: '1px solid #dc3545',
                backgroundColor: 'white',
                color: '#dc3545',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reset
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleEdit}
              disabled={timeRemaining === 0}
              style={{
                flex: 1,
                padding: '15px',
                fontSize: '16px',
                border: '1px solid #ffc107',
                backgroundColor: timeRemaining === 0 ? '#ccc' : '#ffc107',
                color: timeRemaining === 0 ? '#666' : '#000',
                cursor: timeRemaining === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {timeRemaining === 0 ? 'Editing Disabled (Time Expired)' : 'Edit Assessment'}
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '15px 30px',
                fontSize: '16px',
                border: '1px solid #dc3545',
                backgroundColor: 'white',
                color: '#dc3545',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostAssessmentPage() {
  return <div></div>;
}

function LearnModePage() {
  const [showIntro, setShowIntro] = useState(true);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{
    sender: string, text: string, pairs?: any,
    messageType?: string, missingDataTypes?: string[], discoveredRequirements?: string[]
  }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [currentAgentData, setCurrentAgentData] = useState<any>(null);
  // Workspace state
  const [scratchpad, setScratchpad] = useState('');
  const [notes, setNotes] = useState<Array<{id: string, timestamp: number, tag?: string, content: string}>>([]);
  const { user, elapsedMinutes } = React.useContext(AppContext);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Fetch initial AI message when entering learn mode
  useEffect(() => {
    if (!showIntro) {
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
  }, [showIntro]);

  // Load workspace from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`learn_workspace_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.scratchpad) setScratchpad(parsed.scratchpad);
          if (parsed.notes) setNotes(parsed.notes);
        } catch {}
      }
    }
  }, [user]);

  // Save workspace to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`learn_workspace_${user.id}`, JSON.stringify({ scratchpad, notes }));
    }
  }, [user, scratchpad, notes]);

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
      if (location && location.x < 30 && location.y < 30) {
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

  const CELL = 20;
  const GRID = 30;

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

  // Structured chat card renderer
  const renderChatMessage = (msg: typeof chatHistory[0], idx: number) => {
    if (msg.sender === 'user') {
      return (
        <div key={idx} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#007bff', color: '#fff', fontSize: '13px', maxWidth: '85%', borderRadius: '4px', whiteSpace: 'pre-wrap' as const, lineHeight: '1.4' }}>
            {msg.text}
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
            {msg.text}
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
            {msg.text}
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: '#fafafa' }}>
          {chatHistory.map((msg, idx) => renderChatMessage(msg, idx))}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
            placeholder="Message Alex (describe tests, ask questions, define requirements)..."
            disabled={isSending}
            style={{ flex: 1, padding: '8px 10px', fontSize: '13px', border: '1px solid #ccc', outline: 'none', borderRadius: '3px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending}
            style={{ padding: '8px 16px', fontSize: '12px', border: 'none', backgroundColor: isSending ? '#ccc' : '#007bff', color: '#fff', cursor: isSending ? 'not-allowed' : 'pointer', borderRadius: '3px' }}
          >
            {isSending ? '...' : 'Send'}
          </button>
        </div>
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
                      \u00d7
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = React.useContext(AppContext);
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

function App() {
  const defaultUser: User = { id: 'dev', subject_number: 0, preferred_name: 'Dev' };
  const [user] = useState<User | null>(defaultUser);
  const [studyStartTime] = useState<number | null>(Date.now());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (studyStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - studyStartTime) / 60000);
        setElapsedMinutes(elapsed);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [studyStartTime]);

  return (
    <AppContext.Provider value={{ user, studyStartTime, elapsedMinutes }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<NavigationMenu />} />
          <Route path="/paperwork" element={<PaperworkPage />} />
          <Route path="/pre-assessment" element={<PreAssessmentPage />} />
          <Route path="/learn" element={<LearnModePage />} />
          <Route path="/post-assessment" element={<PostAssessmentPage />} />
          <Route path="/slides" element={<SlideViewer />} />
          <Route path="/mockup" element={<MockupPage />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
