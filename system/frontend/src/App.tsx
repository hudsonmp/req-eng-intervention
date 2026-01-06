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
    r1_request: 'T+0 min',
    r1_pickup: '(14, 12)',
    r2_request: 'T+0 min',
    r2_pickup: '(15, 15)',
    r2_destination: '(14, 12) = R1 pickup',
    car_location: '(5, 4)',
    car_assigned: 'Assigned to R1'
  });
  const [testOutput, setTestOutput] = useState('The output made sense in this case. rider_1 was assigned the car first because it was in batch one and is closer to the car, satisfying our program constraints.');
  const [testCaseA, setTestCaseA] = useState('I think the bug is that the vehicle will be matched with rider_1, but since rider_2 is within batch period and on the way, it should match with rider_2 first.');
  const [testCaseB, setTestCaseB] = useState('The bug is likely in how you calculate distances. The vehicle might be picking the rider with the shorter straight-line distance rather than considering the route.');
  const [testCaseC, setTestCaseC] = useState('I think the issue is that your batch timing isn\'t working correctly, so rider_2\'s request isn\'t being considered in the same batch as rider_1.');
  
  interface TestCase {
    id: number;
    category: string;
    attribute: string;
    value: string;
  }
  
  const [testCases, setTestCases] = useState<TestCase[]>([
    { id: 1, category: 'rider_1', attribute: 'request_time', value: 'T+0' }
  ]);

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
            gridTemplateColumns: 'repeat(20, 1fr)', 
            gridTemplateRows: 'repeat(20, 1fr)',
            gap: '0px',
            width: 'fit-content',
            backgroundColor: '#f9f9f9',
            position: 'relative'
          }}>
            {Array.from({ length: 400 }, (_, i) => (
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
            {/* Car icon with label */}
            <img 
              src="/icons/vehicle.svg" 
              alt="car" 
              style={{ 
                position: 'absolute',
                width: '20px',
                height: '20px',
                ...getIconPosition(editableValues.car_location),
                filter: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: `calc(${getIconPosition(editableValues.car_location).top} + 22px)`,
              left: `calc(${getIconPosition(editableValues.car_location).left} - 5px)`,
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 4px',
              border: '1px solid #ccc',
              whiteSpace: 'nowrap'
            }}>
              Car: {editableValues.car_location}
            </div>
            
            {/* Rider 1 icon with label */}
            <img 
              src="/icons/rider.svg" 
              alt="rider1" 
              style={{ 
                position: 'absolute',
                width: '20px',
                height: '20px',
                ...getIconPosition(editableValues.r1_pickup),
                filter: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: `calc(${getIconPosition(editableValues.r1_pickup).top} + 22px)`,
              left: `calc(${getIconPosition(editableValues.r1_pickup).left} - 10px)`,
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 4px',
              border: '1px solid #0066cc',
              whiteSpace: 'nowrap'
            }}>
              R1: {editableValues.r1_pickup}<br/>{editableValues.r1_request}
            </div>
            
            {/* Rider 2 icon with label */}
            <img 
              src="/icons/rider.svg" 
              alt="rider2" 
              style={{ 
                position: 'absolute',
                width: '20px',
                height: '20px',
                ...getIconPosition(editableValues.r2_pickup),
                filter: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: `calc(${getIconPosition(editableValues.r2_pickup).top} + 22px)`,
              left: `calc(${getIconPosition(editableValues.r2_pickup).left} - 10px)`,
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 4px',
              border: '1px solid #cc0000',
              whiteSpace: 'nowrap'
            }}>
              R2: {editableValues.r2_pickup}<br/>{editableValues.r2_request}
            </div>
          </div>
          
          {/* Input Fields Section */}
          <div style={{ marginTop: '15px', marginRight: '20px' }}>
            <div style={{ padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <h4 style={{ marginTop: '0', marginBottom: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                Stakeholder-Attribute-Value Pairs:
              </h4>
              <div style={{ fontSize: '11px', marginBottom: '10px', lineHeight: '1.5' }}>
                <div>• rider_1: request_time = T+0</div>
                <div>• rider_2: request_time = T+4</div>
                <div>• rider_1: pickup_location = (15, 15)</div>
                <div>• rider_2: pickup_location = (14, 12)</div>
                <div>• rider_2: destination = (15, 15)</div>
                <div>• vehicle_current_location = (5, 4)</div>
              </div>
            
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
            Select stakeholder-attribute pairs
          </h3>
          
          {/* Mock selection 1: rider_1 request_time */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <img 
                src="/icons/rider.svg" 
                alt="icon" 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  filter: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
                }} 
              />
              <div style={{ maxWidth: '200px' }}>
                <div style={{ 
                  padding: '4px 6px', 
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                  color: '#000000'
                }}>
                  Rider 1
                </div>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                    Attribute:
                  </label>
                  <div style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '13px',
                    border: '1px solid #ccc',
                    backgroundColor: '#f0f0f0',
                    color: '#000000'
                  }}>
                    request_time
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mock selection 2: rider_1 pickup_location */}
          <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <img 
                src="/icons/rider.svg" 
                    alt="icon" 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                  filter: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
                    }} 
                  />
                <div style={{ maxWidth: '200px' }}>
                <div style={{ 
                      padding: '4px 6px', 
                      fontSize: '13px',
                      border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                      color: '#000000'
                }}>
                  Rider 1
                </div>
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                        Attribute:
                      </label>
                  <div style={{
                          flex: 1,
                          padding: '4px 6px',
                          fontSize: '13px',
                          border: '1px solid #ccc',
                    backgroundColor: '#f0f0f0',
                          color: '#000000'
                  }}>
                    pickup_location
                    </div>
                </div>
              </div>
            </div>
                </div>
                
          {/* Mock selection 3: rider_2 pickup_location */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <img 
                src="/icons/rider.svg" 
                alt="icon" 
                    style={{
                  width: '40px', 
                  height: '40px', 
                  filter: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)'
                }} 
              />
              <div style={{ maxWidth: '200px' }}>
                <div style={{ 
                  padding: '4px 6px', 
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                  color: '#000000'
                }}>
                  Rider 2
                </div>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                    Attribute:
                  </label>
                  <div style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '13px',
                      border: '1px solid #ccc',
                    backgroundColor: '#f0f0f0',
                    color: '#000000'
                  }}>
                    pickup_location
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mock selection 4: rider_2 request_time */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <img 
                src="/icons/rider.svg" 
                alt="icon" 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  filter: 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)'
                }} 
              />
              <div style={{ maxWidth: '200px' }}>
                <div style={{ 
                  padding: '4px 6px', 
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                  color: '#000000'
                }}>
                  Rider 2
                </div>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                    Attribute:
                  </label>
                  <div style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '13px',
                    border: '1px solid #ccc',
                    backgroundColor: '#f0f0f0',
                    color: '#000000'
                  }}>
                    request_time
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mock selection 5: car_1 car_cur_location */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <img 
                src="/icons/vehicle.svg" 
                alt="icon" 
                    style={{
                  width: '40px', 
                  height: '40px', 
                  filter: 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)'
                }} 
              />
              <div style={{ maxWidth: '200px' }}>
                <div style={{ 
                  padding: '4px 6px', 
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f0f0f0',
                  color: '#000000'
                }}>
                  Vehicle 1
                </div>
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                    Attribute:
                  </label>
                  <div style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '13px',
                      border: '1px solid #ccc',
                    backgroundColor: '#f0f0f0',
                    color: '#000000'
                  }}>
                    car_cur_location
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Test Case Section - moved from container-3 */}
          <div style={{ marginTop: '15px' }}>
            <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
              Select test case:
            </h3>
            
            {/* Test Case Items */}
            {testCases.map((testCase) => {
              const getIconAndColor = (category: string) => {
                if (category.startsWith('rider_1')) return { icon: '/icons/rider.svg', color: 'blue' };
                if (category.startsWith('rider_2')) return { icon: '/icons/rider.svg', color: 'red' };
                if (category.startsWith('vehicle_1')) return { icon: '/icons/vehicle.svg', color: 'blue' };
                if (category.startsWith('vehicle_2')) return { icon: '/icons/vehicle.svg', color: 'red' };
                if (category === 'system') return { icon: '/icons/system.svg', color: 'black' };
                return { icon: '/icons/rider.svg', color: 'blue' };
              };
              
              const iconData = getIconAndColor(testCase.category);
              
              return (
                <div key={testCase.id} style={{ 
                  marginBottom: '10px',
                  padding: '10px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <input 
                      type="checkbox" 
                      checked 
                      onChange={() => setTestCases(testCases.filter(tc => tc.id !== testCase.id))}
                      style={{ marginTop: '8px' }}
                    />
                    <img 
                      src={iconData.icon} 
                      alt="icon" 
                      style={{ 
                        width: '28px', 
                        height: '28px', 
                        filter: iconData.color === 'blue' ? 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)' :
                                iconData.color === 'red' ? 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)' :
                                'none'
                      }} 
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <select
                        value={testCase.category}
                        onChange={(e) => setTestCases(testCases.map(tc => 
                          tc.id === testCase.id ? { ...tc, category: e.target.value } : tc
                        ))}
                        style={{ 
                          width: '100%',
                          padding: '4px 6px', 
                          fontSize: '10px',
                          border: '1px solid #ccc',
                          backgroundColor: 'white',
                          color: '#000000',
                          marginBottom: '4px',
                          borderRadius: '4px'
                        }}
                      >
                        <option value="rider_1">Rider 1</option>
                        <option value="rider_2">Rider 2</option>
                        <option value="vehicle_1">Vehicle 1</option>
                        <option value="vehicle_2">Vehicle 2</option>
                        <option value="system">System</option>
                      </select>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>
                          Attr:
                        </label>
                        <select
                          value={testCase.attribute}
                          onChange={(e) => setTestCases(testCases.map(tc => 
                            tc.id === testCase.id ? { ...tc, attribute: e.target.value } : tc
                          ))}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            fontSize: '10px',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                            color: '#000000',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="pickup_location">pickup_location</option>
                          <option value="destination">destination</option>
                          <option value="fare">fare</option>
                          <option value="request_time">request_time</option>
                          <option value="eta_car">eta_car</option>
                          <option value="eta_destination">eta_destination</option>
                          <option value="accessible">accessible</option>
                          <option value="pickup_distance">pickup_distance</option>
                          <option value="occupied">occupied</option>
                          <option value="assigned_other">assigned_other</option>
                          <option value="car_cur_location">car_cur_location</option>
                          <option value="battery_level">battery_level</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap' }}>
                          Val:
                        </label>
                        <input
                          type="text"
                          value={testCase.value}
                          onChange={(e) => setTestCases(testCases.map(tc => 
                            tc.id === testCase.id ? { ...tc, value: e.target.value } : tc
                          ))}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            fontSize: '10px',
                            border: '1px solid #ccc',
                            backgroundColor: 'white',
                            color: '#000000',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Add New Test Case Button */}
            {testCases.length < 5 && (
              <button
                onClick={() => {
                  const newId = testCases.length > 0 ? Math.max(...testCases.map(tc => tc.id)) + 1 : 1;
                  setTestCases([...testCases, { 
                    id: newId, 
                    category: 'rider_1', 
                    attribute: 'request_time', 
                    value: '' 
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
                  borderRadius: '8px',
                  fontWeight: '500'
                }}
              >
                + Add Test Case
              </button>
            )}
          </div>

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
              First-year • CS 101 • Rideshare domain exp
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
          {/* Message 1: Student lists test cases */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0
            }}>
              👨‍💻
            </div>
            <div style={{ flex: 1, maxWidth: '80%' }}>
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'white',
                borderRadius: '10px',
                fontSize: '11px',
                lineHeight: '1.4',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                Here are my test cases:
                <br/>• rider_1: request_time = T+0, pickup_location = (14, 12)
                <br/>• rider_2: request_time = T+7, pickup_location = (15, 15)
                <br/>• car_1: car_cur_location = (5, 4)
                <br/>• batch_time = 5 mins
              </div>
            </div>
          </div>

          {/* Message 2: Student says code passed but has bug */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0
            }}>
              👨‍💻
            </div>
            <div style={{ flex: 1, maxWidth: '80%' }}>
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'white',
                borderRadius: '10px',
                fontSize: '11px',
                lineHeight: '1.4',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                My code passed all of these tests, but there's still a bug. Can you help me write a test to find the bug?
              </div>
            </div>
          </div>

          {/* Message 3: TA provides test case */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#4caf50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              flexShrink: 0,
              color: 'white',
              fontWeight: 'bold'
            }}>
              TA
            </div>
            <div style={{ flex: 1, maxWidth: '80%' }}>
              <div style={{
                padding: '8px 10px',
                backgroundColor: '#e8f5e9',
                borderRadius: '10px',
                fontSize: '11px',
                lineHeight: '1.4',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                Here is a good interaction test:
                <br/>• rider_1: request_time = T+0
                <br/>• rider_2: request_time = T+4
                <br/>• rider_1: pickup_location = (15, 15)
                <br/>• rider_2: pickup_location = (14, 12)
                <br/>• rider_2: destination = (15, 15)
                <br/>• vehicle_current_location = (5, 4)
              </div>
            </div>
          </div>

          {/* Message 4: Student asks for explanation */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              flexShrink: 0
            }}>
              👨‍💻
            </div>
            <div style={{ flex: 1, maxWidth: '80%' }}>
              <div style={{
                padding: '8px 10px',
                backgroundColor: 'white',
                borderRadius: '10px',
                fontSize: '11px',
                lineHeight: '1.4',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                Can you explain why? What do you think will happen vs. what should happen?
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#333', fontWeight: 'bold', marginTop: '5px', marginBottom: '6px' }}>
            Select a response:
          </div>

          {/* Response Text Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseA(e.currentTarget.textContent || '')}
              style={{
                padding: '8px 10px',
                fontSize: '10px',
                border: '2px solid #2196F3',
                backgroundColor: '#E3F2FD',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none',
                borderRadius: '6px',
                transition: 'border-color 0.2s'
              }}
            >
              {testCaseA}
            </div>

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseB(e.currentTarget.textContent || '')}
              style={{
                padding: '8px 10px',
                fontSize: '10px',
                border: '2px solid #e0e0e0',
                backgroundColor: 'white',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none',
                borderRadius: '6px',
                transition: 'border-color 0.2s'
              }}
            >
              {testCaseB}
            </div>

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseC(e.currentTarget.textContent || '')}
              style={{
                padding: '8px 10px',
                fontSize: '10px',
                border: '2px solid #e0e0e0',
                backgroundColor: 'white',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none',
                borderRadius: '6px',
                transition: 'border-color 0.2s'
              }}
            >
              {testCaseC}
            </div>
          </div>
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
                Selected stakeholder-attribute pairs:
              </h4>
              <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '4px' }}>• Rider 1: request_time</div>
                <div style={{ marginBottom: '4px' }}>• Rider 1: pickup_location</div>
                <div style={{ marginBottom: '4px' }}>• Rider 2: pickup_location</div>
                <div style={{ marginBottom: '4px' }}>• Rider 2: request_time</div>
                <div style={{ marginBottom: '4px' }}>• Vehicle 1: car_cur_location</div>
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
