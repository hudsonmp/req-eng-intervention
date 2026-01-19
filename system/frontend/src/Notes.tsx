import React, { useState, useEffect } from 'react';
import './App.css';

interface Note {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAllNotes();
  }, []);

  // Autosave when content changes
  useEffect(() => {
    if (activeNoteId && noteContent !== undefined) {
      // Clear existing timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Set new timer to save after 2 seconds of no typing
      autosaveTimerRef.current = setTimeout(() => {
        saveNoteAuto();
      }, 2000);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [noteContent, activeNoteId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === 'n') {
          e.preventDefault();
          const participantId = prompt('Enter Participant ID to link note:');
          if (participantId) {
            const pid = parseInt(participantId);
            if (!isNaN(pid)) {
              createNewParticipantNote(pid);
            }
          }
        } else if (e.key === 'e' && textareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('EXPLORE');
        } else if (e.key === 'w' && textareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('WHAT IF');
        } else if (e.key === 'm' && textareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('MESSAGE');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [noteContent]);

  const insertTextAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = noteContent.substring(0, start) + text + noteContent.substring(end);

    setNoteContent(newText);

    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check for images in clipboard
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();

        const blob = items[i].getAsFile();
        if (!blob) continue;

        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Image = event.target?.result as string;

          try {
            // Upload image
            const response = await fetch('http://localhost:8000/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: base64Image,
                participant_id: activeNoteId?.replace('notes_', '').replace('.txt', '') || 'general'
              })
            });

            const data = await response.json();

            // Insert image reference at cursor
            insertTextAtCursor(`\n![Image](${data.url})\n`);
          } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  };

  const fetchAllNotes = async () => {
    try {
      const response = await fetch('http://localhost:8000/notes');
      const data = await response.json();
      setNotes(data.notes || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setLoading(false);
    }
  };

  const createNewParticipantNote = async (participantId: number) => {
    const noteId = `notes_${participantId}.txt`;

    // Check if note already exists
    const existingNote = notes.find(n => n.id === noteId);
    if (existingNote) {
      setActiveNoteId(noteId);
      setNoteContent(existingNote.content);
      return;
    }

    // Create new note
    const newNote: Note = {
      id: noteId,
      name: `Participant ${participantId}`,
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(noteId);
    setNoteContent('');
  };

  const handleNoteClick = (note: Note) => {
    setActiveNoteId(note.id);
    setNoteContent(note.content);
  };

  const saveNoteAuto = async () => {
    if (!activeNoteId) return;

    try {
      // Determine if this is a participant note or general note
      const isParticipantNote = activeNoteId.startsWith('notes_');

      if (isParticipantNote) {
        // Extract participant ID from notes_{id}.txt
        const participantId = activeNoteId.replace('notes_', '').replace('.txt', '');
        await fetch(`http://localhost:8000/notes/${participantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: noteContent })
        });
      } else {
        await fetch('http://localhost:8000/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeNoteId, content: noteContent })
        });
      }

      // Update local state
      setNotes(prev => prev.map(n =>
        n.id === activeNoteId ? {...n, content: noteContent, updated_at: new Date().toISOString()} : n
      ));

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error autosaving note:', error);
    }
  };

  const saveNote = async () => {
    if (!activeNoteId) return;
    setSaving(true);

    try {
      // Determine if this is a participant note or general note
      const isParticipantNote = activeNoteId.startsWith('notes_');

      if (isParticipantNote) {
        // Extract participant ID from notes_{id}.txt
        const participantId = activeNoteId.replace('notes_', '').replace('.txt', '');
        await fetch(`http://localhost:8000/notes/${participantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: noteContent })
        });
      } else {
        await fetch('http://localhost:8000/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeNoteId, content: noteContent })
        });
      }

      // Update local state
      setNotes(prev => prev.map(n =>
        n.id === activeNoteId ? {...n, content: noteContent, updated_at: new Date().toISOString()} : n
      ));

      setLastSaved(new Date());
      alert('Note saved successfully!');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
    setSaving(false);
  };

  const deleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await fetch(`http://localhost:8000/notes/${noteId}`, {
        method: 'DELETE'
      });

      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (activeNoteId === noteId) {
        setActiveNoteId(null);
        setNoteContent('');
      }

      alert('Note deleted successfully!');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        Loading notes...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Left sidebar: Notes list */}
      <div style={{
        width: '300px',
        borderRight: '2px solid #ddd',
        padding: '20px',
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        <h2 style={{ marginBottom: '20px' }}>All Notes</h2>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
          Total: {notes.length} notes
        </p>

        <button
          onClick={() => {
            const participantId = prompt('Enter Participant ID:');
            if (participantId) {
              const pid = parseInt(participantId);
              if (!isNaN(pid)) {
                createNewParticipantNote(pid);
              }
            }
          }}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          + New Participant Note (Control+N)
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => handleNoteClick(note)}
              style={{
                padding: '12px',
                backgroundColor: activeNoteId === note.id ? '#007bff' : '#f9f9f9',
                color: activeNoteId === note.id ? '#fff' : '#333',
                borderRadius: '5px',
                cursor: 'pointer',
                border: '1px solid #ddd',
                position: 'relative'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '5px', paddingRight: '25px' }}>
                {note.name}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>
                Updated: {new Date(note.updated_at).toLocaleString()}
              </div>
              <button
                onClick={(e) => deleteNote(note.id, e)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: activeNoteId === note.id ? '#fff' : '#999'
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Note editor */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        {!activeNoteId ? (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
            <h3>Select a note or create a new one</h3>
            <p>Press Control+N to create a note for a participant</p>
          </div>
        ) : (
          <>
            {/* Keyboard shortcuts reminder */}
            <div style={{
              marginBottom: '15px',
              padding: '10px',
              backgroundColor: '#f0f0f0',
              borderRadius: '3px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <strong>Shortcuts:</strong> Control+E = EXPLORE | Control+W = WHAT IF | Control+M = MESSAGE | Control+N = New Participant Note
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, marginBottom: '5px' }}>
                  {notes.find(n => n.id === activeNoteId)?.name || 'Note'}
                </h3>
                {lastSaved && (
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </div>
                )}
              </div>
              <button
                onClick={saveNote}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Saving...' : '💾 Save Now'}
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Write your notes here... Use Control+E for EXPLORE, Control+W for WHAT IF, Control+M for MESSAGE. Paste images directly!"
              style={{
                width: '100%',
                minHeight: '500px',
                padding: '15px',
                fontSize: '14px',
                fontFamily: 'Monaco, Courier, monospace',
                border: '1px solid #ddd',
                borderRadius: '5px',
                resize: 'vertical',
                lineHeight: '1.6'
              }}
            />

            <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
              Notes autosave to Supabase every 2 seconds. Paste images directly (Cmd+V or Ctrl+V) - they'll be uploaded and embedded as ![Image](url).
            </div>

            {/* Render images inline */}
            <div style={{ marginTop: '20px' }}>
              {noteContent.match(/!\[.*?\]\((http:\/\/localhost:8000\/get-image\/[^\)]+)\)/g)?.map((match, idx) => {
                const urlMatch = match.match(/\((http:\/\/localhost:8000\/get-image\/[^\)]+)\)/);
                if (urlMatch) {
                  return (
                    <div key={idx} style={{ marginBottom: '10px' }}>
                      <img
                        src={urlMatch[1]}
                        alt="Pasted"
                        style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '3px' }}
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Notes;
