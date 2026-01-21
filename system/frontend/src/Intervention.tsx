import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import 'katex/dist/katex.min.css';

interface UserDropdown {
  id: number;
  selectedOption: string;
  customText: string;
}

function Intervention() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get participant and study IDs from router state
  const [participantId, setParticipantId] = useState<string>('');
  const [studyId, setStudyId] = useState<number>(0);

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
  
  const [interactionTests, setInteractionTests] = useState<InteractionTest[]>([]);
  const [hasReceivedLLMMessage, setHasReceivedLLMMessage] = useState(false);
  const [isExploratoryMode, setIsExploratoryMode] = useState(false);
  const [showDistanceTool, setShowDistanceTool] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: number; role: 'user' | 'assistant'; content: string; isTestScenario?: boolean; testData?: any}[]>([]);
  const [distanceStakeholder1, setDistanceStakeholder1] = useState('');
  
  // Animation state
  const [animationStep, setAnimationStep] = useState(0); // 0=idle, 1-10=moving to pickup, 11-20=moving to dest
  const [isAnimating, setIsAnimating] = useState(false);
  const [vehiclePositions, setVehiclePositions] = useState<Record<string, {x: number, y: number}>>({});
  const [showBugPopup, setShowBugPopup] = useState(false);
  const [showExplorePopup, setShowExplorePopup] = useState(false);
  const [editingEntity, setEditingEntity] = useState<{stakeholder: string; isDestination: boolean} | null>(null);
  const [draggingEntity, setDraggingEntity] = useState<string | null>(null);
  const [timelineFrames, setTimelineFrames] = useState<InteractionTest[][]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState(false);
  const [changedAttributes, setChangedAttributes] = useState<Set<string>>(new Set());
  const [hasBegunTesting, setHasBegunTesting] = useState(false);
  
  // Test hierarchy: multiple tests, each with hypothesis + frames
  interface SavedTest {
    id: number;
    name: string;
    whatToTest: string;
    howToBreak: string;
    expectedOutput: string;
    frames: InteractionTest[][];
  }
  const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
  const [currentTestId, setCurrentTestId] = useState<number | null>(null);
  const [hypothesisFields, setHypothesisFields] = useState({
    whatToTest: '',
    howToBreak: '',
    expectedOutput: ''
  });
  const [selectedTestToSend, setSelectedTestToSend] = useState<number | null>(null);
  const [testExplanation, setTestExplanation] = useState('');
  const [distanceStakeholder2, setDistanceStakeholder2] = useState('');
  
  // All available attributes
  const riderAttributes = [
    'pickup_location', 'destination', 'request_time', 'eta_vehicle', 'eta_destination',
    'accessible', 'assigned', 'cancels', 'change_destination', 'end_early', 'traffic_delay'
  ];
  const vehicleAttributes = [
    'car_current_location', 'battery', 'occupied', 'accessible', 'traffic_delay'
  ];
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
    const entities: { type: string; stakeholder: string; location: string; isDestination: boolean; callouts: {text: string; attr: string}[] }[] = [];
    
    interactionTests.filter(t => t.stakeholder && t.attribute && t.value && !t.error).forEach(test => {
      // Use animated position for vehicles if animating
      let testValue = test.value;
      if (isAnimating && test.attribute === 'car_current_location' && vehiclePositions[test.stakeholder]) {
        const pos = vehiclePositions[test.stakeholder];
        testValue = `${pos.x},${pos.y}`;
      }
      const isDestAttr = test.attribute === 'destination';
      const isDestEta = test.attribute === 'eta_destination';
      const isMainLocAttr = (test.attribute === 'pickup_location' || test.attribute === 'car_current_location');
      
      if (isDestAttr) {
        // Destination location - create/update destination entity (lighter shade)
        const existingDest = entities.find(e => e.stakeholder === test.stakeholder && e.isDestination);
        if (existingDest) {
          existingDest.location = testValue;
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: testValue,
            isDestination: true,
            callouts: []
          });
        }
      } else if (isMainLocAttr) {
        // Main location (pickup/current) - create/update main entity (darker shade)
        const existingMain = entities.find(e => e.stakeholder === test.stakeholder && !e.isDestination);
        if (existingMain) {
          existingMain.location = testValue;
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: testValue,
            isDestination: false,
            callouts: []
          });
        }
      } else if (isDestEta) {
        // eta_destination goes on destination entity
        const existingDest = entities.find(e => e.stakeholder === test.stakeholder && e.isDestination);
        const displayVal = `eta: ${getFormattedValue(test.attribute, test.value)}`;
        if (existingDest) {
          existingDest.callouts.push({text: displayVal, attr: test.attribute});
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: '',
            isDestination: true,
            callouts: [{text: displayVal, attr: test.attribute}]
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
          existingMain.callouts.push({text: displayVal, attr: test.attribute});
        } else {
          entities.push({
            type: test.stakeholder.startsWith('rider') ? 'rider' : 'vehicle',
            stakeholder: test.stakeholder,
            location: '',
            isDestination: false,
            callouts: [{text: displayVal, attr: test.attribute}]
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

  // Get participant and study IDs from router state
  useEffect(() => {
    const state = location.state as { participantId?: string; studyId?: number };
    if (state?.participantId && state?.studyId) {
      setParticipantId(state.participantId);
      setStudyId(state.studyId);
    } else {
      // Redirect back to landing page if IDs are missing
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    // Load instructions.tex file
    fetch('/instructions.tex')
      .then(response => response.text())
      .then(text => setInstructionsContent(text))
      .catch(err => console.error('Failed to load instructions:', err));
  }, []);

  // Animation effect
  useEffect(() => {
    if (!isAnimating) return;
    
    if (animationStep < 20) {
      const timer = setTimeout(() => {
        setAnimationStep(prev => prev + 1);
        
        // Interpolate vehicle positions
        const v1Start = { x: 3, y: 3 };
        const v1Pickup = { x: 5, y: 5 };
        const v1Dest = { x: 15, y: 15 };
        
        const v2Start = { x: 12, y: 12 };
        const v2Pickup = { x: 10, y: 10 };
        const v2Dest = { x: 20, y: 20 };
        
        const step = animationStep + 1;
        
        if (step <= 10) {
          // Phase 1: Move to pickup (steps 1-10)
          const t = step / 10;
          setVehiclePositions({
            vehicle_1: {
              x: Math.round(v1Start.x + (v1Pickup.x - v1Start.x) * t),
              y: Math.round(v1Start.y + (v1Pickup.y - v1Start.y) * t)
            },
            vehicle_2: {
              x: Math.round(v2Start.x + (v2Pickup.x - v2Start.x) * t),
              y: Math.round(v2Start.y + (v2Pickup.y - v2Start.y) * t)
            }
          });
        } else {
          // Phase 2: Move to destination (steps 11-20)
          const t = (step - 10) / 10;
          setVehiclePositions({
            vehicle_1: {
              x: Math.round(v1Pickup.x + (v1Dest.x - v1Pickup.x) * t),
              y: Math.round(v1Pickup.y + (v1Dest.y - v1Pickup.y) * t)
            },
            vehicle_2: {
              x: Math.round(v2Pickup.x + (v2Dest.x - v2Pickup.x) * t),
              y: Math.round(v2Pickup.y + (v2Dest.y - v2Pickup.y) * t)
            }
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isAnimating, animationStep]);

  // Timeline playback effect
  useEffect(() => {
    if (!isPlayingTimeline || timelineFrames.length < 2) {
      setIsPlayingTimeline(false);
      return;
    }
    
    const timer = setInterval(() => {
      setCurrentFrame(prev => {
        const nextFrame = prev + 1;
        if (nextFrame >= timelineFrames.length) {
          setIsPlayingTimeline(false);
          return prev;
        }
        
        // Detect changed non-location attributes
        const prevTests = timelineFrames[prev];
        const nextTests = timelineFrames[nextFrame];
        const changed = new Set<string>();
        
        nextTests.forEach(test => {
          if (!isLocationAttribute(test.attribute)) {
            const prevTest = prevTests.find(t => t.stakeholder === test.stakeholder && t.attribute === test.attribute);
            if (!prevTest || prevTest.value !== test.value || prevTest.value2 !== test.value2) {
              changed.add(`${test.stakeholder}-${test.attribute}`);
            }
          }
        });
        
        // Also check for removed attributes
        prevTests.forEach(test => {
          if (!isLocationAttribute(test.attribute)) {
            const nextTest = nextTests.find(t => t.stakeholder === test.stakeholder && t.attribute === test.attribute);
            if (!nextTest) {
              changed.add(`${test.stakeholder}-${test.attribute}`);
            }
          }
        });
        
        setChangedAttributes(changed);
        setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[nextFrame])));
        
        // Clear highlights after a delay
        setTimeout(() => setChangedAttributes(new Set()), 800);
        
        return nextFrame;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPlayingTimeline, timelineFrames]);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: '0', fontSize: '14px', color: '#000000' }}>
              Rideshare Simulation
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
              <span style={{ color: !isExploratoryMode ? '#007bff' : '#999' }}>Testing</span>
              <button
                onClick={() => {
                  if (hasReceivedLLMMessage) {
                    const newMode = !isExploratoryMode;
                    setIsExploratoryMode(newMode);
                    if (!newMode) {
                      // Reset testing state when leaving explore mode
                      setHasBegunTesting(false);
                    }
                  }
                }}
                disabled={!hasReceivedLLMMessage}
                style={{
                  width: '28px',
                  height: '14px',
                  borderRadius: '7px',
                  border: '1px solid #ccc',
                  backgroundColor: isExploratoryMode ? '#007bff' : '#e0e0e0',
                  cursor: hasReceivedLLMMessage ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  padding: 0,
                  opacity: hasReceivedLLMMessage ? 1 : 0.5
                }}
              >
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  position: 'absolute',
                  top: '1px',
                  left: isExploratoryMode ? '15px' : '1px',
                  transition: 'left 0.2s'
                }} />
              </button>
              <span style={{ color: isExploratoryMode ? '#007bff' : '#999' }}>Exploratory</span>
            </div>
          </div>
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(25, 1fr)', 
              gridTemplateRows: 'repeat(25, 1fr)',
              gap: '0px',
              width: 'fit-content',
              backgroundColor: '#f9f9f9',
              position: 'relative',
              cursor: isExploratoryMode && draggingEntity ? 'grabbing' : 'default'
            }}
            onMouseMove={(e) => {
              if (!isExploratoryMode || !draggingEntity) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.floor((e.clientX - rect.left) / 15);
              const y = Math.floor((e.clientY - rect.top) / 15);
              if (x >= 0 && x < 25 && y >= 0 && y < 25) {
                // Find the attribute to update based on dragging entity
                const [stakeholder, type] = draggingEntity.split('|');
                const attrName = type === 'dest' ? 'destination' : 
                  stakeholder.startsWith('vehicle') ? 'car_current_location' : 'pickup_location';
                setInteractionTests(prev => prev.map(t => 
                  t.stakeholder === stakeholder && t.attribute === attrName
                    ? { ...t, value: `${x},${y}` }
                    : t
                ));
              }
            }}
            onMouseUp={() => setDraggingEntity(null)}
            onMouseLeave={() => setDraggingEntity(null)}
          >
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
              const entityKey = `${entity.stakeholder}|${entity.isDestination ? 'dest' : 'main'}`;
              
              return (
                <React.Fragment key={entityKey}>
                  <img 
                    src={icon} 
                    alt={entity.stakeholder} 
                    style={{ 
                      position: 'absolute',
                      width: '20px',
                      height: '20px',
                      ...position,
                      filter,
                      opacity: iconOpacity,
                      cursor: isExploratoryMode ? 'grab' : 'default'
                    }}
                    onMouseDown={(e) => {
                      if (isExploratoryMode) {
                        e.preventDefault();
                        setDraggingEntity(entityKey);
                      }
                    }}
                  />
                  <div 
                    style={{
                      position: 'absolute',
                      top: `calc(${position.top} + 22px)`,
                      left: `calc(${position.left} - 10px)`,
                      fontSize: '9px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      padding: '2px 4px',
                      border: `1px solid ${borderColor}`,
                      whiteSpace: 'nowrap',
                      maxWidth: '80px',
                      opacity: labelOpacity,
                      cursor: isExploratoryMode ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (isExploratoryMode) {
                        setEditingEntity({ stakeholder: entity.stakeholder, isDestination: entity.isDestination });
                      }
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{label}{labelSuffix}</div>
                    <div>({entity.location})</div>
                    {entity.callouts.map((callout, i) => {
                      const isChanged = changedAttributes.has(`${entity.stakeholder}-${callout.attr}`);
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            fontSize: '8px', 
                            color: isChanged ? '#fff' : '#666',
                            backgroundColor: isChanged ? '#ff9800' : 'transparent',
                            padding: isChanged ? '1px 3px' : '0',
                            fontWeight: isChanged ? 'bold' : 'normal',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {callout.text}
                        </div>
                      );
                    })}
                    {isExploratoryMode && (
                      <div style={{ fontSize: '7px', color: '#007bff', marginTop: '2px' }}>✏️ click to edit</div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            {getSimulationEntities().filter(e => e.location).length === 0 && !isAnimating && (
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
            {isAnimating && (
              <div style={{
                position: 'absolute',
                bottom: '5px',
                left: '5px',
                fontSize: '10px',
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: '4px 8px',
                border: '1px solid #007bff',
                color: '#007bff'
              }}>
                {animationStep <= 10 ? '🚗 Vehicles moving to pickups...' : '🚗 Driving to destinations...'}
              </div>
            )}
          </div>
          
          {/* Timeline Frames - only show in exploratory mode after testing begun */}
          {isExploratoryMode && hasBegunTesting && (
            <div style={{ marginTop: '10px', padding: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Timeline Frames</span>
                  {isPlayingTimeline && (
                    <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 'bold' }}>
                      ▶ Playing... ({currentFrame + 1}/{timelineFrames.length})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!hypothesisFields.whatToTest) {
                      alert('Please fill in "What are you testing?" first');
                      return;
                    }
                    const newFrame = JSON.parse(JSON.stringify(interactionTests));
                    setTimelineFrames(prev => [...prev, newFrame]);
                    setCurrentFrame(timelineFrames.length);
                  }}
                  disabled={isPlayingTimeline || !hypothesisFields.whatToTest}
                  style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #007bff', backgroundColor: (isPlayingTimeline || !hypothesisFields.whatToTest) ? '#ccc' : '#007bff', color: 'white', cursor: (isPlayingTimeline || !hypothesisFields.whatToTest) ? 'not-allowed' : 'pointer' }}
                  title={!hypothesisFields.whatToTest ? 'Fill in hypothesis first' : ''}
                >
                  + Save Frame
                </button>
              </div>
              
              {timelineFrames.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {timelineFrames.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentFrame(idx);
                          setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[idx])));
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '10px',
                          border: currentFrame === idx ? '2px solid #007bff' : '1px solid #ccc',
                          backgroundColor: currentFrame === idx ? '#e3f2fd' : 'white',
                          cursor: 'pointer',
                          fontWeight: currentFrame === idx ? 'bold' : 'normal'
                        }}
                      >
                        Frame {idx + 1}
                      </button>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        if (currentFrame > 0) {
                          const newFrame = currentFrame - 1;
                          setCurrentFrame(newFrame);
                          setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[newFrame])));
                        }
                      }}
                      disabled={currentFrame === 0 || isPlayingTimeline}
                      style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', backgroundColor: 'white', cursor: currentFrame > 0 && !isPlayingTimeline ? 'pointer' : 'not-allowed', opacity: currentFrame > 0 && !isPlayingTimeline ? 1 : 0.5 }}
                    >
                      ◀
                    </button>
                    
                    {/* Play/Pause Button */}
                    <button
                      onClick={() => {
                        if (isPlayingTimeline) {
                          setIsPlayingTimeline(false);
                        } else {
                          // Start from beginning if at end
                          if (currentFrame >= timelineFrames.length - 1) {
                            setCurrentFrame(0);
                            setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[0])));
                          }
                          setIsPlayingTimeline(true);
                        }
                      }}
                      disabled={timelineFrames.length < 2}
                      style={{ 
                        padding: '4px 12px', 
                        fontSize: '12px', 
                        border: isPlayingTimeline ? '2px solid #4caf50' : '1px solid #4caf50', 
                        backgroundColor: isPlayingTimeline ? '#4caf50' : 'white', 
                        color: isPlayingTimeline ? 'white' : '#4caf50',
                        cursor: timelineFrames.length >= 2 ? 'pointer' : 'not-allowed',
                        opacity: timelineFrames.length >= 2 ? 1 : 0.5,
                        fontWeight: 'bold'
                      }}
                    >
                      {isPlayingTimeline ? '⏸' : '▶️'}
                    </button>
                    
                    <input
                      type="range"
                      min="0"
                      max={timelineFrames.length - 1}
                      value={currentFrame}
                      onChange={(e) => {
                        if (isPlayingTimeline) return;
                        const idx = parseInt(e.target.value);
                        setCurrentFrame(idx);
                        setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[idx])));
                      }}
                      disabled={isPlayingTimeline}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        if (currentFrame < timelineFrames.length - 1) {
                          const newFrame = currentFrame + 1;
                          setCurrentFrame(newFrame);
                          setInteractionTests(JSON.parse(JSON.stringify(timelineFrames[newFrame])));
                        }
                      }}
                      disabled={currentFrame >= timelineFrames.length - 1 || isPlayingTimeline}
                      style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', backgroundColor: 'white', cursor: currentFrame < timelineFrames.length - 1 && !isPlayingTimeline ? 'pointer' : 'not-allowed', opacity: currentFrame < timelineFrames.length - 1 && !isPlayingTimeline ? 1 : 0.5 }}
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => {
                        setTimelineFrames(prev => prev.filter((_, i) => i !== currentFrame));
                        if (currentFrame > 0) setCurrentFrame(currentFrame - 1);
                      }}
                      disabled={isPlayingTimeline}
                      style={{ padding: '4px 8px', fontSize: '10px', border: '1px solid #d32f2f', backgroundColor: 'white', color: '#d32f2f', cursor: isPlayingTimeline ? 'not-allowed' : 'pointer', opacity: isPlayingTimeline ? 0.5 : 1 }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>
                  No frames saved. Click "Save Frame" to capture the current state.
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
      <div className="container container-2" style={{ position: 'relative' }}>
        <div style={{ padding: '10px 10px 10px 0' }}>
          <h3 style={{ marginTop: '0', marginBottom: '8px', fontSize: '13px', color: '#000000' }}>
            {hasReceivedLLMMessage ? "Student's Test Case" : "Select Test Attributes"}
          </h3>
          
          {/* Before: Editable pairs / After: Read-only table */}
          {!hasReceivedLLMMessage ? (
            // BEFORE clicking button - editable stakeholder/attribute selection
            <div>
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
                
                return (
                  <div key={test.id} style={{ 
                    marginBottom: '4px',
                    padding: '6px',
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center'
                  }}>
                    <img src={iconSrc} alt="" style={{ width: '20px', height: '20px', filter: filterMap[color], opacity: test.stakeholder ? 1 : 0.3 }} />
                    
                    <select
                      value={test.stakeholder}
                      onChange={(e) => setInteractionTests(interactionTests.map(t => 
                        t.id === test.id ? { ...t, stakeholder: e.target.value } : t
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
                        t.id === test.id ? { ...t, attribute: e.target.value } : t
                      ))}
                      style={{ width: '100px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                    >
                      <option value="">-- attribute --</option>
                      <optgroup label="Coordinates">
                        <option value="pickup_location">pickup_location</option>
                        <option value="destination">destination</option>
                        <option value="car_current_location">car_current_loc</option>
                      </optgroup>
                      <optgroup label="Time">
                        <option value="request_time">request_time</option>
                      </optgroup>
                    </select>
                    
                    <button
                      onClick={() => setInteractionTests(interactionTests.filter(t => t.id !== test.id))}
                      style={{ padding: '2px 5px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#d32f2f' }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              
              {interactionTests.length < 12 && (
                <button
                  onClick={() => {
                    const newId = interactionTests.length > 0 ? Math.max(...interactionTests.map(t => t.id)) + 1 : 1;
                    setInteractionTests([...interactionTests, { id: newId, stakeholder: '', attribute: '', value: '', value2: '', error: '' }]);
                  }}
                  style={{ width: '100%', padding: '6px', fontSize: '10px', border: '2px dashed #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#666', marginTop: '4px' }}
                >
                  + Add Attribute
                </button>
              )}
            </div>
          ) : (
            // AFTER clicking button - read-only table with student's values
            <div style={{ 
              border: '1px solid #e0e0e0', 
              backgroundColor: '#f9f9f9', 
              padding: '10px',
              fontSize: '11px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#e3f2fd' }}>
                    <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>Entity</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>Attribute</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {interactionTests.filter(t => t.stakeholder && t.attribute).map((test) => (
                    <tr key={test.id}>
                      <td style={{ padding: '3px 6px', border: '1px solid #ddd' }}>
                        {test.stakeholder.replace('_', ' ').replace('rider', 'R').replace('vehicle', 'V')}
                      </td>
                      <td style={{ padding: '3px 6px', border: '1px solid #ddd' }}>{test.attribute}</td>
                      <td style={{ padding: '3px 6px', border: '1px solid #ddd', fontFamily: 'monospace' }}>
                        {isLocationAttribute(test.attribute) ? `(${test.value})` : 
                         isTimeAttribute(test.attribute) ? `T+${test.value}` : test.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Explore Mode: Begin Testing button OR Hypothesis fields */}
          {isExploratoryMode && !hasBegunTesting && (
            <button
              onClick={() => setShowExplorePopup(true)}
              style={{
                width: '100%',
                marginTop: '15px',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 'bold',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              🔬 Begin Testing
            </button>
          )}
          
          {isExploratoryMode && hasBegunTesting && (
            <div style={{ marginTop: '15px', padding: '12px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#333' }}>
                📝 Test Hypothesis {currentTestId !== null ? `(Test ${currentTestId + 1})` : '(New Test)'}
              </h4>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '3px' }}>
                  What are you testing?
                </label>
                <input
                  type="text"
                  value={hypothesisFields.whatToTest}
                  onChange={(e) => setHypothesisFields(prev => ({ ...prev, whatToTest: e.target.value }))}
                  placeholder="e.g., What happens when two riders are equidistant"
                  style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '3px' }}>
                  How will this break the system?
                </label>
                <input
                  type="text"
                  value={hypothesisFields.howToBreak}
                  onChange={(e) => setHypothesisFields(prev => ({ ...prev, howToBreak: e.target.value }))}
                  placeholder="e.g., Algorithm might not handle ties correctly"
                  style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '3px' }}>
                  Expected output / behavior:
                </label>
                <input
                  type="text"
                  value={hypothesisFields.expectedOutput}
                  onChange={(e) => setHypothesisFields(prev => ({ ...prev, expectedOutput: e.target.value }))}
                  placeholder="e.g., Should assign based on request time, not distance"
                  style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => {
                    // Save as new test
                    const newTest: SavedTest = {
                      id: savedTests.length,
                      name: hypothesisFields.whatToTest || `Test ${savedTests.length + 1}`,
                      whatToTest: hypothesisFields.whatToTest,
                      howToBreak: hypothesisFields.howToBreak,
                      expectedOutput: hypothesisFields.expectedOutput,
                      frames: [...timelineFrames]
                    };
                    setSavedTests(prev => [...prev, newTest]);
                    setCurrentTestId(savedTests.length);
                    // Reset for new test
                    setHypothesisFields({ whatToTest: '', howToBreak: '', expectedOutput: '' });
                    setTimelineFrames([]);
                    setCurrentFrame(0);
                  }}
                  disabled={!hypothesisFields.whatToTest}
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    border: '1px solid #4caf50',
                    backgroundColor: hypothesisFields.whatToTest ? '#4caf50' : '#ccc',
                    color: 'white',
                    cursor: hypothesisFields.whatToTest ? 'pointer' : 'not-allowed'
                  }}
                >
                  💾 Save Test
                </button>
                {currentTestId !== null && (
                  <button
                    onClick={() => {
                      // Update existing test
                      setSavedTests(prev => prev.map(t => 
                        t.id === currentTestId 
                          ? { ...t, ...hypothesisFields, frames: [...timelineFrames] }
                          : t
                      ));
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '11px',
                      border: '1px solid #007bff',
                      backgroundColor: '#007bff',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Update Test
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Saved Tests List */}
          {isExploratoryMode && hasBegunTesting && savedTests.length > 0 && (
            <div style={{ marginTop: '10px', padding: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>Saved Tests:</div>
              {savedTests.map((test, idx) => (
                <div 
                  key={test.id}
                  onClick={() => {
                    setCurrentTestId(test.id);
                    setHypothesisFields({
                      whatToTest: test.whatToTest,
                      howToBreak: test.howToBreak,
                      expectedOutput: test.expectedOutput
                    });
                    setTimelineFrames(test.frames);
                    setCurrentFrame(0);
                    if (test.frames.length > 0) {
                      setInteractionTests(JSON.parse(JSON.stringify(test.frames[0])));
                    }
                  }}
                  style={{
                    padding: '6px 8px',
                    marginBottom: '4px',
                    fontSize: '10px',
                    border: currentTestId === test.id ? '2px solid #007bff' : '1px solid #ddd',
                    backgroundColor: currentTestId === test.id ? '#e3f2fd' : '#fafafa',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Test {idx + 1}: {test.name}</div>
                  <div style={{ color: '#666' }}>{test.frames.length} frames</div>
                </div>
              ))}
            </div>
          )}
            

          {/* Begin Helping Student Button */}
          <button
            onClick={() => {
              // Set "business as usual" values - no edge cases
              const testData = [
                { stakeholder: 'rider_1', attribute: 'request_time', value: '0' },
                { stakeholder: 'rider_1', attribute: 'pickup_location', value: '5,5' },
                { stakeholder: 'rider_1', attribute: 'destination', value: '15,15' },
                { stakeholder: 'rider_2', attribute: 'request_time', value: '2' },
                { stakeholder: 'rider_2', attribute: 'pickup_location', value: '10,10' },
                { stakeholder: 'rider_2', attribute: 'destination', value: '20,20' },
                { stakeholder: 'vehicle_1', attribute: 'car_current_location', value: '3,3' },
                { stakeholder: 'vehicle_2', attribute: 'car_current_location', value: '12,12' }
              ];
              
              setInteractionTests(testData.map((t, i) => ({
                id: i + 1,
                stakeholder: t.stakeholder,
                attribute: t.attribute,
                value: t.value,
                value2: '',
                error: ''
              })));
              
              // Start animation
              setAnimationStep(0);
              setVehiclePositions({
                vehicle_1: { x: 3, y: 3 },
                vehicle_2: { x: 12, y: 12 }
              });
              setIsAnimating(true);
              
              // Add student messages
              setChatMessages([
                {
                  id: Date.now(),
                  role: 'assistant',
                  content: "Hey! I ran my rideshare matching algorithm with these test values. Let me show you what I tested:"
                },
                {
                  id: Date.now() + 1,
                  role: 'assistant',
                  content: '',
                  isTestScenario: true,
                  testData: {
                    pairs: testData,
                    result: 'R1 → V1, R2 → V2 (Tests pass ✓)'
                  }
                },
                {
                  id: Date.now() + 2,
                  role: 'assistant',
                  content: "Everything looks good - R1 gets assigned to V1 since it's closer, and R2 gets V2. The tests pass! But the autograder says there's still a bug somewhere. Can you help me figure out what edge cases I might be missing?"
                }
              ]);
              setHasReceivedLLMMessage(true);
            }}
            disabled={hasReceivedLLMMessage}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '1px solid #ccc',
              backgroundColor: hasReceivedLLMMessage ? '#ccc' : '#007bff',
              color: 'white',
              cursor: hasReceivedLLMMessage ? 'not-allowed' : 'pointer',
              display: isExploratoryMode ? 'none' : 'block'
            }}
          >
            BEGIN HELPING STUDENT
          </button>

          {/* Test Student Code Button - appears after first message, hidden in explore mode */}
          {hasReceivedLLMMessage && !isExploratoryMode && (
            <button
              onClick={() => setShowBugPopup(true)}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '1px solid #4caf50',
                backgroundColor: '#4caf50',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              TEST STUDENT CODE
            </button>
          )}
          
          {/* Saved Tests Summary - show in teaching mode when tests exist */}
          {!isExploratoryMode && savedTests.length > 0 && (
            <div style={{ marginTop: '15px', padding: '10px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                📚 Your Test Cases ({savedTests.length})
              </div>
              {savedTests.map((test, idx) => (
                <div 
                  key={test.id}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    fontSize: '10px',
                    border: '1px solid #ddd',
                    backgroundColor: 'white'
                  }}
                >
                  <div style={{ fontWeight: 'bold', color: '#1565c0' }}>Test {idx + 1}: {test.name}</div>
                  <div style={{ color: '#666', marginTop: '2px' }}>{test.howToBreak}</div>
                  <div style={{ color: '#999', fontSize: '9px', marginTop: '2px' }}>{test.frames.length} frames</div>
                </div>
              ))}
              <div style={{ fontSize: '10px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
                Use the chat to send tests to the student →
              </div>
            </div>
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
          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '20px' }}>
              Click "BEGIN HELPING STUDENT" to start
            </div>
          )}
          {chatMessages.map(msg => {
            // Special rendering for test scenario
            if (msg.isTestScenario && msg.testData) {
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f0f7ff',
                    border: `1px solid ${msg.role === 'user' ? '#2196f3' : '#007bff'}`,
                    padding: '12px',
                    maxWidth: '90%',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: msg.role === 'user' ? '#1565c0' : '#007bff' }}>
                    {msg.role === 'user' ? '🧪 Your Test Case' : '📋 Test Scenario'}
                    {msg.testData.testName && <span style={{ fontWeight: 'normal' }}> - {msg.testData.testName}</span>}
                  </div>
                  {msg.testData.hypothesis && (
                    <div style={{ marginBottom: '8px', padding: '6px', backgroundColor: '#fff3e0', border: '1px solid #ffcc80', fontSize: '10px' }}>
                      <strong>Testing:</strong> {msg.testData.hypothesis}
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e3f2fd' }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ccc' }}>Entity</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ccc' }}>Attribute</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left', border: '1px solid #ccc' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {msg.testData.pairs.map((p: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>
                            {p.stakeholder.replace('_', ' ').replace('rider', 'R').replace('vehicle', 'V')}
                          </td>
                          <td style={{ padding: '3px 6px', border: '1px solid #ccc' }}>{p.attribute}</td>
                          <td style={{ padding: '3px 6px', border: '1px solid #ccc', fontFamily: 'monospace' }}>
                            {p.attribute.includes('location') || p.attribute === 'destination' ? `(${p.value})` : 
                             p.attribute.includes('time') ? `T+${p.value}` : p.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {msg.testData.result && (
                    <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', fontSize: '10px' }}>
                      <strong>Result:</strong> {msg.testData.result}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#007bff' : 'white',
                  color: msg.role === 'user' ? 'white' : '#000',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  maxWidth: '85%',
                  fontSize: '12px',
                  border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none'
                }}
              >
                {msg.content}
              </div>
            );
          })}
        </div>
        
        {/* Send Test UI - appears in teaching mode when tests exist */}
        {!isExploratoryMode && savedTests.length > 0 && (
          <div style={{ 
            padding: '10px', 
            borderTop: '1px solid #e0e0e0', 
            backgroundColor: 'white'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
              📤 Send Test to Student
            </div>
            
            {/* Test Selection */}
            <div style={{ marginBottom: '8px' }}>
              <select
                value={selectedTestToSend ?? ''}
                onChange={(e) => setSelectedTestToSend(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', padding: '6px', fontSize: '11px', border: '1px solid #ccc' }}
              >
                <option value="">-- Select a test to send --</option>
                {savedTests.map((test, idx) => (
                  <option key={test.id} value={test.id}>
                    Test {idx + 1}: {test.name} ({test.frames.length} frames)
                  </option>
                ))}
              </select>
            </div>
            
            {/* Preview selected test */}
            {selectedTestToSend !== null && (
              <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', fontSize: '10px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {savedTests.find(t => t.id === selectedTestToSend)?.whatToTest}
                </div>
                <div style={{ color: '#666' }}>
                  <strong>How it breaks:</strong> {savedTests.find(t => t.id === selectedTestToSend)?.howToBreak}
                </div>
                <div style={{ color: '#666' }}>
                  <strong>Expected:</strong> {savedTests.find(t => t.id === selectedTestToSend)?.expectedOutput}
                </div>
              </div>
            )}
            
            {/* Explanation input */}
            <div style={{ marginBottom: '8px' }}>
              <textarea
                value={testExplanation}
                onChange={(e) => setTestExplanation(e.target.value)}
                placeholder="Write your explanation for the student... Why should they try this test? What should they notice?"
                style={{ 
                  width: '100%', 
                  padding: '8px', 
                  fontSize: '11px', 
                  border: '1px solid #ccc',
                  minHeight: '60px',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            {/* Send button */}
            <button
              onClick={() => {
                if (selectedTestToSend === null) return;
                const test = savedTests.find(t => t.id === selectedTestToSend);
                if (!test || test.frames.length === 0) return;
                
                // Get the last frame's test values
                const lastFrame = test.frames[test.frames.length - 1];
                const pairs = lastFrame.map(t => ({
                  stakeholder: t.stakeholder,
                  attribute: t.attribute,
                  value: t.value
                })).filter(p => p.stakeholder && p.attribute && p.value);
                
                // Add user message with explanation
                if (testExplanation.trim()) {
                  setChatMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'user',
                    content: testExplanation.trim()
                  }]);
                }
                
                // Add test scenario message
                setChatMessages(prev => [...prev, {
                  id: Date.now() + 1,
                  role: 'user',
                  content: '',
                  isTestScenario: true,
                  testData: {
                    testName: test.name,
                    hypothesis: test.whatToTest,
                    pairs: pairs
                  }
                }]);
                
                // Add simulated student response
                setTimeout(() => {
                  setChatMessages(prev => [...prev, {
                    id: Date.now() + 2,
                    role: 'assistant',
                    content: "Oh interesting! Let me run this test case... 🤔"
                  }]);
                }, 500);
                
                // Reset
                setSelectedTestToSend(null);
                setTestExplanation('');
              }}
              disabled={selectedTestToSend === null}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: 'none',
                backgroundColor: selectedTestToSend !== null ? '#4caf50' : '#ccc',
                color: 'white',
                cursor: selectedTestToSend !== null ? 'pointer' : 'not-allowed'
              }}
            >
              📨 Send Test to Student
            </button>
          </div>
        )}
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

      {/* Bug Found Popup */}
      {showBugPopup && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '25px',
              width: '450px',
              border: '2px solid #ff9800',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#e65100' }}>
              Bug Detected!
            </h3>
            <p style={{ fontSize: '14px', color: '#333', marginBottom: '20px', lineHeight: '1.6' }}>
              The autograder found a bug in the student's code, but these test values don't expose it.
            </p>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '25px' }}>
              <strong>Your task:</strong> Help the student find edge cases that will reveal the hidden bug. 
              Try modifying the test values to explore different scenarios.
            </p>
            <div style={{ 
              backgroundColor: '#fff3e0', 
              padding: '12px', 
              marginBottom: '20px',
              border: '1px solid #ffcc80',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <strong>💡 Hint:</strong> Think about what happens when entities are positioned in unusual ways, 
              or when timing creates conflicts between riders.
            </div>
            <button
              onClick={() => {
                setShowBugPopup(false);
                setIsExploratoryMode(true);
              }}
              style={{
                padding: '12px 30px',
                fontSize: '14px',
                border: 'none',
                backgroundColor: '#ff9800',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Start Exploring
            </button>
          </div>
        </div>
      )}

      {/* Explore Mode Intro Popup */}
      {showExplorePopup && (
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
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '25px',
              width: '480px',
              border: '2px solid #007bff'
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#007bff', textAlign: 'center' }}>
              🔬 Begin Testing
            </h3>
            <p style={{ fontSize: '13px', color: '#333', marginBottom: '15px', lineHeight: '1.6' }}>
              Create test cases to find edge cases that expose the bug!
            </p>
            <div style={{ backgroundColor: '#e3f2fd', padding: '12px', marginBottom: '15px', fontSize: '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>📝 Step 1:</strong> Write your hypothesis - what you're testing, how it might break, and expected output.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>🖱️ Step 2:</strong> Drag entities and click callouts to modify test values.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>🎬 Step 3:</strong> Save frames to capture different states of your test.
              </div>
              <div>
                <strong>💾 Step 4:</strong> Save your test, then create more tests to explore different scenarios.
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
              Each test can contain multiple frames. Play through frames to see how your test scenario evolves.
            </p>
            <button
              onClick={() => {
                setShowExplorePopup(false);
                setHasBegunTesting(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Start Creating Tests
            </button>
          </div>
        </div>
      )}

      {/* Entity Editor Popup */}
      {editingEntity && (
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
          onClick={() => setEditingEntity(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              width: '400px',
              border: '1px solid #ccc'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              Edit {editingEntity.stakeholder.replace('_', ' ').replace('rider', 'Rider ').replace('vehicle', 'Vehicle ')}
              {editingEntity.isDestination ? ' (Destination)' : ''}
            </h3>
            
            {/* Existing attributes for this entity */}
            <div style={{ marginBottom: '15px', maxHeight: '250px', overflowY: 'auto' }}>
              {interactionTests
                .filter(t => t.stakeholder === editingEntity.stakeholder)
                .map((test) => (
                  <div key={test.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ width: '90px', fontSize: '10px', color: '#666' }}>{test.attribute}:</span>
                    
                    {/* Structured input based on attribute type */}
                    {isLocationAttribute(test.attribute) && test.attribute !== 'end_early' ? (
                      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                        <input
                          type="number"
                          value={test.value.split(',')[0] || ''}
                          onChange={(e) => {
                            const y = test.value.split(',')[1] || '0';
                            setInteractionTests(prev => prev.map(t => 
                              t.id === test.id ? { ...t, value: `${e.target.value},${y}` } : t
                            ));
                          }}
                          style={{ width: '45px', padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                          placeholder="x"
                          min="0" max="24"
                        />
                        <span style={{ fontSize: '10px', color: '#999' }}>,</span>
                        <input
                          type="number"
                          value={test.value.split(',')[1] || ''}
                          onChange={(e) => {
                            const x = test.value.split(',')[0] || '0';
                            setInteractionTests(prev => prev.map(t => 
                              t.id === test.id ? { ...t, value: `${x},${e.target.value}` } : t
                            ));
                          }}
                          style={{ width: '45px', padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                          placeholder="y"
                          min="0" max="24"
                        />
                      </div>
                    ) : isTimeAttribute(test.attribute) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
                        <span style={{ fontSize: '10px', color: '#666' }}>T+</span>
                        <input
                          type="number"
                          value={test.value}
                          onChange={(e) => setInteractionTests(prev => prev.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value } : t
                          ))}
                          style={{ width: '50px', padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    ) : isBinaryAttribute(test.attribute) && test.attribute !== 'assigned' && test.attribute !== 'end_early' ? (
                      <select
                        value={test.value}
                        onChange={(e) => setInteractionTests(prev => prev.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value } : t
                        ))}
                        style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                      >
                        <option value="">--</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : test.attribute === 'assigned' ? (
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        <select
                          value={test.value}
                          onChange={(e) => setInteractionTests(prev => prev.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value } : t
                          ))}
                          style={{ width: '55px', padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                        >
                          <option value="">--</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                        {test.value === 'true' && (
                          <select
                            value={test.value2}
                            onChange={(e) => setInteractionTests(prev => prev.map(t => 
                              t.id === test.id ? { ...t, value2: e.target.value } : t
                            ))}
                            style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                          >
                            <option value="">-- rider --</option>
                            <option value="rider_1">rider_1</option>
                            <option value="rider_2">rider_2</option>
                            <option value="rider_3">rider_3</option>
                          </select>
                        )}
                      </div>
                    ) : test.attribute === 'end_early' ? (
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        <select
                          value={test.value}
                          onChange={(e) => setInteractionTests(prev => prev.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value } : t
                          ))}
                          style={{ width: '55px', padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                        >
                          <option value="">--</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                        {test.value === 'true' && (
                          <div style={{ display: 'flex', gap: '2px' }}>
                            <input type="number" value={test.value2.split(',')[0] || ''} onChange={(e) => {
                              const y = test.value2.split(',')[1] || '0';
                              setInteractionTests(prev => prev.map(t => t.id === test.id ? { ...t, value2: `${e.target.value},${y}` } : t));
                            }} style={{ width: '35px', padding: '3px', fontSize: '10px', border: '1px solid #ccc' }} placeholder="x" />
                            <span style={{ fontSize: '10px' }}>,</span>
                            <input type="number" value={test.value2.split(',')[1] || ''} onChange={(e) => {
                              const x = test.value2.split(',')[0] || '0';
                              setInteractionTests(prev => prev.map(t => t.id === test.id ? { ...t, value2: `${x},${e.target.value}` } : t));
                            }} style={{ width: '35px', padding: '3px', fontSize: '10px', border: '1px solid #ccc' }} placeholder="y" />
                          </div>
                        )}
                      </div>
                    ) : test.attribute === 'battery' ? (
                      <input
                        type="number"
                        value={test.value}
                        onChange={(e) => setInteractionTests(prev => prev.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value } : t
                        ))}
                        style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                        placeholder="0-100"
                        min="0" max="100"
                      />
                    ) : (
                      <input
                        type="text"
                        value={test.value}
                        onChange={(e) => setInteractionTests(prev => prev.map(t => 
                          t.id === test.id ? { ...t, value: e.target.value } : t
                        ))}
                        style={{ flex: 1, padding: '3px', fontSize: '11px', border: '1px solid #ccc' }}
                        placeholder="value"
                      />
                    )}
                    
                    <button
                      onClick={() => setInteractionTests(prev => prev.filter(t => t.id !== test.id))}
                      style={{ padding: '2px 6px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#d32f2f' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
            
            {/* Add new attribute */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '12px', marginBottom: '15px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#666' }}>Add Attribute:</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  id="newAttrSelect"
                  style={{ flex: 1, padding: '4px', fontSize: '11px', border: '1px solid #ccc' }}
                >
                  <option value="">-- select --</option>
                  <optgroup label="Coordinates">
                    {(editingEntity.stakeholder.startsWith('rider') ? ['pickup_location', 'destination'] : ['car_current_location']).map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Time">
                    {(editingEntity.stakeholder.startsWith('rider') ? ['request_time', 'eta_vehicle', 'eta_destination'] : []).map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Boolean">
                    {(editingEntity.stakeholder.startsWith('rider') 
                      ? ['accessible', 'assigned', 'cancels', 'change_destination', 'end_early', 'traffic_delay']
                      : ['accessible', 'occupied', 'traffic_delay']
                    ).map(attr => (
                      <option key={attr} value={attr}>{attr}</option>
                    ))}
                  </optgroup>
                  {editingEntity.stakeholder.startsWith('vehicle') && (
                    <optgroup label="Numeric">
                      <option value="battery">battery</option>
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={() => {
                    const select = document.getElementById('newAttrSelect') as HTMLSelectElement;
                    const attr = select.value;
                    if (!attr) return;
                    const exists = interactionTests.some(t => t.stakeholder === editingEntity.stakeholder && t.attribute === attr);
                    if (exists) return;
                    const newId = Math.max(...interactionTests.map(t => t.id)) + 1;
                    setInteractionTests(prev => [...prev, {
                      id: newId,
                      stakeholder: editingEntity.stakeholder,
                      attribute: attr,
                      value: '',
                      value2: '',
                      error: ''
                    }]);
                    select.value = '';
                  }}
                  style={{ padding: '4px 12px', fontSize: '11px', border: '1px solid #007bff', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setEditingEntity(null)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '13px',
                border: 'none',
                backgroundColor: '#4caf50',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Intervention;
