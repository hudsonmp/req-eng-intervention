import React, { useState, useEffect } from 'react';
import './App.css';
import 'katex/dist/katex.min.css';

interface UserDropdown {
  id: number;
  selectedOption: string;
  customText: string;
}

function App() {
  const [dropdowns, setDropdowns] = useState<UserDropdown[]>([
    { id: 1, selectedOption: '', customText: '' }
  ]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedInteraction, setSelectedInteraction] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionsContent, setInstructionsContent] = useState('');
  const [showPredictionPopup, setShowPredictionPopup] = useState(false);
  const [predictionText, setPredictionText] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [interactions, setInteractions] = useState('');
  const [editableValues, setEditableValues] = useState({
    r1_request: '',
    r1_pickup: '',
    r2_request: '',
    r2_pickup: '',
    r2_destination: '',
    car_location: '',
    car_assigned: ''
  });
  const [testOutput, setTestOutput] = useState('');
  const [testCaseA, setTestCaseA] = useState('');
  const [testCaseB, setTestCaseB] = useState('');
  const [testCaseC, setTestCaseC] = useState('');
  
  interface InteractionTest {
    id: number;
    stakeholder: string;
    attribute: string;
    value: string;
    error: string;
  }
  
  const [interactionTests, setInteractionTests] = useState<InteractionTest[]>([
    { id: 1, stakeholder: '', attribute: '', value: '', error: '' }
  ]);
  
  // Helper to check if attribute is a location type
  const isLocationAttribute = (attr: string) => 
    ['pickup_location', 'destination', 'car_cur_location'].includes(attr);
  
  // Helper to check if attribute is a time type
  const isTimeAttribute = (attr: string) => 
    ['request_time', 'eta_car', 'eta_destination'].includes(attr);
  
  // Validate value based on attribute type
  const validateValue = (attribute: string, value: string): string => {
    if (!value) return '';
    
    if (isLocationAttribute(attribute)) {
      const match = value.match(/^\d+\s*,\s*\d+$/);
      if (!match) return 'Format: x, y (e.g., 5, 10)';
    } else if (isTimeAttribute(attribute)) {
      const match = value.match(/^\d+(\s*(min|mins|m))?$/i);
      if (!match) return 'Format: number (e.g., 5 or 5 min)';
    } else if (attribute === 'battery_level') {
      const match = value.match(/^\d+$/);
      if (!match || parseInt(value) > 100) return 'Format: 0-100';
    } else if (attribute === 'fare') {
      const match = value.match(/^\d+(\.\d{1,2})?$/);
      if (!match) return 'Format: amount (e.g., 15.50)';
    }
    return '';
  };
  
  // Get formatted value for display
  const getFormattedValue = (attribute: string, value: string): string => {
    if (!value) return '';
    if (isLocationAttribute(attribute)) return `(${value})`;
    if (isTimeAttribute(attribute)) return `T+${value}`;
    if (attribute === 'battery_level') return `${value}%`;
    if (attribute === 'fare') return `$${value}`;
    return value;
  };
  
  // Get stakeholders with location attributes for simulation display
  const getSimulationEntities = () => {
    const entities: { type: string; stakeholder: string; location: string; callouts: string[] }[] = [];
    
    interactionTests.filter(t => t.stakeholder && t.attribute && t.value && !t.error).forEach(test => {
      const existing = entities.find(e => e.stakeholder === test.stakeholder);
      
      if (isLocationAttribute(test.attribute)) {
        if (existing) {
          existing.location = test.value;
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: test.value,
            callouts: []
          });
        }
      } else {
        if (existing) {
          existing.callouts.push(`${test.attribute}: ${getFormattedValue(test.attribute, test.value)}`);
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: '',
            callouts: [`${test.attribute}: ${getFormattedValue(test.attribute, test.value)}`]
          });
        }
      }
    });
    
    return entities;
  };

  useEffect(() => {
    // Load instructions.tex file
    fetch('/instructions.tex')
      .then(response => response.text())
      .then(text => setInstructionsContent(text))
      .catch(err => console.error('Failed to load instructions:', err));
  }, []);

  const handleValueChange = (key: string, value: string) => {
    setEditableValues(prev => ({ ...prev, [key]: value }));
  };

  const parseCoordinates = (coordString: string): { x: number, y: number } => {
    const match = coordString.match(/\((\d+),\s*(\d+)\)/);
    if (match) {
      return { x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    return { x: 10, y: 10 }; // default
  };

  const getIconPosition = (coordString: string) => {
    const coords = parseCoordinates(coordString);
    // Each grid cell is 15px, so multiply by 15
    return {
      left: `${coords.x * 15}px`,
      top: `${coords.y * 15}px`
    };
  };

  const handleAddDropdown = () => {
    if (dropdowns.length < 3) {
      setDropdowns([...dropdowns, { 
        id: dropdowns.length + 1, 
        selectedOption: '', 
        customText: '' 
      }]);
    }
  };

  const handleSelectChange = (id: number, value: string) => {
    setDropdowns(dropdowns.map(dropdown => 
      dropdown.id === id ? { ...dropdown, selectedOption: value } : dropdown
    ));
    setErrorMessage(''); // Clear error when selection changes
  };

  const handleCustomTextChange = (id: number, value: string) => {
    setDropdowns(dropdowns.map(dropdown => 
      dropdown.id === id ? { ...dropdown, customText: value } : dropdown
    ));
    setErrorMessage(''); // Clear error when selection changes
  };

  const completeUsers = dropdowns.filter(d => d.selectedOption && d.customText).length;
  const isButtonEnabled = completeUsers >= 2;

  const handleBeginHelping = () => {
    // Get all complete dropdowns (both category and attribute selected)
    const completeDropdowns = dropdowns.filter(d => d.selectedOption && d.customText);
    
    // Extract unique categories
    const uniqueCategories = new Set(completeDropdowns.map(d => d.selectedOption));
    
    // Check if there are at least 2 distinct categories
    if (uniqueCategories.size < 2) {
      setErrorMessage("You must select two or more distinct categories");
      return;
    }
    
    // Clear error and proceed
    setErrorMessage('');
    // TODO: Add logic to proceed with simulation
    console.log('Proceeding with simulation', completeDropdowns);
  };

  const parseInlineFormatting = (text: string): JSX.Element[] => {
    // Split on both **bold** and `code`
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ 
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          backgroundColor: '#f4f4f4',
          padding: '2px 4px',
          fontSize: '13px',
          borderRadius: '3px'
        }}>{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let inList = false;
    
    lines.forEach((line, index) => {
      if (line.trim() === '') {
        if (inList) {
          inList = false;
        }
        return;
      }
      
      // Handle # headers (h2)
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={index} style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '15px', marginBottom: '10px' }}>
            {line.substring(2)}
          </h2>
        );
      }
      // Handle ## headers (h3)
      else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={index} style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', marginBottom: '8px' }}>
            {line.substring(3)}
          </h3>
        );
      }
      // Handle numbered lists
      else if (line.match(/^\d+\.\s/)) {
        if (!inList) {
          inList = true;
        }
        const content = line.replace(/^\d+\.\s/, '');
        elements.push(
          <div key={index} style={{ marginLeft: '20px', marginBottom: '8px' }}>
            <span style={{ marginRight: '8px' }}>{line.match(/^\d+/)?.[0]}.</span>
            {parseInlineFormatting(content)}
          </div>
        );
      }
      // Handle paragraphs
      else {
        elements.push(
          <p key={index} style={{ marginBottom: '10px', lineHeight: '1.6' }}>
            {parseInlineFormatting(line)}
          </p>
        );
      }
    });
    
    return elements;
  };

  return (
    <div className="app" style={{ padding: '20px' }}>
      <div className="container container-1">
        <div style={{ paddingTop: '10px' }}>
          <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
            Rideshare Simulation
          </h3>
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
            {/* Dynamic entities from interaction tests */}
            {getSimulationEntities().map((entity, idx) => {
              const isRider1 = entity.stakeholder === 'rider_1';
              const isRider2 = entity.stakeholder === 'rider_2';
              const isVehicle1 = entity.stakeholder === 'vehicle_1';
              const isVehicle2 = entity.stakeholder === 'vehicle_2';
              
              const color = (isRider1 || isVehicle1) ? 'blue' : 'red';
              const borderColor = color === 'blue' ? '#0066cc' : '#cc0000';
              const filter = color === 'blue' 
                ? 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
                : 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)';
              
              const icon = entity.type === 'rider' ? '/icons/rider.svg' : '/icons/vehicle.svg';
              const label = entity.stakeholder.replace('_', ' ').replace('rider', 'R').replace('vehicle', 'V').replace(' ', '');
              
              // If no location, place at a default position based on stakeholder
              const defaultPositions: Record<string, string> = {
                'rider_1': '5, 5',
                'rider_2': '15, 5',
                'vehicle_1': '10, 15',
                'vehicle_2': '10, 10'
              };
              const location = entity.location || defaultPositions[entity.stakeholder] || '10, 10';
              const position = getIconPosition(`(${location})`);
              
              return (
                <React.Fragment key={entity.stakeholder}>
                  <img 
                    src={icon} 
                    alt={entity.stakeholder} 
              style={{ 
                position: 'absolute',
                width: '20px',
                height: '20px',
                      ...position,
                      filter,
                      opacity: entity.location ? 1 : 0.5
              }} 
            />
            <div style={{
              position: 'absolute',
                    top: `calc(${position.top} + 22px)`,
                    left: `calc(${position.left} - 10px)`,
                    fontSize: '9px',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '2px 4px',
                    border: `1px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                    maxWidth: '80px'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{label}</div>
                    {entity.location && <div>({entity.location})</div>}
                    {entity.callouts.map((callout, i) => (
                      <div key={i} style={{ fontSize: '8px', color: '#666' }}>{callout}</div>
                    ))}
            </div>
                </React.Fragment>
              );
            })}
            {getSimulationEntities().length === 0 && (
            <div style={{
              position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '11px',
                color: '#999',
                textAlign: 'center'
              }}>
                Add interaction tests<br/>to see simulation
            </div>
            )}
          </div>
          
          {/* Input Fields Section */}
          <div style={{ marginTop: '15px', marginRight: '20px' }}>
            <div style={{ padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Expected Output:
                </label>
                <input
                  type="text"
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  placeholder="Enter expected output..."
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Interactions:
                </label>
                <textarea
                  value={interactions}
                  onChange={(e) => setInteractions(e.target.value)}
                  placeholder="Describe interactions..."
                  style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Begin Simulation Button */}
              <button
                onClick={() => setShowPredictionPopup(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Simulate Scenario with Tests
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container container-2" style={{ position: 'relative' }}>
        <div style={{ padding: '10px 10px 10px 0' }}>
          {/* Oracle Button */}
          <button
            onClick={() => console.log('TA Assistant Oracle clicked')}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '6px 10px',
              fontSize: '11px',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              zIndex: 10,
              borderRadius: '4px'
            }}
          >
            <span style={{ fontSize: '14px' }}>🤖</span>
            <span>Talk to TA Assistant Oracle</span>
          </button>
          
          
            <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
            Select Interaction Test
            </h3>
            
          {/* Interaction Test Items */}
          {interactionTests.map((test) => {
            const getIconAndColor = (stakeholder: string) => {
              if (stakeholder === 'rider_1') return { icon: '/icons/rider.svg', color: 'blue' };
              if (stakeholder === 'rider_2') return { icon: '/icons/rider.svg', color: 'red' };
              if (stakeholder === 'vehicle_1') return { icon: '/icons/vehicle.svg', color: 'blue' };
              if (stakeholder === 'vehicle_2') return { icon: '/icons/vehicle.svg', color: 'red' };
                return { icon: '/icons/rider.svg', color: 'blue' };
              };
              
            const iconData = getIconAndColor(test.stakeholder);
            
            // Get placeholder and prefix based on attribute
            const getValueInput = (attribute: string) => {
              if (isLocationAttribute(attribute)) {
                return { prefix: '(', suffix: ')', placeholder: 'x, y' };
              } else if (isTimeAttribute(attribute)) {
                return { prefix: 'T+', suffix: '', placeholder: '0' };
              } else if (attribute === 'battery_level') {
                return { prefix: '', suffix: '%', placeholder: '0-100' };
              } else if (attribute === 'fare') {
                return { prefix: '$', suffix: '', placeholder: '0.00' };
              }
              return { prefix: '', suffix: '', placeholder: 'value' };
            };
            
            const valueInput = getValueInput(test.attribute);
              
              return (
              <div key={test.id} style={{ 
                  marginBottom: '10px',
                  padding: '10px',
                  backgroundColor: 'white',
                border: test.error ? '1px solid #f44336' : '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <img 
                      src={iconData.icon} 
                      alt="icon" 
                      style={{ 
                      width: '32px', 
                      height: '32px', 
                      filter: iconData.color === 'blue' 
                        ? 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
                        : 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)',
                      opacity: test.stakeholder ? 1 : 0.3
                      }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <select
                      value={test.stakeholder}
                      onChange={(e) => setInteractionTests(interactionTests.map(t => 
                        t.id === test.id ? { ...t, stakeholder: e.target.value, error: '' } : t
                        ))}
                        style={{ 
                          width: '100%',
                          padding: '4px 6px', 
                        fontSize: '11px',
                          border: '1px solid #ccc',
                          backgroundColor: 'white',
                          color: '#000000',
                        marginBottom: '4px'
                        }}
                      >
                      <option value="">Select Stakeholder</option>
                        <option value="rider_1">Rider 1</option>
                        <option value="rider_2">Rider 2</option>
                        <option value="vehicle_1">Vehicle 1</option>
                        <option value="vehicle_2">Vehicle 2</option>
                      </select>
                    
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>
                          Attr:
                        </label>
                        <select
                        value={test.attribute}
                        onChange={(e) => setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, attribute: e.target.value, value: '', error: '' } : t
                          ))}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            fontSize: '10px',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                          color: '#000000'
                          }}
                        >
                        <option value="">Select Attribute</option>
                          <option value="pickup_location">pickup_location</option>
                          <option value="destination">destination</option>
                          <option value="request_time">request_time</option>
                          <option value="eta_car">eta_car</option>
                          <option value="eta_destination">eta_destination</option>
                          <option value="car_cur_location">car_cur_location</option>
                          <option value="battery_level">battery_level</option>
                        <option value="fare">fare</option>
                        </select>
                      </div>
                    
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>
                          Val:
                        </label>
                      <div style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center',
                        border: '1px solid #ccc',
                        backgroundColor: test.attribute ? 'white' : '#f0f0f0'
                      }}>
                        {valueInput.prefix && (
                          <span style={{ padding: '4px', fontSize: '10px', color: '#666', backgroundColor: '#f5f5f5' }}>
                            {valueInput.prefix}
                          </span>
                        )}
                        <input
                          type="text"
                          value={test.value}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const error = validateValue(test.attribute, newValue);
                            setInteractionTests(interactionTests.map(t => 
                              t.id === test.id ? { ...t, value: newValue, error } : t
                            ));
                          }}
                          disabled={!test.attribute}
                          placeholder={test.attribute ? valueInput.placeholder : "Select attribute first"}
                          style={{
                            flex: 1,
                            padding: '4px',
                            fontSize: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: test.attribute ? '#000000' : '#999',
                            cursor: test.attribute ? 'text' : 'not-allowed',
                            outline: 'none'
                          }}
                        />
                        {valueInput.suffix && (
                          <span style={{ padding: '4px', fontSize: '10px', color: '#666', backgroundColor: '#f5f5f5' }}>
                            {valueInput.suffix}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setInteractionTests(interactionTests.filter(t => t.id !== test.id))}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                          cursor: 'pointer',
                          color: '#d32f2f'
                          }}
                      >
                        ×
                      </button>
                      </div>
                    
                    {test.error && (
                      <div style={{ fontSize: '9px', color: '#f44336', marginTop: '2px' }}>
                        ⚠ {test.error}
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}
            
          {/* Add Interaction Test Button */}
          {interactionTests.length < 10 && (
              <button
                onClick={() => {
                const newId = interactionTests.length > 0 ? Math.max(...interactionTests.map(t => t.id)) + 1 : 1;
                setInteractionTests([...interactionTests, { 
                    id: newId, 
                  stakeholder: '', 
                  attribute: '', 
                  value: '',
                  error: ''
                  }]);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '11px',
                  border: '2px dashed #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  color: '#666',
                  fontWeight: '500'
                }}
              >
              + Add Interaction Test
              </button>
            )}

        </div>
      </div>
      <div className="container container-3" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
        {/* Header */}
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#ff9800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px'
          }}>
            👨‍💻
          </div>
          <div>
            <h3 style={{ margin: '0', fontSize: '13px', fontWeight: 'bold', color: '#000' }}>
              Office Hour!
            </h3>
            <div style={{ fontSize: '10px', color: '#666' }}>
              Alex • Third-Year • CS1 student
            </div>
          </div>
        </div>
          
        {/* Chat Messages */}
        <div style={{ 
          flex: 1, 
          padding: '10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: '#f5f5f5'
        }}>
          {/* Chat messages will be rendered here from backend */}
        </div>
      </div>
      
      {/* Prediction Popup */}
      {showPredictionPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowPredictionPopup(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              width: '700px',
              border: '1px solid #ccc',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPredictionPopup(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: 'none',
                background: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
            <h3 style={{ marginTop: '0', marginBottom: '15px', fontSize: '16px' }}>
              Predict stakeholder interactions
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>
                Selected interaction tests:
              </h4>
              <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                {interactionTests
                  .filter(t => t.stakeholder && t.attribute)
                  .map(t => {
                    const formatName = (name: string) => {
                      return name.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                    };
                    return (
                      <div key={t.id} style={{ marginBottom: '4px' }}>
                        • {formatName(t.stakeholder)}: {t.attribute}
                        {t.value && !t.error && ` = ${getFormattedValue(t.attribute, t.value)}`}
                      </div>
                    );
                  })
                }
                {interactionTests.filter(t => t.stakeholder && t.attribute).length === 0 && (
                  <div style={{ color: '#999', fontStyle: 'italic' }}>
                    No tests selected yet
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                Your prediction:
              </label>
              <textarea
                value={predictionText}
                onChange={(e) => setPredictionText(e.target.value)}
                placeholder="Describe how you think these stakeholders will interact..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowPredictionPopup(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Prediction:', predictionText);
                  setShowPredictionPopup(false);
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showInstructions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setShowInstructions(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflow: 'auto',
              border: '1px solid #ccc',
              position: 'relative',
              fontFamily: '"Times New Roman", Times, serif'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInstructions(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
            <div style={{ fontSize: '14px' }}>
              {renderFormattedText(instructionsContent)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
