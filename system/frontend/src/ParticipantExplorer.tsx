import React, { useState, useEffect } from 'react';
import './App.css';

interface ParticipantData {
  participant_id: number;
  participant_name: string;
  study_id: number;
  exploratory_count: number;
  messages_count: number;
  stakeholder_attribute_count: number;
  whatif_count: number;
  domain_knowledge_count: number;
  storage_files: string[];
}

interface StorageFile {
  path: string;
  bucket: string;
  filename: string;
  content: any;
  size: number;
}

function StorageFileDisplay({ file }: { file: StorageFile }) {
  const [expanded, setExpanded] = useState(false);
  const isJson = typeof file.content === 'object';
  const contentStr = isJson ? JSON.stringify(file.content, null, 2) : file.content;

  return (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #ddd',
      borderRadius: '5px',
      overflow: 'hidden'
    }}>
      {/* File header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px 15px',
          backgroundColor: '#f9f9f9',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #ddd' : 'none'
        }}
      >
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold' }}>
            {file.filename}
          </div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>
            <span style={{
              backgroundColor: file.bucket === 'json' ? '#d1ecf1' : file.bucket === 'messages' ? '#d4edda' : '#fff3cd',
              padding: '2px 6px',
              borderRadius: '3px',
              marginRight: '8px'
            }}>
              {file.bucket}
            </span>
            {isJson ? 'JSON' : 'Text'} • {file.size || contentStr.length} bytes
          </div>
        </div>
        <div style={{ fontSize: '18px', color: '#666' }}>
          {expanded ? '▼' : '▶'}
        </div>
      </div>

      {/* File content */}
      {expanded && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8f8f8',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <pre style={{
            margin: 0,
            fontFamily: 'Monaco, Courier, monospace',
            fontSize: '11px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {contentStr}
          </pre>
        </div>
      )}
    </div>
  );
}

interface Entity {
  stakeholder: string;
  attribute: string;
  location?: string;
  type: 'rider' | 'vehicle';
  callouts: string[];
}

