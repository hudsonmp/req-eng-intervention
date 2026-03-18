import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext, API_URL } from './AppContext';

export function PaperworkPage() {
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
