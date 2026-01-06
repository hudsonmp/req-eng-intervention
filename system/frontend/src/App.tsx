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
    value2: string; // For assigned (rider selection) or end_early (coordinates)
    error: string;
  }
  
  const [interactionTests, setInteractionTests] = useState<InteractionTest[]>([
    { id: 1, stakeholder: '', attribute: '', value: '', value2: '', error: '' }
  ]);
  const [showDistanceTool, setShowDistanceTool] = useState(false);
  const [distanceStakeholder1, setDistanceStakeholder1] = useState('');
  const [distanceStakeholder2, setDistanceStakeholder2] = useState('');
  const [distanceResult, setDistanceResult] = useState<number | null>(null);
  
  // Helper to check if attribute is a location type
  const isLocationAttribute = (attr: string) => 
    ['pickup_location', 'destination', 'car_current_location', 'end_early'].includes(attr);
  
  // Helper to check if attribute is a time type
  const isTimeAttribute = (attr: string) => 
    ['request_time', 'eta_vehicle', 'eta_destination'].includes(attr);
  
  // Helper to check if attribute is binary
  const isBinaryAttribute = (attr: string) => 
    ['accessible', 'occupied', 'assigned', 'traffic_delay', 'cancels', 'change_destination', 'end_early'].includes(attr);
  
  // Validate value based on attribute type
  const validateValue = (attribute: string, value: string): string => {
    if (!value) return '';
    
    if (isLocationAttribute(attribute) && attribute !== 'end_early') {
      const match = value.match(/^\d+\s*,\s*\d+$/);
      if (!match) return 'x,y';
    } else if (isTimeAttribute(attribute)) {
      const match = value.match(/^\d+$/);
      if (!match) return 'number';
    } else if (attribute === 'battery') {
      const match = value.match(/^\d+$/);
      if (!match || parseInt(value) > 100) return '0-100';
    } else if (isBinaryAttribute(attribute) && attribute !== 'assigned' && attribute !== 'end_early') {
      if (value !== 'true' && value !== 'false') return 'true/false';
    }
    return '';
  };
  
  // Get formatted value for display
  const getFormattedValue = (attribute: string, value: string): string => {
    if (!value) return '';
    if (isLocationAttribute(attribute)) return `(${value})`;
    if (isTimeAttribute(attribute)) return `T+${value}`;
    if (attribute === 'battery') return `${value}/100`;
    return value;
  };
  
  // Calculate distance between two coordinates
  const calculateDistance = () => {
    const entity1 = interactionTests.find(t => 
      t.stakeholder === distanceStakeholder1 && isLocationAttribute(t.attribute) && t.value && !t.error
    );
    const entity2 = interactionTests.find(t => 
      t.stakeholder === distanceStakeholder2 && isLocationAttribute(t.attribute) && t.value && !t.error
    );
    
    if (entity1 && entity2) {
      const coords1 = entity1.value.split(',').map(n => parseInt(n.trim()));
      const coords2 = entity2.value.split(',').map(n => parseInt(n.trim()));
      const dist = Math.sqrt(Math.pow(coords2[0] - coords1[0], 2) + Math.pow(coords2[1] - coords1[1], 2));
      setDistanceResult(Math.round(dist * 100) / 100);
    } else {
      setDistanceResult(null);
    }
  };
  
  // Get stakeholders that have coordinates
  const getStakeholdersWithCoords = () => {
    return [...new Set(interactionTests
      .filter(t => t.stakeholder && isLocationAttribute(t.attribute) && t.value && !t.error)
      .map(t => t.stakeholder))];
  };
  
  // Get stakeholders with location attributes for simulation display
  const getSimulationEntities = () => {
    const entities: { type: string; stakeholder: string; location: string; isDestination: boolean; callouts: string[] }[] = [];
    
    interactionTests.filter(t => t.stakeholder && t.attribute && t.value && !t.error).forEach(test => {
      const isDestAttr = test.attribute === 'destination';
      const isDestEta = test.attribute === 'eta_destination';
      const isMainLocAttr = (test.attribute === 'pickup_location' || test.attribute === 'car_current_location');
      
      if (isDestAttr) {
        // Destination location - create/update destination entity (lighter shade)
        const existingDest = entities.find(e => e.stakeholder === test.stakeholder && e.isDestination);
        if (existingDest) {
          existingDest.location = test.value;
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: test.value,
            isDestination: true,
            callouts: []
          });
        }
      } else if (isMainLocAttr) {
        // Main location (pickup/current) - create/update main entity (darker shade)
        const existingMain = entities.find(e => e.stakeholder === test.stakeholder && !e.isDestination);
        if (existingMain) {
          existingMain.location = test.value;
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: test.value,
            isDestination: false,
            callouts: []
          });
        }
      } else if (isDestEta) {
        // eta_destination goes on destination entity
        const existingDest = entities.find(e => e.stakeholder === test.stakeholder && e.isDestination);
        const displayVal = `eta: ${getFormattedValue(test.attribute, test.value)}`;
        if (existingDest) {
          existingDest.callouts.push(displayVal);
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: '',
            isDestination: true,
            callouts: [displayVal]
          });
        }
      } else {
        // All other attributes go on main entity (darker)
        const existingMain = entities.find(e => e.stakeholder === test.stakeholder && !e.isDestination);
        const displayVal = test.attribute === 'assigned' && test.value === 'true' && test.value2 
          ? `assigned: ${test.value2}`
          : test.attribute === 'end_early' && test.value === 'true' && test.value2
          ? `end_early: (${test.value2})`
          : `${test.attribute}: ${getFormattedValue(test.attribute, test.value)}`;
        
        if (existingMain) {
          existingMain.callouts.push(displayVal);
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: '',
            isDestination: false,
            callouts: [displayVal]
          });
        }
      }
    });
    
    // Sort so main entities come before destinations
    entities.sort((a, b) => {
      if (a.stakeholder !== b.stakeholder) return a.stakeholder.localeCompare(b.stakeholder);
      return a.isDestination ? 1 : -1;
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
            {getSimulationEntities().filter(e => e.location).map((entity, idx) => {
              const colorMap: Record<string, string> = {
                'rider_1': 'blue', 'rider_2': 'red', 'rider_3': 'green',
                'vehicle_1': 'blue', 'vehicle_2': 'red'
              };
              const color = colorMap[entity.stakeholder] || 'blue';
              const borderColors: Record<string, string> = { blue: '#0066cc', red: '#cc0000', green: '#2e7d32' };
              const filters: Record<string, string> = {
                blue: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)',
                red: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)',
                green: 'invert(30%) sepia(95%) saturate(1000%) hue-rotate(100deg) brightness(95%) contrast(105%)'
              };
              const borderColor = borderColors[color];
              const filter = filters[color];
              
              const icon = entity.type === 'rider' ? '/icons/rider.svg' : '/icons/vehicle.svg';
              const label = entity.stakeholder.replace('_', '').replace('rider', 'R').replace('vehicle', 'V');
              const labelSuffix = entity.isDestination ? ' dest' : '';
              
              const position = getIconPosition(`(${entity.location})`);
              
              // Lighter opacity for destination markers
              const iconOpacity = entity.isDestination ? 0.4 : 1;
              const labelOpacity = entity.isDestination ? 0.7 : 1;
              
              return (
                <React.Fragment key={`${entity.stakeholder}-${entity.isDestination ? 'dest' : 'main'}`}>
                  <img 
                    src={icon} 
                    alt={entity.stakeholder} 
              style={{ 
                position: 'absolute',
                width: '20px',
                height: '20px',
                      ...position,
                      filter,
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
                    border: `1px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                    maxWidth: '80px',
                    opacity: labelOpacity
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{label}{labelSuffix}</div>
                    <div>({entity.location})</div>
                    {entity.callouts.map((callout, i) => (
                      <div key={i} style={{ fontSize: '8px', color: '#666' }}>{callout}</div>
                    ))}
            </div>
                </React.Fragment>
              );
            })}
            {getSimulationEntities().filter(e => e.location).length === 0 && (
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
            
          {/* Distance Measurement Tool */}
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowDistanceTool(!showDistanceTool)}
              style={{ 
                padding: '4px 8px', 
              fontSize: '10px',
                border: '1px solid #ccc', 
                backgroundColor: showDistanceTool ? '#e3f2fd' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Measure distance between stakeholders"
            >
              📏 Measure
            </button>
            {showDistanceTool && (
              <>
                <select
                  value={distanceStakeholder1}
                  onChange={(e) => { setDistanceStakeholder1(e.target.value); setDistanceResult(null); }}
                  style={{ padding: '2px', fontSize: '9px', border: '1px solid #ccc', width: '50px' }}
                >
                  <option value="">--</option>
                  {getStakeholdersWithCoords().map(s => (
                    <option key={s} value={s}>{s.replace('rider_', 'R').replace('vehicle_', 'V')}</option>
                  ))}
                </select>
                <span style={{ fontSize: '9px' }}>↔</span>
                <select
                  value={distanceStakeholder2}
                  onChange={(e) => { setDistanceStakeholder2(e.target.value); setDistanceResult(null); }}
                  style={{ padding: '2px', fontSize: '9px', border: '1px solid #ccc', width: '50px' }}
                >
                  <option value="">--</option>
                  {getStakeholdersWithCoords().filter(s => s !== distanceStakeholder1).map(s => (
                    <option key={s} value={s}>{s.replace('rider_', 'R').replace('vehicle_', 'V')}</option>
                  ))}
                </select>
                <button
                  onClick={calculateDistance}
                  disabled={!distanceStakeholder1 || !distanceStakeholder2}
                  style={{ padding: '2px 6px', fontSize: '9px', border: '1px solid #ccc', backgroundColor: '#f5f5f5', cursor: 'pointer' }}
                >
                  =
                </button>
                {distanceResult !== null && (
                  <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#1976d2' }}>{distanceResult} units</span>
                )}
              </>
            )}
          </div>
          
          {/* Input Fields Section */}
          <div style={{ marginTop: '10px', marginRight: '20px' }}>
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
          
          
            <h3 style={{ marginTop: '0', marginBottom: '8px', fontSize: '13px', color: '#000000' }}>
            Select Interaction Test
            </h3>
            
          {/* Interaction Test Items - Compact */}
          {interactionTests.map((test) => {
            const colorMap: Record<string, string> = {
              'rider_1': 'blue', 'rider_2': 'red', 'rider_3': 'green',
              'vehicle_1': 'blue', 'vehicle_2': 'red'
            };
            const filterMap: Record<string, string> = {
              blue: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)',
              red: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)',
              green: 'invert(30%) sepia(95%) saturate(1000%) hue-rotate(100deg) brightness(95%) contrast(105%)'
            };
            const iconSrc = test.stakeholder?.startsWith('vehicle') ? '/icons/vehicle.svg' : '/icons/rider.svg';
            const color = colorMap[test.stakeholder] || 'blue';
            
            const needsSecondValue = test.attribute === 'assigned' || test.attribute === 'end_early';
            const isBinary = isBinaryAttribute(test.attribute);
            const isCoord = isLocationAttribute(test.attribute) && test.attribute !== 'end_early';
            const isTime = isTimeAttribute(test.attribute);
              
              return (
              <div key={test.id} style={{ 
                marginBottom: '4px',
                padding: '6px',
                  backgroundColor: 'white',
                border: test.error ? '1px solid #f44336' : '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                <img src={iconSrc} alt="" style={{ width: '20px', height: '20px', filter: filterMap[color], opacity: test.stakeholder ? 1 : 0.3 }} />
                
                      <select
                  value={test.stakeholder}
                  onChange={(e) => setInteractionTests(interactionTests.map(t => 
                    t.id === test.id ? { ...t, stakeholder: e.target.value, error: '' } : t
                  ))}
                  style={{ width: '65px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                >
                  <option value="">--</option>
                  <option value="rider_1">R1</option>
                  <option value="rider_2">R2</option>
                  <option value="rider_3">R3</option>
                  <option value="vehicle_1">V1</option>
                  <option value="vehicle_2">V2</option>
                      </select>
                
                        <select
                  value={test.attribute}
                  onChange={(e) => setInteractionTests(interactionTests.map(t => 
                    t.id === test.id ? { ...t, attribute: e.target.value, value: '', value2: '', error: '' } : t
                  ))}
                  style={{ width: '90px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                >
                  <option value="">-- attr --</option>
                  <optgroup label="Coordinates">
                          <option value="pickup_location">pickup_location</option>
                          <option value="destination">destination</option>
                    <option value="car_current_location">car_current_loc</option>
                  </optgroup>
                  <optgroup label="Binary">
                          <option value="accessible">accessible</option>
                          <option value="occupied">occupied</option>
                    <option value="assigned">assigned</option>
                    <option value="traffic_delay">traffic_delay</option>
                    <option value="cancels">cancels</option>
                    <option value="change_destination">change_dest</option>
                    <option value="end_early">end_early</option>
                  </optgroup>
                  <optgroup label="Time (T+)">
                    <option value="eta_vehicle">eta_vehicle</option>
                    <option value="eta_destination">eta_destination</option>
                    <option value="request_time">request_time</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="battery">battery</option>
                  </optgroup>
                        </select>
                
                {/* Value input based on type */}
                {isCoord ? (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                    <span>(</span>
                    <input
                      type="text"
                      value={test.value}
                      onChange={(e) => {
                        const error = validateValue(test.attribute, e.target.value);
                        setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value, error } : t
                        ));
                      }}
                      disabled={!test.attribute}
                      placeholder="x,y"
                      style={{ width: '40px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                    />
                    <span>)</span>
                      </div>
                ) : isTime ? (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                    <span>T+</span>
                        <input
                          type="text"
                      value={test.value}
                      onChange={(e) => {
                        const error = validateValue(test.attribute, e.target.value);
                        setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value, error } : t
                        ));
                      }}
                      disabled={!test.attribute}
                      placeholder="0"
                      style={{ width: '30px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                        />
                      </div>
                ) : test.attribute === 'battery' ? (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                    <input
                      type="text"
                      value={test.value}
                      onChange={(e) => {
                        const error = validateValue(test.attribute, e.target.value);
                        setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value, error } : t
                        ));
                      }}
                      disabled={!test.attribute}
                      placeholder="0"
                      style={{ width: '30px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                    />
                    <span>/100</span>
                    </div>
                ) : isBinary ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '9px' }}>
                    <select
                      value={test.value}
                      onChange={(e) => setInteractionTests(interactionTests.map(t => 
                        t.id === test.id ? { ...t, value: e.target.value, value2: '' } : t
                      ))}
                      style={{ width: '50px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                    >
                      <option value="">--</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                    {/* Extra field for assigned (rider selection) */}
                    {test.attribute === 'assigned' && test.value === 'true' && (
                      <select
                        value={test.value2}
                        onChange={(e) => setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, value2: e.target.value } : t
                        ))}
                        style={{ width: '50px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                      >
                        <option value="">rider?</option>
                        <option value="R1">R1</option>
                        <option value="R2">R2</option>
                        <option value="R3">R3</option>
                        <option value="R1,R2">R1,R2</option>
                        <option value="R1,R3">R1,R3</option>
                        <option value="R2,R3">R2,R3</option>
                      </select>
                    )}
                    {/* Extra field for end_early (coordinates) */}
                    {test.attribute === 'end_early' && test.value === 'true' && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span>(</span>
                        <input
                          type="text"
                          value={test.value2}
                          onChange={(e) => setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value2: e.target.value } : t
                          ))}
                          placeholder="x,y"
                          style={{ width: '35px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                        />
                        <span>)</span>
                  </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={test.value}
                    onChange={(e) => setInteractionTests(interactionTests.map(t => 
                      t.id === test.id ? { ...t, value: e.target.value } : t
                    ))}
                    disabled={!test.attribute}
                    placeholder="val"
                    style={{ width: '50px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                  />
                )}
                
                <button
                  onClick={() => setInteractionTests(interactionTests.filter(t => t.id !== test.id))}
                  style={{ padding: '2px 5px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#d32f2f' }}
                >
                  ×
                </button>
                
                {test.error && <span style={{ fontSize: '8px', color: '#f44336' }}>⚠{test.error}</span>}
                </div>
              );
            })}
            
          {/* Add Interaction Test Button */}
          {interactionTests.length < 15 && (
              <button
                onClick={() => {
                const newId = interactionTests.length > 0 ? Math.max(...interactionTests.map(t => t.id)) + 1 : 1;
                setInteractionTests([...interactionTests, { 
                    id: newId, 
                  stakeholder: '', 
                  attribute: '', 
                  value: '',
                  value2: '',
                  error: ''
                  }]);
                }}
              style={{ width: '100%', padding: '6px', fontSize: '10px', border: '2px dashed #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#666' }}
            >
              + Add Test
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
                    const formatName = (name: string) => name.replace('_', ' ').replace('rider', 'R').replace('vehicle', 'V');
                    let displayVal = '';
                    if (t.value && !t.error) {
                      if (t.attribute === 'assigned' && t.value === 'true' && t.value2) {
                        displayVal = ` = assigned(${t.value2})`;
                      } else if (t.attribute === 'end_early' && t.value === 'true' && t.value2) {
                        displayVal = ` = end_early(${t.value2})`;
                      } else {
                        displayVal = ` = ${getFormattedValue(t.attribute, t.value)}`;
                      }
                    }
                    return (
                      <div key={t.id} style={{ marginBottom: '4px' }}>
                        • {formatName(t.stakeholder)}: {t.attribute}{displayVal}
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
