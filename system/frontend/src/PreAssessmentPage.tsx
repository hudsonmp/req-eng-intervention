import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext, API_URL } from './AppContext';
import { LibraryMockup } from './LibraryMockup';

export function PreAssessmentPage() {
  const { user } = React.useContext(AppContext);
  const navigate = useNavigate();
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(480); // 8 minutes in seconds

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

    // Fresh timer every page load — no persistence
    setTimeRemaining(480);
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
    setTimeRemaining(480);
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