function ParticipantExplorer() {
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null);
  const [detailedData, setDetailedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [starredParticipants, setStarredParticipants] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('starredParticipants');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [allParticipantNotes, setAllParticipantNotes] = useState<{[key: number]: string}>({});
  const [activeNoteTab, setActiveNoteTab] = useState<number | null>(null);
  const notesTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchParticipants();
  }, []);

  // Autosave when notes content changes
  useEffect(() => {
    if (activeNoteTab && allParticipantNotes[activeNoteTab] !== undefined) {
      // Clear existing timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Set new timer to save after 2 seconds of no typing
      autosaveTimerRef.current = setTimeout(() => {
        saveNotesAuto();
      }, 2000);
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [allParticipantNotes, activeNoteTab]);

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
              // Open notes and create tab for this participant
              setShowNotes(true);
              setActiveNoteTab(pid);
              // Fetch notes for this participant if not already loaded
              if (!allParticipantNotes[pid]) {
                fetchNotesForTab(pid);
              }
            }
          }
        } else if (e.key === 'e' && showNotes && notesTextareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('EXPLORE');
        } else if (e.key === 'w' && showNotes && notesTextareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('WHAT IF');
        } else if (e.key === 'm' && showNotes && notesTextareaRef.current) {
          e.preventDefault();
          insertTextAtCursor('MESSAGE');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNotes, allParticipantNotes]);

  const insertTextAtCursor = (text: string) => {
    const textarea = notesTextareaRef.current;
    if (!textarea || activeNoteTab === null) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentNotes = allParticipantNotes[activeNoteTab] || '';
    const newText = currentNotes.substring(0, start) + text + currentNotes.substring(end);

    setAllParticipantNotes(prev => ({...prev, [activeNoteTab]: newText}));

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
                participant_id: activeNoteTab || 'general'
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

  const fetchParticipants = async () => {
    try {
      const response = await fetch('http://localhost:8000/participant-explorer');
      const data = await response.json();
      setParticipants(data.participants || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching participants:', error);
      setLoading(false);
    }
  };

  const fetchParticipantDetails = async (participantId: number) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/participant-explorer/${participantId}`);
      const data = await response.json();
      setDetailedData(data);
      setDetailLoading(false);
    } catch (error) {
      console.error('Error fetching participant details:', error);
      setDetailLoading(false);
    }
  };

  const handleSelectParticipant = (participantId: number) => {
    setSelectedParticipant(participantId);
    setCurrentFrameIndex(0);
    setShowGrid(false);
    fetchParticipantDetails(participantId);
  };

  const fetchNotesForTab = async (participantId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/notes/${participantId}`);
      const data = await response.json();
      setAllParticipantNotes(prev => ({...prev, [participantId]: data.notes || ''}));
    } catch (error) {
      console.error('Error fetching notes:', error);
      setAllParticipantNotes(prev => ({...prev, [participantId]: ''}));
    }
  };

  const saveNotesAuto = async () => {
    if (activeNoteTab === null) return;
    try {
      await fetch(`http://localhost:8000/notes/${activeNoteTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: allParticipantNotes[activeNoteTab] || '' })
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error autosaving notes:', error);
    }
  };

  const saveNotes = async () => {
    if (activeNoteTab === null) return;
    setNotesSaving(true);
    try {
      await fetch(`http://localhost:8000/notes/${activeNoteTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: allParticipantNotes[activeNoteTab] || '' })
      });
      setLastSaved(new Date());
      alert('Notes saved successfully!');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    }
    setNotesSaving(false);
  };

  const handleNoteTabClick = (participantId: number) => {
    setActiveNoteTab(participantId);
    if (!allParticipantNotes[participantId]) {
      fetchNotesForTab(participantId);
    }
  };

  const closeNoteTab = (participantId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newNotes = {...allParticipantNotes};
    delete newNotes[participantId];
    setAllParticipantNotes(newNotes);

    // If closing active tab, switch to another or null
    if (activeNoteTab === participantId) {
      const otherTabs = Object.keys(newNotes).map(Number);
      setActiveNoteTab(otherTabs.length > 0 ? otherTabs[0] : null);
    }
  };

  const toggleStar = (participantId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const newStarred = new Set(starredParticipants);
    if (newStarred.has(participantId)) {
      newStarred.delete(participantId);
    } else {
      newStarred.add(participantId);
    }
    setStarredParticipants(newStarred);
    localStorage.setItem('starredParticipants', JSON.stringify(Array.from(newStarred)));
  };

  const getIconPosition = (coords: string): { top: string; left: string } => {
    const match = coords.match(/(\d+),\s*(\d+)/);
    if (!match) return { top: '0px', left: '0px' };
    const x = parseInt(match[1]);
    const y = parseInt(match[2]);
    return { left: `${x * 15}px`, top: `${y * 15}px` };
  };

  const getEntitiesFromFrame = (exploratoryRows: any[]): Entity[] => {
    const entities: Entity[] = [];
    const locationMap: Record<string, Partial<Entity>> = {};

    exploratoryRows.forEach(row => {
      if (!locationMap[row.stakeholder]) {
        locationMap[row.stakeholder] = {
          stakeholder: row.stakeholder,
          type: row.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
          callouts: []
        };
      }

      const entity = locationMap[row.stakeholder];

      if (row.attribute === 'pickup_location' || row.attribute === 'car_current_location') {
        entity.location = row.value;
        entity.attribute = row.attribute;
      } else if (row.attribute === 'destination') {
        entities.push({
          stakeholder: row.stakeholder,
          attribute: 'destination',
          location: row.value,
          type: row.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
          callouts: ['dest']
        });
      } else {
        entity.callouts?.push(`${row.attribute}: ${row.value}`);
      }
    });

    Object.values(locationMap).forEach(e => {
      if (e.location) {
        entities.push(e as Entity);
      }
    });

    return entities;
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (!showGrid || !detailedData?.exploratory) return;

    if (event.key === 'ArrowRight') {
      setCurrentFrameIndex(prev => Math.min(prev + 1, detailedData.exploratory.length - 1));
    } else if (event.key === 'ArrowLeft') {
      setCurrentFrameIndex(prev => Math.max(prev - 1, 0));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showGrid, detailedData, currentFrameIndex]);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        Loading participants...
      </div>
    );
  }

  const selectedData = participants.find(p => p.participant_id === selectedParticipant);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Left sidebar: Participant list */}
      <div style={{
        width: '300px',
        borderRight: '2px solid #ddd',
        padding: '20px',
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Participants</h2>
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '15px' }}>
          Total: {participants.length} participants
          {starredParticipants.size > 0 && ` • ${starredParticipants.size} starred`}
        </p>

        {/* Star filter toggle */}
        <button
          onClick={() => setShowOnlyStarred(!showOnlyStarred)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '15px',
            backgroundColor: showOnlyStarred ? '#ffc107' : '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >
          {showOnlyStarred ? '⭐ Show All' : '⭐ Show Starred Only'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {participants
            .filter(p => !showOnlyStarred || starredParticipants.has(p.participant_id))
            .map(participant => (
            <div
              key={participant.participant_id}
              onClick={() => handleSelectParticipant(participant.participant_id)}
              style={{
                padding: '12px',
                backgroundColor: selectedParticipant === participant.participant_id ? '#007bff' : '#f9f9f9',
                color: selectedParticipant === participant.participant_id ? '#fff' : '#333',
                borderRadius: '5px',
                cursor: 'pointer',
                border: '1px solid #ddd',
                position: 'relative'
              }}
            >
              {/* Star icon */}
              <div
                onClick={(e) => toggleStar(participant.participant_id, e)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                {starredParticipants.has(participant.participant_id) ? '⭐' : '☆'}
              </div>

              <div style={{ fontWeight: 'bold', marginBottom: '5px', paddingRight: '25px' }}>
                {participant.participant_name}
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                ID: {participant.participant_id} • Study: {participant.study_id}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
                {participant.exploratory_count} exp • {participant.messages_count} msg • {participant.stakeholder_attribute_count} s-a
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: Detailed data */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        {!selectedData && (
          <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
            <h3>Select a participant to view details</h3>
            <p>Choose a participant from the list on the left to explore their data.</p>
          </div>
        )}

        {selectedData && (
          <div>
            <h2 style={{ marginBottom: '10px' }}>{selectedData.participant_name}</h2>
            <div style={{
              padding: '15px',
              backgroundColor: '#f0f0f0',
              borderRadius: '5px',
              marginBottom: '20px'
            }}>
              <p><strong>Participant ID:</strong> {selectedData.participant_id}</p>
              <p><strong>Study ID:</strong> {selectedData.study_id}</p>
            </div>

            {/* Data summary cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px'
            }}>
              <div style={{
                padding: '15px',
                backgroundColor: '#e3f2fd',
                borderRadius: '5px',
                border: '1px solid #90caf9'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                  {selectedData.exploratory_count}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Exploratory Entries</div>
              </div>

              <div style={{
                padding: '15px',
                backgroundColor: '#f3e5f5',
                borderRadius: '5px',
                border: '1px solid #ce93d8'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7b1fa2' }}>
                  {selectedData.messages_count}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Messages</div>
              </div>

              <div style={{
                padding: '15px',
                backgroundColor: '#e8f5e9',
                borderRadius: '5px',
                border: '1px solid #a5d6a7'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>
                  {selectedData.stakeholder_attribute_count}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Stakeholder-Attribute</div>
              </div>

              <div style={{
                padding: '15px',
                backgroundColor: '#fff3e0',
                borderRadius: '5px',
                border: '1px solid #ffcc80'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
                  {selectedData.whatif_count}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>What-If Entries</div>
              </div>

              <div style={{
                padding: '15px',
                backgroundColor: '#fce4ec',
                borderRadius: '5px',
                border: '1px solid #f48fb1'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c2185b' }}>
                  {selectedData.domain_knowledge_count}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Domain Knowledge</div>
              </div>

              <div style={{
                padding: '15px',
                backgroundColor: '#f1f8e9',
                borderRadius: '5px',
                border: '1px solid #c5e1a5'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#558b2f' }}>
                  {detailedData?.storage_files?.length || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Storage Files</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {detailedData?.exploratory && detailedData.exploratory.length > 0 && (
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    backgroundColor: showGrid ? '#dc3545' : '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {showGrid ? '✕ Hide' : '🗺️ Show'} Simulation Grid
                </button>
              )}

              <button
                onClick={() => setShowNotes(!showNotes)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: showNotes ? '#dc3545' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {showNotes ? '✕ Hide' : '📝'} Notes
              </button>
            </div>

            {/* Simulation Grid */}
            {showGrid && detailedData?.exploratory && (
              <div style={{
                marginBottom: '30px',
                padding: '20px',
                backgroundColor: '#f0f0f0',
                borderRadius: '5px',
                border: '2px solid #007bff'
              }}>
                <h3 style={{ marginBottom: '15px' }}>Simulation Grid Timeline</h3>

                {/* Frame controls */}
                <div style={{
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  backgroundColor: '#fff',
                  padding: '15px',
                  borderRadius: '5px'
                }}>
                  <button
                    onClick={() => setCurrentFrameIndex(prev => Math.max(prev - 1, 0))}
                    disabled={currentFrameIndex === 0}
                    style={{
                      padding: '8px 15px',
                      fontSize: '14px',
                      cursor: currentFrameIndex === 0 ? 'not-allowed' : 'pointer',
                      opacity: currentFrameIndex === 0 ? 0.5 : 1,
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      backgroundColor: '#fff'
                    }}
                  >
                    ← Prev
                  </button>

                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      Frame {currentFrameIndex + 1} / {detailedData.exploratory.length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Turn {detailedData.exploratory[currentFrameIndex]?.turn} • {detailedData.exploratory[currentFrameIndex]?.version}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {new Date(detailedData.exploratory[currentFrameIndex]?.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentFrameIndex(prev => Math.min(prev + 1, detailedData.exploratory.length - 1))}
                    disabled={currentFrameIndex === detailedData.exploratory.length - 1}
                    style={{
                      padding: '8px 15px',
                      fontSize: '14px',
                      cursor: currentFrameIndex === detailedData.exploratory.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentFrameIndex === detailedData.exploratory.length - 1 ? 0.5 : 1,
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      backgroundColor: '#fff'
                    }}
                  >
                    Next →
                  </button>
                </div>

                {/* Grid */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(25, 1fr)',
                      gridTemplateRows: 'repeat(25, 1fr)',
                      gap: '0px',
                      width: 'fit-content',
                      backgroundColor: '#f9f9f9',
                      position: 'relative'
                    }}>
                      {Array.from({ length: 625 }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            borderRight: '1px solid #d0d0d0',
                            borderBottom: '1px solid #d0d0d0',
                            backgroundColor: '#ffffff',
                            width: '15px',
                            height: '15px'
                          }}
                        />
                      ))}

                      {/* Render entities for current frame */}
                      {(() => {
                        const framesUpToNow = detailedData.exploratory.slice(0, currentFrameIndex + 1);
                        const entities = getEntitiesFromFrame(framesUpToNow);

                        return entities.map((entity, idx) => {
                          const colorMap: Record<string, string> = {
                            'rider_1': 'blue', 'rider_2': 'red', 'rider_3': 'green',
                            'vehicle_1': 'blue', 'vehicle_2': 'red'
                          };
                          const color = colorMap[entity.stakeholder] || 'blue';
                          const borderColors: Record<string, string> = {
                            blue: '#0066cc', red: '#cc0000', green: '#2e7d32'
                          };
                          const filters: Record<string, string> = {
                            blue: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)',
                            red: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)',
                            green: 'invert(30%) sepia(95%) saturate(1000%) hue-rotate(100deg) brightness(95%) contrast(105%)'
                          };

                          const icon = entity.type === 'rider' ? '/icons/rider.svg' : '/icons/vehicle.svg';
                          const label = entity.stakeholder.replace('_', ' ').replace('rider', 'R').replace('vehicle', 'V');
                          const isDestination = entity.callouts.includes('dest');
                          const position = getIconPosition(`${entity.location}`);
                          const iconOpacity = isDestination ? 0.4 : 1;
                          const labelOpacity = isDestination ? 0.7 : 1;

                          return (
                            <React.Fragment key={`${entity.stakeholder}-${idx}`}>
                              <img
                                src={icon}
                                alt={entity.stakeholder}
                                style={{
                                  position: 'absolute',
                                  width: '20px',
                                  height: '20px',
                                  ...position,
                                  filter: filters[color],
                                  opacity: iconOpacity
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                top: `calc(${position.top} + 22px)`,
                                left: `calc(${position.left} - 10px)`,
                                fontSize: '9px',
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                padding: '2px 4px',
                                border: `1px solid ${borderColors[color]}`,
                                whiteSpace: 'nowrap',
                                maxWidth: '120px',
                                opacity: labelOpacity
                              }}>
                                <div style={{ fontWeight: 'bold' }}>{label}</div>
                                <div>({entity.location})</div>
                                {entity.callouts.filter(c => c !== 'dest').map((callout, i) => (
                                  <div key={i} style={{ fontSize: '8px', color: '#666' }}>{callout}</div>
                                ))}
                              </div>
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '15px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  Use ← → arrow keys to navigate frames
                </div>
              </div>
            )}

            {/* Notes Section */}
            {showNotes && (
              <div style={{
                marginBottom: '30px',
                padding: '20px',
                backgroundColor: '#fff',
                borderRadius: '5px',
                border: '2px solid #28a745'
              }}>
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

                {/* Tabs */}
                <div style={{
                  display: 'flex',
                  gap: '5px',
                  marginBottom: '15px',
                  borderBottom: '2px solid #ddd',
                  flexWrap: 'wrap'
                }}>
                  {Object.keys(allParticipantNotes).map(pidStr => {
                    const pid = parseInt(pidStr);
                    const participant = participants.find(p => p.participant_id === pid);
                    const isActive = activeNoteTab === pid;
                    return (
                      <div
                        key={pid}
                        onClick={() => handleNoteTabClick(pid)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: isActive ? '#28a745' : '#e0e0e0',
                          color: isActive ? '#fff' : '#333',
                          borderRadius: '5px 5px 0 0',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: isActive ? 'bold' : 'normal',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>{participant?.participant_name || `P${pid}`}</span>
                        <span
                          onClick={(e) => closeNoteTab(pid, e)}
                          style={{
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1'
                          }}
                        >
                          ✕
                        </span>
                      </div>
                    );
                  })}
                </div>

                {activeNoteTab !== null ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <div>
                        <h3 style={{ margin: 0, marginBottom: '5px' }}>
                          Notes for {participants.find(p => p.participant_id === activeNoteTab)?.participant_name || `Participant ${activeNoteTab}`}
                        </h3>
                        {lastSaved && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            Last saved: {lastSaved.toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={saveNotes}
                        disabled={notesSaving}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          backgroundColor: '#28a745',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: notesSaving ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          opacity: notesSaving ? 0.6 : 1
                        }}
                      >
                        {notesSaving ? 'Saving...' : '💾 Save Now'}
                      </button>
                    </div>
                    <textarea
                      ref={notesTextareaRef}
                      value={allParticipantNotes[activeNoteTab] || ''}
                      onChange={(e) => setAllParticipantNotes(prev => ({...prev, [activeNoteTab]: e.target.value}))}
                      onPaste={handlePaste}
                      placeholder="Write your notes here... Use Control+E for EXPLORE, Control+W for WHAT IF, Control+M for MESSAGE. Paste images directly!"
                      style={{
                        width: '100%',
                        minHeight: '300px',
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
                      Notes autosave to Supabase every 2 seconds. Paste images directly - they'll be uploaded and embedded. All notes stored in exploration bucket.
                    </div>

                    {/* Render images inline */}
                    <div style={{ marginTop: '20px' }}>
                      {(allParticipantNotes[activeNoteTab] || '').match(/!\[.*?\]\((http:\/\/localhost:8000\/get-image\/[^\)]+)\)/g)?.map((match, idx) => {
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
                ) : (
                  <div style={{ padding: '50px', textAlign: 'center', color: '#999' }}>
                    <p>Press Control+N to create a note for a participant</p>
                    <p style={{ fontSize: '12px' }}>Or click the Notes button when viewing a participant</p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed data sections */}
            {detailLoading && (
              <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
                Loading detailed data...
              </div>
            )}

            {detailedData && !detailLoading && (
              <div>
                {/* Exploratory Data */}
                {detailedData.exploratory && detailedData.exploratory.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginBottom: '10px' }}>Exploratory Data</h3>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#007bff', color: '#fff' }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Turn</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Version</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Stakeholder</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Attribute</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Value</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedData.exploratory.map((row: any, index: number) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.turn}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                <span style={{
                                  backgroundColor: row.version === 'add' ? '#d4edda' : row.version === 'delete' ? '#f8d7da' : '#d1ecf1',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>
                                  {row.version}
                                </span>
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.stakeholder}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.attribute}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{row.value}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '11px' }}>
                                {new Date(row.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {detailedData.messages && detailedData.messages.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginBottom: '10px' }}>Messages ({detailedData.messages.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {detailedData.messages.map((msg: any, index: number) => (
                        <div key={index} style={{
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          padding: '15px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div>
                              <span style={{
                                backgroundColor: msg.role === 'participant' ? '#d4edda' : '#d1ecf1',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                marginRight: '8px'
                              }}>
                                {msg.role}
                              </span>
                              <span style={{
                                backgroundColor: '#f0f0f0',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                marginRight: '8px'
                              }}>
                                Turn {msg.turn_index}
                              </span>
                              {msg.agent_type && (
                                <span style={{
                                  backgroundColor: '#fff3cd',
                                  padding: '3px 8px',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>
                                  {msg.agent_type}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {new Date(msg.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div style={{
                            backgroundColor: '#f8f8f8',
                            padding: '12px',
                            borderRadius: '3px',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '200px',
                            overflowY: 'auto'
                          }}>
                            {msg.content || '[No content]'}
                          </div>

                          <div style={{
                            marginTop: '8px',
                            fontSize: '10px',
                            color: '#999',
                            fontFamily: 'monospace'
                          }}>
                            ID: {msg.message_id}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stakeholder-Attribute Table */}
                {detailedData?.stakeholder_attribute && detailedData.stakeholder_attribute.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginBottom: '10px' }}>Stakeholder-Attribute ({detailedData.stakeholder_attribute.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        backgroundColor: '#fff',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#e3f2fd' }}>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Turn</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Stakeholder</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Attribute</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Value</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Action</th>
                            <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedData.stakeholder_attribute.map((row: any, index: number) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.turn}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.stakeholder}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.attribute}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd', fontFamily: 'monospace' }}>{row.value}</td>
                              <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                                <span style={{
                                  backgroundColor: row.action === 'add' ? '#d4edda' : '#f8d7da',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '11px'
                                }}>
                                  {row.action}
                                </span>
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '11px' }}>
                                {new Date(row.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* What-If Entries */}
                {detailedData?.whatif && detailedData.whatif.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginBottom: '10px' }}>What-If Entries ({detailedData.whatif.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {detailedData.whatif.map((entry: any, index: number) => (
                        <div key={index} style={{
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '5px',
                          padding: '15px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div>
                              <span style={{
                                backgroundColor: '#fff3e0',
                                padding: '3px 8px',
                                borderRadius: '3px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                marginRight: '8px'
                              }}>
                                Row {entry.row_index}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                              {new Date(entry.created_at).toLocaleString()}
                            </div>
                          </div>

                          {entry.content && typeof entry.content === 'object' ? (
                            <div style={{
                              backgroundColor: '#f8f8f8',
                              padding: '12px',
                              borderRadius: '3px',
                              fontSize: '13px',
                              lineHeight: '1.6'
                            }}>
                              {entry.content.situation && (
                                <div style={{ marginBottom: '10px' }}>
                                  <strong style={{ color: '#f57c00' }}>Situation:</strong>
                                  <div style={{ marginTop: '5px' }}>{entry.content.situation}</div>
                                </div>
                              )}
                              {entry.content.solution && (
                                <div>
                                  <strong style={{ color: '#f57c00' }}>Solution:</strong>
                                  <div style={{ marginTop: '5px' }}>{entry.content.solution}</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{
                              backgroundColor: '#f8f8f8',
                              padding: '12px',
                              borderRadius: '3px',
                              fontSize: '13px',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'monospace'
                            }}>
                              {typeof entry.content === 'string' ? entry.content : '[No content]'}
                            </div>
                          )}

                          <div style={{
                            marginTop: '8px',
                            fontSize: '10px',
                            color: '#999',
                            fontFamily: 'monospace'
                          }}>
                            File ID: {entry.file_id}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Storage Files */}
                {detailedData?.storage_files && detailedData.storage_files.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <h3 style={{ marginBottom: '10px' }}>Storage Files ({detailedData.storage_files.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {detailedData.storage_files.map((file: StorageFile, index: number) => (
                        <StorageFileDisplay key={index} file={file} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Relationships Diagram */}
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '10px' }}>Data Relationships</h3>
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '5px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.8'
                  }}>
                    <div><strong>Participant {selectedData.participant_id}</strong> ({selectedData.participant_name})</div>
                    <div>├─ Study ID: {selectedData.study_id}</div>
                    <div>├─ Exploratory ({selectedData.exploratory_count} rows)</div>
                    <div>│  └─ Tracks: stakeholder-attribute pairs over time</div>
                    <div>├─ Messages ({selectedData.messages_count} rows)</div>
                    <div>│  └─ Links to: Storage (message content)</div>
                    <div>├─ Stakeholder-Attribute ({selectedData.stakeholder_attribute_count} rows)</div>
                    <div>│  └─ Logs: add/delete actions</div>
                    <div>├─ What-If ({selectedData.whatif_count} rows)</div>
                    <div>│  └─ Links to: Storage (what-if content)</div>
                    <div>└─ Storage Files ({detailedData?.storage_files?.length || 0} files)</div>
                    <div>   └─ Buckets: messages, json, exploration, what-if</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantExplorer;
