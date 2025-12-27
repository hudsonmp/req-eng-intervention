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

  useEffect(() => {
    // Load instructions.tex file
    fetch('/instructions.tex')
      .then(response => response.text())
      .then(text => setInstructionsContent(text))
      .catch(err => console.error('Failed to load instructions:', err));
  }, []);

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
            backgroundColor: '#f9f9f9'
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
        </div>
      </div>
      <div className="container container-2">
        <div style={{ padding: '10px 10px 10px 0' }}>
          <h3 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', color: '#000000' }}>
            Add Test User
          </h3>
          
          {dropdowns.map((dropdown, index) => {
            const getIconAndColor = (selection: string) => {
              if (selection.startsWith('rider_1')) return { icon: '/icons/rider.svg', color: 'blue' };
              if (selection.startsWith('rider_2')) return { icon: '/icons/rider.svg', color: 'red' };
              if (selection.startsWith('vehicle_1')) return { icon: '/icons/vehicle.svg', color: 'blue' };
              if (selection.startsWith('vehicle_2')) return { icon: '/icons/vehicle.svg', color: 'red' };
              if (selection === 'system') return { icon: '/icons/system.svg', color: 'black' };
              return null;
            };
            
            const iconData = getIconAndColor(dropdown.selectedOption);
            
            return (
            <div key={dropdown.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {iconData && (
                  <img 
                    src={iconData.icon} 
                    alt="icon" 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      filter: iconData.color === 'blue' ? 'invert(27%) sepia(98%) saturate(7471%) hue-rotate(211deg) brightness(98%) contrast(107%)' :
                              iconData.color === 'red' ? 'invert(18%) sepia(97%) saturate(7491%) hue-rotate(357deg) brightness(95%) contrast(118%)' :
                              'none'
                    }} 
                  />
                )}
                <div style={{ maxWidth: '200px' }}>
                  <select 
                    value={dropdown.selectedOption}
                    onChange={(e) => handleSelectChange(dropdown.id, e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '4px 6px', 
                      fontSize: '13px',
                      border: '1px solid #ccc',
                      borderRadius: '0px',
                      backgroundColor: 'white',
                      color: '#000000'
                    }}
                  >
                    <option value="">Select category</option>
                    <option value="rider_1">Rider {}_1</option>
                    <option value="rider_2">Rider {}_2</option>
                    <option value="vehicle_1">Vehicle {}_1</option>
                    <option value="vehicle_2">Vehicle {}_2</option>
                    <option value="system">System</option>
                  </select>
                  
                  {dropdown.selectedOption && (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', color: '#000000', whiteSpace: 'nowrap' }}>
                        Attribute:
                      </label>
                      <select
                        value={dropdown.customText}
                        onChange={(e) => handleCustomTextChange(dropdown.id, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          fontSize: '13px',
                          border: '1px solid #ccc',
                          borderRadius: '0px',
                          backgroundColor: 'white',
                          color: '#000000'
                        }}
                      >
                        <option value="">Select attribute</option>
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
                        <option value="distance_dropoff">distance_dropoff</option>
                        <option value="predicted_profit">predicted_profit</option>
                        <option value="num_vehicles">num_vehicles</option>
                        <option value="num_riders">num_riders</option>
                        <option value="traffic_delay">traffic_delay</option>
                        <option value="service_radius">service_radius</option>
                        <option value="online">online</option>
                        <option value="cancels">cancels</option>
                        <option value="batch">batch</option>
                        <option value="occupied_assigned_after">occupied_assigned_after</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {index === dropdowns.length - 1 && dropdowns.length < 3 && dropdown.selectedOption && dropdown.customText && (
                  <button
                    onClick={handleAddDropdown}
                    style={{
                      width: '28px',
                      height: '28px',
                      fontSize: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '0px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000000',
                      padding: '0'
                    }}
                  >
                    +
                  </button>
                )}
                {dropdowns.length > 1 && (
                  <button
                    onClick={() => setDropdowns(dropdowns.filter(d => d.id !== dropdown.id))}
                    style={{
                      width: '28px',
                      height: '28px',
                      fontSize: '16px',
                      border: '1px solid #ccc',
                      borderRadius: '0px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000000',
                      padding: '0'
                    }}
                  >
                    −
                  </button>
                )}
              </div>
            </div>
            );
          })}
          
          <div 
            style={{ position: 'relative', display: 'inline-block', marginTop: '20px' }}
            onMouseEnter={() => !isButtonEnabled && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <button
              disabled={!isButtonEnabled}
              onClick={handleBeginHelping}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '0px',
                backgroundColor: isButtonEnabled ? '#007bff' : '#cccccc',
                color: 'white',
                cursor: isButtonEnabled ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                pointerEvents: isButtonEnabled ? 'auto' : 'none'
              }}
            >
              Begin Helping Students
            </button>
            {showTooltip && !isButtonEnabled && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                padding: '8px 12px',
                backgroundColor: '#ffe8d1',
                color: '#000000',
                fontSize: '13px',
                whiteSpace: 'nowrap',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}>
                Try selecting two categories and attributes
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '0',
                  height: '0',
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #ffe8d1'
                }}></div>
              </div>
            )}
          </div>
          
          {errorMessage && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: '#fee',
              color: '#c00',
              fontSize: '13px',
              border: '1px solid #fcc'
            }}>
              {errorMessage}
            </div>
          )}
        </div>
      </div>
      <div className="container container-3">
        <select
          value={selectedInteraction}
          onChange={(e) => setSelectedInteraction(e.target.value)}
          style={{
            width: '80px',
            padding: '2px 4px',
            fontSize: '11px',
            border: '1px solid #ccc',
            borderRadius: '0px',
            backgroundColor: 'white',
            color: '#000000'
          }}
        >
          <option value="">-</option>
          <option value="interaction_1">1</option>
          <option value="interaction_2">2</option>
          <option value="interaction_3">3</option>
        </select>
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
