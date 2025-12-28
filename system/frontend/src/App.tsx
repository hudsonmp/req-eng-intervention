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
  const [studentMessage, setStudentMessage] = useState('Hi! I think my code is correct, am I considering all edge cases? I tested it with:\n  • rider_1: request_time = T+0, pickup_location = (14, 12)\n  • rider_2: request_time = T+7, pickup_location = (15,15)\n  • car_1: car_cur_location = (5, 4)  • batch_time=5_mins');
  const [testCaseA, setTestCaseA] = useState('A) "Try testing with rider_1 and rider_2 requesting at the exact same time"');
  const [testCaseB, setTestCaseB] = useState('B) "You haven\'t considered the possibility of rider_2 cancelling the ride and the broader effect on the system."');
  const [testCaseC, setTestCaseC] = useState('C) "Although this passed, you haven\'t tested when both riders submit a request in the same batch and aren\'t at the same location."');
  
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
    <div className="app">
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
          
          {/* Test Values Table */}
          <div style={{ marginTop: '15px', fontSize: '12px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#000000' }}>Test Student's Code</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
              Modify the values below to test different scenarios
            </p>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              border: '1px solid #ccc'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Entity</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Attribute</th>
                  <th style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>Rider 1</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>request_time</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                    <select 
                      value={editableValues.r1_request}
                      onChange={(e) => handleValueChange('r1_request', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '12px' }}
                    >
                      <option value="T+0 min">T+0 min</option>
                      <option value="T+1 min">T+1 min</option>
                      <option value="T+2 min">T+2 min</option>
                      <option value="T+3 min">T+3 min</option>
                      <option value="T+5 min">T+5 min</option>
                      <option value="T+10 min">T+10 min</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>Rider 1</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>pickup_location</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                    <select 
                      value={editableValues.r1_pickup}
                      onChange={(e) => handleValueChange('r1_pickup', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '12px' }}
                    >
                      <option value="(5, 5)">(5, 5)</option>
                      <option value="(10, 10)">(10, 10)</option>
                      <option value="(14, 12)">(14, 12)</option>
                      <option value="(15, 15)">(15, 15)</option>
                      <option value="(18, 18)">(18, 18)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>Rider 2</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>request_time</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                    <select 
                      value={editableValues.r2_request}
                      onChange={(e) => handleValueChange('r2_request', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '12px' }}
                    >
                      <option value="T+0 min">T+0 min</option>
                      <option value="T+1 min">T+1 min</option>
                      <option value="T+2 min">T+2 min</option>
                      <option value="T+3 min">T+3 min</option>
                      <option value="T+5 min">T+5 min</option>
                      <option value="T+10 min">T+10 min</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>Rider 2</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>pickup_location</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                    <select 
                      value={editableValues.r2_pickup}
                      onChange={(e) => handleValueChange('r2_pickup', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '12px' }}
                    >
                      <option value="(5, 5)">(5, 5)</option>
                      <option value="On route (10, 8)">On route (10, 8)</option>
                      <option value="(10, 10)">(10, 10)</option>
                      <option value="(12, 12)">(12, 12)</option>
                      <option value="(15, 15)">(15, 15)</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>Car 1</td>
                  <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>car_cur_location</td>
                  <td style={{ border: '1px solid #ccc', padding: '2px' }}>
                    <select 
                      value={editableValues.car_location}
                      onChange={(e) => handleValueChange('car_location', e.target.value)}
                      style={{ width: '100%', border: 'none', padding: '2px 4px', fontSize: '12px' }}
                    >
                      <option value="(0, 0)">(0, 0)</option>
                      <option value="(5, 4)">(5, 4)</option>
                      <option value="(8, 8)">(8, 8)</option>
                      <option value="(10, 10)">(10, 10)</option>
                      <option value="(15, 15)">(15, 15)</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '8px' }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowInstructions(true);
              }}
              style={{
                fontSize: '11px',
                color: '#007bff',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              Student Instructions
            </a>
          </div>

          {/* Begin Simulation Button */}
          <div style={{ marginTop: '20px' }}>
            <button
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
              Begin Simulation
            </button>
          </div>
        </div>
      </div>
      <div className="container container-2">
        <div style={{ padding: '10px 10px 10px 0' }}>
          <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
            Selected Attributes
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

          <h3 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
            Student's Code Explanation
          </h3>
          
          <div style={{
            padding: '10px',
            backgroundColor: '#f9f9f9',
            border: '1px solid #ddd',
            marginBottom: '15px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontStyle: 'italic'
          }}>
            "I wrote my rideshare assignment algorithm to check the request_time first and assign cars to riders in order. 
            I used a priority queue sorted by request_time to make sure earlier requests get served first. 
            Then I check pickup_location distances to break ties if two riders requested at the same time."
          </div>

          {/* Test Student Code Button */}
            <button
            disabled
              style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              border: '1px solid #a8c5a0',
              backgroundColor: '#c5d9be',
              color: '#4a5f45',
              cursor: 'not-allowed',
                fontWeight: '500',
              textAlign: 'center',
              marginBottom: '10px'
              }}
            >
            Test Student Code ✓
            </button>

          {/* Test Output */}
              <div style={{
            padding: '8px',
            backgroundColor: '#f0f7ed',
            border: '1px solid #a8c5a0',
            fontSize: '11px',
            lineHeight: '1.4',
            color: '#2d3a2b',
            marginBottom: '15px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px', color: '#4a5f45' }}>
              Test Output:
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestOutput(e.currentTarget.textContent || '')}
              style={{ outline: 'none' }}
            >
              {testOutput}
            </div>
          </div>
        </div>
      </div>
      <div className="container container-3" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Student Profile */}
                <div style={{
          padding: '8px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ccc'
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '4px', fontSize: '13px', color: '#000000' }}>
            Student Profile
          </h3>
          <div style={{ fontSize: '11px', lineHeight: '1.3', color: '#333' }}>
            <strong>Year:</strong> First-year | <strong>Course:</strong> CS 101<br/>
            <strong>Background:</strong> Rideshare domain exp | <strong>Programming:</strong> Beginner
          </div>
          </div>
          
        {/* Chat Messages */}
        <div style={{ 
          flex: 1, 
          padding: '10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Student's message */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              S
            </div>
            <div style={{
              flex: 1,
              padding: '8px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              fontSize: '12px',
              lineHeight: '1.4'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', color: '#666' }}>
                Student • 2 min ago
              </div>
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setStudentMessage(e.currentTarget.textContent || '')}
                style={{ 
                  outline: 'none',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {studentMessage}
              </div>
        </div>
      </div>

          <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', marginBottom: '8px' }}>
            Select a response:
          </div>

          {/* Response Text Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseA(e.currentTarget.textContent || '')}
              style={{
                padding: '8px',
                fontSize: '11px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none'
              }}
            >
              {testCaseA}
            </div>

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseB(e.currentTarget.textContent || '')}
              style={{
                padding: '8px',
                fontSize: '11px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none'
              }}
            >
              {testCaseB}
            </div>

            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setTestCaseC(e.currentTarget.textContent || '')}
              style={{
                padding: '8px',
                fontSize: '11px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                color: '#000000',
                cursor: 'pointer',
                textAlign: 'left',
                lineHeight: '1.3',
                outline: 'none'
              }}
            >
              {testCaseC}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', marginBottom: '6px' }}>
            Select test case:
          </div>

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
            const categoryLabel = testCase.category === 'rider_1' ? 'Rider 1' : 
                                 testCase.category === 'rider_2' ? 'Rider 2' :
                                 testCase.category === 'vehicle_1' ? 'Vehicle 1' :
                                 testCase.category === 'vehicle_2' ? 'Vehicle 2' : 'System';
            
            return (
              <div key={testCase.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
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
                        padding: '2px 4px', 
                        fontSize: '10px',
                        border: '1px solid #ccc',
                        backgroundColor: '#f0f0f0',
                        color: '#000000',
                        marginBottom: '3px'
                      }}
                    >
                      <option value="rider_1">Rider 1</option>
                      <option value="rider_2">Rider 2</option>
                      <option value="vehicle_1">Vehicle 1</option>
                      <option value="vehicle_2">Vehicle 2</option>
                      <option value="system">System</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                      <label style={{ fontSize: '9px', color: '#000000', whiteSpace: 'nowrap' }}>
                        Attr:
                      </label>
                      <select
                        value={testCase.attribute}
                        onChange={(e) => setTestCases(testCases.map(tc => 
                          tc.id === testCase.id ? { ...tc, attribute: e.target.value } : tc
                        ))}
                        style={{
                          flex: 1,
                          padding: '2px 4px',
                          fontSize: '9px',
                          border: '1px solid #ccc',
                          backgroundColor: '#f0f0f0',
                          color: '#000000'
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <label style={{ fontSize: '9px', color: '#000000', whiteSpace: 'nowrap' }}>
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
                          padding: '2px 4px',
                          fontSize: '9px',
                          border: '1px solid #ccc',
                          backgroundColor: 'white',
                          color: '#000000'
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
                padding: '6px',
                fontSize: '10px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer',
                color: '#000000'
              }}
            >
              + Add Test Case
            </button>
          )}
        </div>
      </div>
      
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
