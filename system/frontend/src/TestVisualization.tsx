import React, { useState, useEffect } from 'react';
import './App.css';

interface TestAttribute {
  stakeholder: string;
  attribute: string;
  value: string;
}

interface Frame {
  participant_id: number;
  participant_name: string;
  turn: number;
  study_id: number;
  timestamp: string;
  action: string;
  attributes: TestAttribute[];
}

interface Entity {
  stakeholder: string;
  attribute: string;
  location?: string;
  type: 'rider' | 'vehicle';
  callouts: string[];
}

interface ParticipantTimeline {
  participant_name: string;
  frames: Frame[];
}

function TestVisualization() {
  const [allFrames, setAllFrames] = useState<Frame[]>([]);
  const [participantTimelines, setParticipantTimelines] = useState<ParticipantTimeline[]>([]);
  const [selectedParticipantIndex, setSelectedParticipantIndex] = useState<number>(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFrames();
  }, []);

  useEffect(() => {
    // Group frames by participant
    const grouped: { [key: string]: Frame[] } = {};
    allFrames.forEach(frame => {
      const name = frame.participant_name;
      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push(frame);
    });

    const timelines: ParticipantTimeline[] = Object.entries(grouped).map(([name, frames]) => ({
      participant_name: name,
      frames
    }));

    setParticipantTimelines(timelines);
    setCurrentFrameIndex(0);
  }, [allFrames]);

  const fetchFrames = async () => {
    try {
      const response = await fetch('http://localhost:8000/test');
      const data = await response.json();
      setAllFrames(data.frames || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching frames:', error);
      setLoading(false);
    }
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (participantTimelines.length === 0) return;
    const timeline = participantTimelines[selectedParticipantIndex];
    if (!timeline) return;

    if (event.key === 'ArrowRight') {
      setCurrentFrameIndex(prev => Math.min(prev + 1, timeline.frames.length - 1));
    } else if (event.key === 'ArrowLeft') {
      setCurrentFrameIndex(prev => Math.max(prev - 1, 0));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedParticipantIndex, participantTimelines]);

  const getIconPosition = (coords: string): { top: string; left: string } => {
    const match = coords.match(/(\d+),\s*(\d+)/);
    if (!match) return { top: '0px', left: '0px' };

    const x = parseInt(match[1]);
    const y = parseInt(match[2]);

    return {
      left: `${x * 15}px`,
      top: `${y * 15}px`
    };
  };

  const getEntitiesFromFrame = (frame: Frame): Entity[] => {
    const entities: Entity[] = [];
    const locationMap: Record<string, Partial<Entity>> = {};

    frame.attributes.forEach(attr => {
      if (!locationMap[attr.stakeholder]) {
        locationMap[attr.stakeholder] = {
          stakeholder: attr.stakeholder,
          type: attr.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
          callouts: []
        };
      }

      const entity = locationMap[attr.stakeholder];

      if (attr.attribute === 'pickup_location' || attr.attribute === 'car_current_location') {
        entity.location = attr.value;
        entity.attribute = attr.attribute;
      } else if (attr.attribute === 'destination') {
        entities.push({
          stakeholder: attr.stakeholder,
          attribute: 'destination',
          location: attr.value,
          type: attr.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
          callouts: ['dest']
        });
      } else {
        entity.callouts?.push(`${attr.attribute}: ${attr.value}`);
      }
    });

    Object.values(locationMap).forEach(e => {
      if (e.location) {
        entities.push(e as Entity);
      }
    });

    return entities;
  };

  const handlePrevFrame = () => {
    setCurrentFrameIndex(prev => Math.max(prev - 1, 0));
  };

  const handleNextFrame = () => {
    const timeline = participantTimelines[selectedParticipantIndex];
    if (timeline) {
      setCurrentFrameIndex(prev => Math.min(prev + 1, timeline.frames.length - 1));
    }
  };

  const handleParticipantChange = (index: number) => {
    setSelectedParticipantIndex(index);
    setCurrentFrameIndex(0);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        Loading frames...
      </div>
    );
  }

  if (participantTimelines.length === 0) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        No exploratory data found in studies S4 and S5.
      </div>
    );
  }

  const currentTimeline = participantTimelines[selectedParticipantIndex];
  const currentFrame = currentTimeline?.frames[currentFrameIndex];
  const entities = currentFrame ? getEntitiesFromFrame(currentFrame) : [];

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Left half: Grid */}
      <div style={{
        flex: 1,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '2px solid #ddd'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Simulation Grid</h2>

        {/* Participant selector */}
        <div style={{ marginBottom: '20px', width: '100%', maxWidth: '600px' }}>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Participant:</label>
          <select
            value={selectedParticipantIndex}
            onChange={(e) => handleParticipantChange(Number(e.target.value))}
            style={{ padding: '8px 12px', fontSize: '14px', minWidth: '200px' }}
          >
            {participantTimelines.map((timeline, index) => (
              <option key={index} value={index}>
                {timeline.participant_name} ({timeline.frames.length} frames)
              </option>
            ))}
          </select>
        </div>

        {/* Frame controls */}
        {currentTimeline && (
          <div style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            backgroundColor: '#fff',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <button
              onClick={handlePrevFrame}
              disabled={currentFrameIndex === 0}
              style={{
                padding: '8px 15px',
                fontSize: '14px',
                cursor: currentFrameIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentFrameIndex === 0 ? 0.5 : 1
              }}
            >
              ← Prev
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                Frame {currentFrameIndex + 1} / {currentTimeline.frames.length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Turn {currentFrame?.turn} • {currentFrame?.action}
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {currentFrame && new Date(currentFrame.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <button
              onClick={handleNextFrame}
              disabled={currentFrameIndex === currentTimeline.frames.length - 1}
              style={{
                padding: '8px 15px',
                fontSize: '14px',
                cursor: currentFrameIndex === currentTimeline.frames.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentFrameIndex === currentTimeline.frames.length - 1 ? 0.5 : 1
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Grid */}
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

            {/* Render entities */}
            {entities.map((entity, idx) => {
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
            })}
          </div>
        </div>

        <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
          Use ← → arrow keys to navigate frames
        </div>
      </div>

      {/* Right half: Stakeholder-Attribute Pairs */}
      <div style={{
        flex: 1,
        padding: '20px',
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        <h2 style={{ marginBottom: '20px' }}>Stakeholder-Attribute Pairs</h2>

        {currentFrame && (
          <div>
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f0f0f0',
              borderRadius: '5px'
            }}>
              <p><strong>Participant:</strong> {currentFrame.participant_name}</p>
              <p><strong>Action:</strong> <span style={{
                backgroundColor: currentFrame.action === 'add' ? '#d4edda' : currentFrame.action === 'delete' ? '#f8d7da' : '#d1ecf1',
                padding: '2px 8px',
                borderRadius: '3px',
                fontWeight: 'bold'
              }}>{currentFrame.action}</span></p>
              <p><strong>Turn:</strong> {currentFrame.turn}</p>
              <p><strong>Study ID:</strong> {currentFrame.study_id}</p>
              <p><strong>Timestamp:</strong> {new Date(currentFrame.timestamp).toLocaleString()}</p>
              <p><strong>Attributes:</strong> {currentFrame.attributes.length}</p>
            </div>

            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#007bff', color: '#fff' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>
                    Stakeholder
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>
                    Attribute
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentFrame.attributes.map((attr, index) => (
                  <tr key={index} style={{
                    backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff'
                  }}>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {attr.stakeholder}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                      {attr.attribute}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd', fontFamily: 'monospace' }}>
                      {attr.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {currentFrame.attributes.length === 0 && (
              <p style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
                No attributes configured at this point in time.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TestVisualization;
