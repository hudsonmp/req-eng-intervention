import React, { useState, useEffect } from 'react';

interface Reservation {
  id: number;
  time: string;
  partySize: number;
}

const ALL_TIME_SLOTS = ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];
const ALL_PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

// Claude feedback API call
async function getFeedbackFromClaude(userTypes: string[]): Promise<string> {
  try {
    const response = await fetch('http://localhost:8000/pre-assessment/user-types-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_types: userTypes })
    });
    const data = await response.json();
    return data.feedback;
  } catch (error) {
    console.error('Error getting feedback:', error);
    return 'Unable to get feedback at this time.';
  }
}

// Generate action options using Claude
async function generateActionOptions(userType: string): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:8000/pre-assessment/generate-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_type: userType })
    });
    const data = await response.json();
    return data.actions;
  } catch (error) {
    console.error('Error generating actions:', error);
    return [];
  }
}

function Reservation() {
  // Diner state
  const [selectedTime, setSelectedTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [waitlist, setWaitlist] = useState<Reservation[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Owner settings (NOT synced to diner - intentional bug)
  const [ownerTimes, setOwnerTimes] = useState<string[]>(ALL_TIME_SLOTS);
  const [ownerPartySizes, setOwnerPartySizes] = useState<number[]>(ALL_PARTY_SIZES);

  // MCQ questions state (declared early because it's used in computed values below)
  const [selectedScenarioAnswer, setSelectedScenarioAnswer] = useState('');
  const [selectedCancellationAnswer, setSelectedCancellationAnswer] = useState('');
  const [selectedInfoAnswer, setSelectedInfoAnswer] = useState('');

  // Diner sees all options (bug) - OR respects owner settings if MCQ answered correctly
  const shouldRespectOwnerSettings = selectedScenarioAnswer === 'correct';
  const dinerTimes = shouldRespectOwnerSettings ? ownerTimes : ALL_TIME_SLOTS;
  const dinerPartySizes = shouldRespectOwnerSettings ? ownerPartySizes : ALL_PARTY_SIZES;

  // Step progression state
  const [currentStep, setCurrentStep] = useState(1);

  // Question 1: Initial reflection on reservation system
  const [systemReflection, setSystemReflection] = useState('');

  // Question 2: User types question state
  const [userType1, setUserType1] = useState('');
  const [userType2, setUserType2] = useState('');
  const [userType3, setUserType3] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Question 3: Actions for stakeholder 1
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);

  // Questions 4-5: Free response actions for remaining stakeholders
  const [stakeholder2Actions, setStakeholder2Actions] = useState('');
  const [stakeholder3Actions, setStakeholder3Actions] = useState('');

  const scenarioOptions = [
    { id: 'correct', text: 'That time slot should not be available for booking in the diner view' },
    { id: 'distractor1', text: 'The diner can still book but receives an email notification that the restaurant is closed' },
    { id: 'distractor2', text: 'The reservation goes through but is marked as pending for owner approval' },
    { id: 'distractor3', text: 'The diner sees a warning message but can still complete the booking' }
  ];

  const cancellationOptions = [
    { id: 'correct', text: 'The diner should be notified immediately and the reservation should be cancelled in the system' },
    { id: 'distractor1', text: 'The reservation stays active but is marked as "pending" until the diner confirms' },
    { id: 'distractor2', text: 'The system automatically reschedules the reservation to the next available date' },
    { id: 'distractor3', text: 'The reservation remains in the system and the diner is informed when they arrive' }
  ];

  const infoOptions = [
    { id: 'correct', text: 'Email address' },
    { id: 'distractor1', text: 'Desired seat color' },
    { id: 'distractor2', text: 'Middle name' },
    { id: 'distractor3', text: 'Country of residence' }
  ];

  // Question 9: Data collection per stakeholder
  interface DataItem {
    id: number;
    text: string;
  }
  const [dataCollection, setDataCollection] = useState<{ [key: string]: DataItem[] }>({});
  const [newDataInputs, setNewDataInputs] = useState<{ [key: string]: string }>({});

  // Question 11: Concurrent booking scenario
  const [concurrentBookingAnswer, setConcurrentBookingAnswer] = useState('');

  // Question 12: Table allocation with different party sizes
  const [tableAllocationAnswer, setTableAllocationAnswer] = useState('');

  // Selected necessary data for Q11 and Q12
  const [q11SelectedData, setQ11SelectedData] = useState<string[]>([]);
  const [q12SelectedData, setQ12SelectedData] = useState<string[]>([]);

  // Question 13: Construct a "what if" scenario
  const [scenarioText, setScenarioText] = useState('');
  const [scenarioResponse, setScenarioResponse] = useState('');
  const [scenarioLoading, setScenarioLoading] = useState(false);

  // Question 14: Combined data + what if + now what iterations
  interface Iteration {
    selectedData: string[];
    whatIf: string;
    nowWhat: string;
  }
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [currentIteration, setCurrentIteration] = useState<Iteration>({
    selectedData: [],
    whatIf: '',
    nowWhat: ''
  });

  const toggleDataSelectionQ14 = (dataKey: string) => {
    setCurrentIteration(prev => ({
      ...prev,
      selectedData: prev.selectedData.includes(dataKey)
        ? prev.selectedData.filter(k => k !== dataKey)
        : [...prev.selectedData, dataKey]
    }));
  };

  const addIteration = () => {
    if (currentIteration.selectedData.length > 0 && currentIteration.whatIf.trim() && currentIteration.nowWhat.trim()) {
      setIterations(prev => [...prev, currentIteration]);
      setCurrentIteration({
        selectedData: [],
        whatIf: '',
        nowWhat: ''
      });
    }
  };

  const removeIteration = (index: number) => {
    setIterations(prev => prev.filter((_, i) => i !== index));
  };

  // Study metadata
  const [studyId, setStudyId] = useState<number>(0);
  const [participantId, setParticipantId] = useState<string>('');
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Get study_id and participant_id from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const study = params.get('study_id');
    const participant = params.get('participant_id');

    if (study) setStudyId(parseInt(study));
    if (participant) setParticipantId(participant);
  }, []);

  // Submit all responses to backend
  const submitAssessment = async () => {
    if (iterations.length < 3) {
      alert('Please complete at least 3 combined scenarios before submitting.');
      return;
    }

    setIsFinalSubmitting(true);
    try {
      const payload = {
        study_id: studyId,
        participant_id: participantId,
        system_reflection: systemReflection,
        user_type_1: userType1,
        user_type_2: userType2,
        user_type_3: userType3,
        user_types_feedback: feedback,
        selected_actions: selectedActions,
        stakeholder2_actions: stakeholder2Actions,
        stakeholder3_actions: stakeholder3Actions,
        closed_restaurant_answer: selectedScenarioAnswer,
        cancellation_answer: selectedCancellationAnswer,
        important_info_answer: selectedInfoAnswer,
        data_collection: dataCollection,
        data_reflection: reflectionAnswer,
        concurrent_booking_answer: concurrentBookingAnswer,
        concurrent_booking_selected_data: q11SelectedData,
        table_allocation_answer: tableAllocationAnswer,
        table_allocation_selected_data: q12SelectedData,
        custom_scenario: scenarioText,
        custom_scenario_response: scenarioResponse,
        combined_iterations: iterations
      };

      const response = await fetch('http://localhost:8000/pre-assessment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        alert('Pre-assessment submitted successfully!');
      } else {
        throw new Error('Failed to submit assessment');
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
      alert('Failed to submit assessment. Please try again.');
    } finally {
      setIsFinalSubmitting(false);
    }
  };

  const toggleDataSelection = (questionNum: 11 | 12, dataKey: string) => {
    if (questionNum === 11) {
      setQ11SelectedData(prev =>
        prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
      );
    } else {
      setQ12SelectedData(prev =>
        prev.includes(dataKey) ? prev.filter(k => k !== dataKey) : [...prev, dataKey]
      );
    }
  };

  const submitScenario = async () => {
    if (!scenarioText.trim()) return;

    setScenarioLoading(true);
    try {
      const response = await fetch('http://localhost:8000/pre-assessment/generate-scenario-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenario: scenarioText }),
      });

      const data = await response.json();
      setScenarioResponse(data.response);
    } catch (error) {
      console.error('Error getting scenario response:', error);
      setScenarioResponse('Unable to get a response at this time.');
    } finally {
      setScenarioLoading(false);
    }
  };

  // Question 9: Reflection on data types
  const [reflectionAnswer, setReflectionAnswer] = useState('');

  const addDataItem = (stakeholder: string) => {
    const inputText = newDataInputs[stakeholder]?.trim();
    if (!inputText) return;

    const newItem: DataItem = {
      id: Date.now(),
      text: inputText
    };

    setDataCollection(prev => ({
      ...prev,
      [stakeholder]: [...(prev[stakeholder] || []), newItem]
    }));

    setNewDataInputs(prev => ({ ...prev, [stakeholder]: '' }));
  };

  const removeDataItem = (stakeholder: string, itemId: number) => {
    setDataCollection(prev => ({
      ...prev,
      [stakeholder]: (prev[stakeholder] || []).filter(item => item.id !== itemId)
    }));
  };

  const toggleTime = (time: string) => {
    setOwnerTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  };

  const togglePartySize = (size: number) => {
    setOwnerPartySizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const handleBook = () => {
    if (!selectedTime) return;
    const newRes: Reservation = { id: Date.now(), time: selectedTime, partySize };
    setReservation(newRes);
    setWaitlist([...waitlist, newRes]);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 3000);
  };

  const handleCancel = () => {
    if (reservation) {
      setWaitlist(waitlist.filter(r => r.id !== reservation.id));
      setReservation(null);
      setSelectedTime('');
    }
  };

  const handleSubmitUserTypes = async () => {
    const userTypes = [userType1, userType2, userType3].filter(t => t.trim() !== '');

    if (userTypes.length === 0) {
      setFeedback('Please enter at least one user type.');
      return;
    }

    setIsSubmitting(true);
    setFeedback('');

    const claudeFeedback = await getFeedbackFromClaude(userTypes);
    setFeedback(claudeFeedback);
    setIsSubmitting(false);

    // Generate action options for Question 2 using the first user type
    if (userType1.trim() !== '') {
      setIsGeneratingActions(true);
      const actions = await generateActionOptions(userType1.trim());
      setActionOptions(actions);
      setIsGeneratingActions(false);
    }
  };

  const toggleAction = (action: string) => {
    if (selectedActions.includes(action)) {
      setSelectedActions(selectedActions.filter(a => a !== action));
    } else {
      setSelectedActions([...selectedActions, action]);
    }
  };

  const handleNext = () => {
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
  };

  // Render previous responses summary
  const renderPreviousResponses = () => {
    const responses = [];

    if (currentStep > 1 && feedback) {
      responses.push(
        <div key="step1" style={{
          padding: '10px',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          marginBottom: '8px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Q1:</strong> {[userType1, userType2, userType3].filter(t => t.trim()).join(', ')}
          </div>
          <button
            onClick={() => handleEditStep(1)}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: 'white',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>
      );
    }

    if (currentStep > 2 && selectedActions.length > 0) {
      responses.push(
        <div key="step2" style={{
          padding: '10px',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          marginBottom: '8px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Q2:</strong> {selectedActions.length} action(s) selected
          </div>
          <button
            onClick={() => handleEditStep(2)}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: 'white',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>
      );
    }

    if (currentStep > 3 && stakeholder2Actions.trim()) {
      responses.push(
        <div key="step3" style={{
          padding: '10px',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          marginBottom: '8px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Q3:</strong> {stakeholder2Actions.substring(0, 40)}...
          </div>
          <button
            onClick={() => handleEditStep(3)}
            style={{
              padding: '4px 8px',
              background: '#333',
              color: 'white',
              border: 'none',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>
      );
    }

    if (responses.length > 0) {
      return (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#666'
          }}>
            Previous Responses:
          </div>
          {responses}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '12px', gap: '12px', boxSizing: 'border-box', background: '#f5f5f5' }}>
      {/* Main container */}
      <div style={{ display: 'flex', flex: 1, gap: '12px', overflow: 'hidden' }}>
        {/* Left side - Diner and Owner views stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '50%', gap: '12px' }}>
          {/* Diner View Container */}
          <div style={{ flex: 1, boxSizing: 'border-box' }}>
            <div style={{
              border: '1px solid #ccc',
              background: 'white',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '0',
              overflow: 'hidden',
              boxShadow: 'none'
            }}>
              {/* Diner window title bar */}
              <div style={{
                background: '#333',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 'normal',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #ccc',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Diner View - Reservation System</span>
                </div>
              </div>

              {/* Diner content */}
              <div style={{ padding: '16px', flex: 1, overflow: 'auto', background: '#ffffff' }}>
                {showConfirmation && (
                  <div style={{
                    background: '#f5f5f5',
                    border: '1px solid #ccc',
                    padding: '12px',
                    marginBottom: '14px',
                    fontSize: '13px',
                    borderRadius: '0',
                    boxShadow: 'none',
                    fontWeight: 'normal'
                  }}>
                    Reservation confirmed for {reservation?.time}, party of {reservation?.partySize}
                  </div>
                )}

                {!reservation ? (
                  <>
                    <div style={{
                      marginBottom: '16px'
                    }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        color: '#333',
                        fontWeight: 'normal'
                      }}>
                        Select Time
                      </label>
                      <select
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ccc',
                          fontSize: '14px',
                          borderRadius: '0',
                          background: '#fff',
                          fontFamily: 'inherit'
                        }}
                      >
                        <option value="">Choose a time slot</option>
                        {dinerTimes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div style={{
                      marginBottom: '16px'
                    }}>
                      <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '13px',
                        color: '#333',
                        fontWeight: 'normal'
                      }}>
                        Party Size
                      </label>
                      <select
                        value={partySize}
                        onChange={e => setPartySize(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #ccc',
                          fontSize: '14px',
                          borderRadius: '0',
                          background: '#fff',
                          fontFamily: 'inherit'
                        }}
                      >
                        {dinerPartySizes.map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                      </select>
                    </div>

                    <button
                      onClick={handleBook}
                      disabled={!selectedTime}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: selectedTime ? '#333' : '#999',
                        color: 'white',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 'normal',
                        borderRadius: '0',
                        cursor: selectedTime ? 'pointer' : 'not-allowed',
                        boxShadow: 'none',
                        fontFamily: 'inherit'
                      }}
                    >
                      Confirm Reservation
                    </button>
                  </>
                ) : (
                  <div>
                    <div style={{
                      background: '#f5f5f5',
                      padding: '12px',
                      marginBottom: '14px',
                      fontSize: '13px',
                      borderRadius: '0',
                      border: '1px solid #ccc',
                      boxShadow: 'none'
                    }}>
                      <div style={{ fontWeight: 'normal', marginBottom: '6px', fontSize: '13px', color: '#333' }}>Your Reservation</div>
                      <div style={{ color: '#666', fontFamily: 'inherit', fontSize: '13px' }}>{reservation.time} · {reservation.partySize} {reservation.partySize === 1 ? 'guest' : 'guests'}</div>
                    </div>
                    <button
                      onClick={handleCancel}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: '#333',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 'normal',
                        color: 'white',
                        borderRadius: '0',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        fontFamily: 'inherit'
                      }}
                    >
                      Cancel Reservation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Owner View Container */}
          <div style={{ flex: 1, boxSizing: 'border-box' }}>
            <div style={{
              border: '1px solid #ccc',
              background: 'white',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '0',
              overflow: 'hidden',
              boxShadow: 'none'
            }}>
              {/* Owner window title bar */}
              <div style={{
                background: '#333',
                color: '#fff',
                padding: '6px 10px',
                fontSize: '13px',
                fontWeight: 'normal',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #ccc',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Owner View - Admin Panel</span>
                </div>
              </div>

              {/* Owner content */}
              <div style={{ padding: '16px', flex: 1, overflow: 'auto', background: '#ffffff' }}>
                <div style={{
                  marginBottom: '16px'
                }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    color: '#333',
                    fontWeight: 'normal'
                  }}>
                    Available Time Slots
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ALL_TIME_SLOTS.map(time => (
                      <button
                        key={time}
                        onClick={() => toggleTime(time)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '13px',
                          border: '1px solid #ccc',
                          borderRadius: '0',
                          background: ownerTimes.includes(time) ? '#333' : '#fff',
                          color: ownerTimes.includes(time) ? '#fff' : '#333',
                          cursor: 'pointer',
                          fontWeight: 'normal',
                          boxShadow: 'none',
                          fontFamily: 'inherit'
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{
                  marginBottom: '16px'
                }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    color: '#333',
                    fontWeight: 'normal'
                  }}>
                    Allowed Party Sizes
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ALL_PARTY_SIZES.map(size => (
                      <button
                        key={size}
                        onClick={() => togglePartySize(size)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '13px',
                          border: '1px solid #ccc',
                          borderRadius: '0',
                          background: ownerPartySizes.includes(size) ? '#333' : '#fff',
                          color: ownerPartySizes.includes(size) ? '#fff' : '#333',
                          cursor: 'pointer',
                          fontWeight: 'normal',
                          boxShadow: 'none',
                          fontFamily: 'inherit'
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '0',
                  fontSize: '13px',
                  color: '#333',
                  border: '1px solid #ccc',
                  boxShadow: 'none'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '4px', fontSize: '13px' }}>Current Settings</div>
                  <div style={{ fontFamily: 'inherit', color: '#666' }}>{ownerTimes.length} time slots · {ownerPartySizes.length} party sizes</div>
                </div>

                {waitlist.length > 0 && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#f5f5f5',
                    border: '1px solid #ccc',
                    borderRadius: '0'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 'normal',
                      marginBottom: '8px',
                      color: '#333'
                    }}>
                      Reservations ({waitlist.length})
                    </div>
                    {waitlist.map(r => (
                      <div key={r.id} style={{
                        fontSize: '13px',
                        padding: '8px',
                        background: '#fff',
                        border: '1px solid #ccc',
                        marginBottom: '4px',
                        borderRadius: '0',
                        fontFamily: 'inherit',
                        color: '#333',
                        boxShadow: 'none'
                      }}>
                        {r.time} · {r.partySize} guests
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Interaction panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #ccc',
          borderRadius: '0',
          overflow: 'hidden',
          background: 'white',
          height: '100%',
          boxShadow: 'none'
        }}>
          {/* Interaction window title bar */}
          <div style={{
            background: '#546e7a',
            color: '#fff',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #ccc',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📋</span>
              <span>Study Assessment</span>
            </div>
          </div>

          {/* Interaction content */}
          <div style={{
            flex: '1 1 0',
            padding: '16px',
            overflowY: 'auto',
            background: '#ffffff'
          }}>
            {/* Previous responses summary */}
            {renderPreviousResponses()}

            {/* Step 1: Initial reflection and user types questions */}
            {currentStep === 1 && (
              <>
                {/* Question 1: System reflection */}
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '16px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 1:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Describe how a reservation system works in terms of the different users and how different types of users can affect one another (e.g., the restaurant collects information about when the diner wants to come in).
                  </div>
                </div>

                <textarea
                  value={systemReflection}
                  onChange={(e) => setSystemReflection(e.target.value)}
                  placeholder="Describe how different users interact in a reservation system..."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '24px'
                  }}
                />

                {/* Question 2: User types */}
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '16px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 2:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    What are the different types of users that would use a dinner reservation system? List at least 3 user types.
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 'normal',
                      color: '#333'
                    }}>
                      User Type 1:
                    </label>
                    <input
                      type="text"
                      value={userType1}
                      onChange={(e) => setUserType1(e.target.value)}
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '0',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        background: '#fff'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 'normal',
                      color: '#333'
                    }}>
                      User Type 2:
                    </label>
                    <input
                      type="text"
                      value={userType2}
                      onChange={(e) => setUserType2(e.target.value)}
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '0',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        background: '#fff'
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: 'normal',
                      color: '#333'
                    }}>
                      User Type 3:
                    </label>
                    <input
                      type="text"
                      value={userType3}
                      onChange={(e) => setUserType3(e.target.value)}
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '0',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        background: '#fff'
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSubmitUserTypes}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: !isSubmitting ? '#546e7a' : '#999',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 'normal',
                      borderRadius: '0',
                      cursor: !isSubmitting ? 'pointer' : 'not-allowed',
                      boxShadow: 'none',
                      fontFamily: 'inherit'
                    }}
                  >
                    {isSubmitting ? 'Analyzing...' : 'Submit'}
                  </button>
                </div>

                {feedback && (
                  <div style={{
                    padding: '12px',
                    background: '#e3f2fd',
                    border: '1px solid #90caf9',
                    borderRadius: '0',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#1565c0',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '6px' }}>
                      ✓ Feedback:
                    </div>
                    <div style={{ color: '#1976d2' }}>
                      {feedback}
                    </div>
                    {!isGeneratingActions && actionOptions.length > 0 && (
                      <button
                        onClick={handleNext}
                        style={{
                          marginTop: '12px',
                          padding: '8px 16px',
                          background: '#546e7a',
                          color: 'white',
                          border: 'none',
                          fontSize: '13px',
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        Next Question →
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Actions for stakeholder 1 */}
            {currentStep === 2 && (
              <>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '16px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 3:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Which of the following are actions that <strong>{userType1}</strong> should be able to take?
                  </div>
                </div>

                {isGeneratingActions ? (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: '#546e7a',
                    fontSize: '13px'
                  }}>
                    Generating action options...
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      {actionOptions.map((action, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            marginBottom: '8px',
                            background: '#fff',
                            border: selectedActions.includes(action) ? '1px solid #546e7a' : '1px solid #ccc',
                            borderRadius: '0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}
                          onClick={() => toggleAction(action)}
                        >
                          <div style={{
                            width: '16px',
                            height: '16px',
                            border: '1px solid #546e7a',
                            borderRadius: '0',
                            background: selectedActions.includes(action) ? '#546e7a' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'normal',
                            flexShrink: 0
                          }}>
                            {selectedActions.includes(action) ? '✓' : ''}
                          </div>
                          <div style={{ color: '#333' }}>
                            {action}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleBack}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: '#666',
                          color: 'white',
                          border: 'none',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleNext}
                        disabled={selectedActions.length === 0}
                        style={{
                          flex: 1,
                          padding: '10px 16px',
                          background: selectedActions.length > 0 ? '#546e7a' : '#999',
                          color: 'white',
                          border: 'none',
                          fontSize: '14px',
                          cursor: selectedActions.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3: Free response for stakeholder 2 */}
            {currentStep === 3 && userType2.trim() !== '' && (
              <>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 4:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    What are the actions that <strong>{userType2}</strong> should be able to take? List them separated by commas.
                  </div>
                </div>
                <textarea
                  value={stakeholder2Actions}
                  onChange={(e) => setStakeholder2Actions(e.target.value)}
                  placeholder="e.g., Action 1, Action 2, Action 3"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleBack}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#666',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!stakeholder2Actions.trim()}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: stakeholder2Actions.trim() ? '#546e7a' : '#999',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      cursor: stakeholder2Actions.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* Step 4: Free response for stakeholder 3 */}
            {currentStep === 4 && userType3.trim() !== '' && (
              <>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 5:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    What are the actions that <strong>{userType3}</strong> should be able to take? List them separated by commas.
                  </div>
                </div>
                <textarea
                  value={stakeholder3Actions}
                  onChange={(e) => setStakeholder3Actions(e.target.value)}
                  placeholder="e.g., Action 1, Action 2, Action 3"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '16px'
                  }}
                />

              </>
            )}

            {/* Question 6: Closed restaurant scenario */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 6:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Suppose the owner marked the restaurant as closed on a Sunday night. What should happen on the diner's side if they attempt to book a reservation for that night?
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  {scenarioOptions.map((option) => (
                    <div
                      key={option.id}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '8px',
                        background: '#fff',
                        border: selectedScenarioAnswer === option.id ? '2px solid #546e7a' : '1px solid #ccc',
                        borderRadius: '0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: '13px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                      onClick={() => setSelectedScenarioAnswer(option.id)}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '1px solid #546e7a',
                        borderRadius: '50%',
                        background: selectedScenarioAnswer === option.id ? '#546e7a' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {selectedScenarioAnswer === option.id && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#fff'
                          }} />
                        )}
                      </div>
                      <div style={{ color: '#333', flex: 1 }}>
                        {option.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question 7: Cancelling existing reservation */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 7:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Now consider that the diner had already made a reservation for Sunday night and the owner had to cancel last minute after the reservation was booked. What should happen?
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  {cancellationOptions.map((option) => (
                    <div
                      key={option.id}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '8px',
                        background: '#fff',
                        border: selectedCancellationAnswer === option.id ? '2px solid #546e7a' : '1px solid #ccc',
                        borderRadius: '0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: '13px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                      onClick={() => setSelectedCancellationAnswer(option.id)}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '1px solid #546e7a',
                        borderRadius: '50%',
                        background: selectedCancellationAnswer === option.id ? '#546e7a' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {selectedCancellationAnswer === option.id && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#fff'
                          }} />
                        )}
                      </div>
                      <div style={{ color: '#333', flex: 1 }}>
                        {option.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question 8: Important information to collect */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 8:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Which of the following information from the diner would be most important to collect to offer this functionality?
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  {infoOptions.map((option) => (
                    <div
                      key={option.id}
                      style={{
                        padding: '10px 12px',
                        marginBottom: '8px',
                        background: '#fff',
                        border: selectedInfoAnswer === option.id ? '2px solid #546e7a' : '1px solid #ccc',
                        borderRadius: '0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        fontSize: '13px',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                      onClick={() => setSelectedInfoAnswer(option.id)}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '1px solid #546e7a',
                        borderRadius: '50%',
                        background: selectedInfoAnswer === option.id ? '#546e7a' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {selectedInfoAnswer === option.id && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#fff'
                          }} />
                        )}
                      </div>
                      <div style={{ color: '#333', flex: 1 }}>
                        {option.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question 9: Data collection per stakeholder */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 9:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Imagine you are the developer for this platform, what data would you collect from the different user types to improve functionality?
                  </div>
                </div>

                {/* Data collection for each stakeholder */}
                {[userType1, userType2, userType3].filter(t => t.trim() !== '').map((stakeholder, idx) => (
                  <div key={idx} style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 'normal',
                      marginBottom: '8px',
                      color: '#333',
                      borderBottom: '1px solid #ccc',
                      paddingBottom: '4px'
                    }}>
                      Data for {stakeholder}:
                    </div>

                    {/* List of existing items */}
                    {(dataCollection[stakeholder] || []).map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px',
                          background: '#fff',
                          border: '1px solid #ccc',
                          marginBottom: '4px',
                          fontSize: '13px'
                        }}
                      >
                        <div style={{ flex: 1 }}>{item.text}</div>
                        <button
                          onClick={() => removeDataItem(stakeholder, item.id)}
                          style={{
                            padding: '4px 8px',
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {/* Input to add new item */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input
                        type="text"
                        value={newDataInputs[stakeholder] || ''}
                        onChange={(e) => setNewDataInputs(prev => ({ ...prev, [stakeholder]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addDataItem(stakeholder);
                          }
                        }}
                        placeholder="e.g., Email address, phone number..."
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '0',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        onClick={() => addDataItem(stakeholder)}
                        disabled={!(newDataInputs[stakeholder] || '').trim()}
                        style={{
                          padding: '8px 16px',
                          background: (newDataInputs[stakeholder] || '').trim() ? '#2c5f2d' : '#999',
                          color: 'white',
                          border: 'none',
                          cursor: (newDataInputs[stakeholder] || '').trim() ? 'pointer' : 'not-allowed',
                          fontSize: '13px'
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Question 10: Reflection on data types */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 10:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Reflect on your responses above. In a brief paragraph (3-4 sentences), explain why some of the data types you identified are important and how you would use them to improve the reservation system functionality.
                  </div>
                </div>
                <textarea
                  value={reflectionAnswer}
                  onChange={(e) => setReflectionAnswer(e.target.value)}
                  placeholder="Write your reflection here..."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px'
                  }}
                />
              </div>
            )}

            {/* Question 11: Concurrent booking scenario */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 11:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Suppose there is one table available at the restaurant. If diner_1 books the table, what should happen when diner_2 attempts to book the table?
                  </div>
                </div>
                <textarea
                  value={concurrentBookingAnswer}
                  onChange={(e) => setConcurrentBookingAnswer(e.target.value)}
                  placeholder="Describe what should happen when the second diner tries to book..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px'
                  }}
                />

                {/* Checkbox selection for necessary data - Q11 */}
                {Object.keys(dataCollection).length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#f5f5f5',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    marginTop: '12px',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#333' }}>
                      Select the necessary data from your responses above:
                    </div>
                    {Object.entries(dataCollection).map(([stakeholder, items]) => (
                      items.length > 0 && (
                        <div key={stakeholder} style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                            From {stakeholder}:
                          </div>
                          {items.map(item => {
                            const dataKey = `${stakeholder}:${item.id}`;
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  marginBottom: '4px',
                                  background: '#fff',
                                  border: '1px solid #ccc',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                                onClick={() => toggleDataSelection(11, dataKey)}
                              >
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '1px solid #333',
                                  borderRadius: '2px',
                                  background: q11SelectedData.includes(dataKey) ? '#333' : '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontSize: '12px',
                                  flexShrink: 0
                                }}>
                                  {q11SelectedData.includes(dataKey) ? '✓' : ''}
                                </div>
                                <div style={{ flex: 1 }}>{item.text}</div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Question 12: Table allocation with different party sizes */}
            {currentStep >= 2 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#eceff1',
                  border: '1px solid #90a4ae',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#37474f' }}>
                    📝 Question 12:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Now assume that there are two tables, one that accommodates two people and another that accommodates four people. If two diners, each with a respective party size of two and four attempt to book the reservation at the same time, how should it be determined who gets what table?
                  </div>
                </div>
                <textarea
                  value={tableAllocationAnswer}
                  onChange={(e) => setTableAllocationAnswer(e.target.value)}
                  placeholder="Describe how the system should allocate tables based on party sizes..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px'
                  }}
                />

                {/* Checkbox selection for necessary data - Q12 */}
                {Object.keys(dataCollection).length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#f5f5f5',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    marginTop: '12px',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#333' }}>
                      Select the necessary data from your responses above:
                    </div>
                    {Object.entries(dataCollection).map(([stakeholder, items]) => (
                      items.length > 0 && (
                        <div key={stakeholder} style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                            From {stakeholder}:
                          </div>
                          {items.map(item => {
                            const dataKey = `${stakeholder}:${item.id}`;
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  marginBottom: '4px',
                                  background: '#fff',
                                  border: '1px solid #ccc',
                                  cursor: 'pointer',
                                  fontSize: '13px'
                                }}
                                onClick={() => toggleDataSelection(12, dataKey)}
                              >
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  border: '1px solid #333',
                                  borderRadius: '2px',
                                  background: q12SelectedData.includes(dataKey) ? '#333' : '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#fff',
                                  fontSize: '12px',
                                  flexShrink: 0
                                }}>
                                  {q12SelectedData.includes(dataKey) ? '✓' : ''}
                                </div>
                                <div style={{ flex: 1 }}>{item.text}</div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Question 13: Construct a "what if" scenario */}
            {currentStep === 2 && actionOptions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  background: '#e3f2fd',
                  border: '1px solid #90caf9',
                  borderRadius: '0',
                  marginBottom: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#0d47a1' }}>
                    📝 Question 13:
                  </div>
                  <div style={{ color: '#546e7a' }}>
                    Now using two data types from at least two of the different user types, try constructing a "what if" scenario, similar to what you've seen previously. Once you send the message, our AI will give you a sample response.
                  </div>
                </div>
                <textarea
                  value={scenarioText}
                  onChange={(e) => setScenarioText(e.target.value)}
                  placeholder="Example: What if a diner with a party size of 4 tries to book a table during a time slot that the owner has marked as closed?"
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: '8px'
                  }}
                />
                <button
                  onClick={submitScenario}
                  disabled={!scenarioText.trim() || scenarioLoading}
                  style={{
                    padding: '8px 16px',
                    background: scenarioText.trim() && !scenarioLoading ? '#0d47a1' : '#ccc',
                    color: 'white',
                    border: 'none',
                    cursor: scenarioText.trim() && !scenarioLoading ? 'pointer' : 'not-allowed',
                    fontSize: '13px',
                    marginBottom: '12px'
                  }}
                >
                  {scenarioLoading ? 'Getting response...' : 'Submit Scenario'}
                </button>

                {scenarioResponse && (
                  <div style={{
                    padding: '12px',
                    background: '#f5f5f5',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    fontSize: '13px',
                    lineHeight: '1.6'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#333' }}>
                      AI Response:
                    </div>
                    <div style={{ color: '#666' }}>
                      {scenarioResponse}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Question 14: Combined iterations of data + what if + now what */}
            {currentStep === 2 && actionOptions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {/* Introductory message */}
                {iterations.length === 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#e8f5e9',
                    border: '1px solid #81c784',
                    borderRadius: '0',
                    marginBottom: '12px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#2e7d32' }}>
                      📝 Question 14: Putting It All Together
                    </div>
                    <div style={{ color: '#546e7a' }}>
                      Now it's time to combine everything you've learned! You'll create 3-5 scenarios (depending on time) where you'll:
                      <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
                        <li>Select relevant data types from your earlier responses</li>
                        <li>Write a "What if" scenario using that data</li>
                        <li>Write a "Now what" response explaining what should happen</li>
                      </ul>
                      This brings together the user types, data collection, and scenarios you've been thinking about.
                    </div>
                  </div>
                )}

                {/* Display completed iterations */}
                {iterations.map((iteration, index) => (
                  <div key={index} style={{
                    padding: '12px',
                    background: '#f9f9f9',
                    border: '1px solid #ccc',
                    borderRadius: '0',
                    marginBottom: '12px',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 'normal', color: '#333' }}>
                        Scenario {index + 1}
                      </div>
                      <button
                        onClick={() => removeIteration(index)}
                        style={{
                          padding: '4px 8px',
                          background: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                        Selected Data ({iteration.selectedData.length} items):
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', paddingLeft: '8px' }}>
                        {iteration.selectedData.map(dataKey => {
                          const [stakeholder, itemId] = dataKey.split(':');
                          const item = dataCollection[stakeholder]?.find(i => i.id === parseInt(itemId));
                          return item ? `${stakeholder}: ${item.text}` : '';
                        }).join(', ')}
                      </div>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                        What if:
                      </div>
                      <div style={{ fontSize: '12px', color: '#333', paddingLeft: '8px' }}>
                        {iteration.whatIf}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                        Now what:
                      </div>
                      <div style={{ fontSize: '12px', color: '#333', paddingLeft: '8px' }}>
                        {iteration.nowWhat}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Current iteration form (only show if less than 5 iterations) */}
                {iterations.length < 5 && (
                  <div style={{
                    padding: '12px',
                    background: '#fff',
                    border: '2px solid #2196f3',
                    borderRadius: '0',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontWeight: 'normal', marginBottom: '12px', color: '#333', fontSize: '14px' }}>
                      {iterations.length === 0 ? 'Create your first scenario' : `Create scenario ${iterations.length + 1}`}
                    </div>

                    {/* Data selection checkboxes */}
                    {Object.keys(dataCollection).length > 0 && (
                      <div style={{
                        padding: '12px',
                        background: '#f5f5f5',
                        border: '1px solid #ccc',
                        borderRadius: '0',
                        marginBottom: '12px',
                        fontSize: '13px'
                      }}>
                        <div style={{ fontWeight: 'normal', marginBottom: '8px', color: '#333' }}>
                          1. Select relevant data:
                        </div>
                        {Object.entries(dataCollection).map(([stakeholder, items]) => (
                          items.length > 0 && (
                            <div key={stakeholder} style={{ marginBottom: '12px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'normal', marginBottom: '4px', color: '#666' }}>
                                From {stakeholder}:
                              </div>
                              {items.map(item => {
                                const dataKey = `${stakeholder}:${item.id}`;
                                return (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '6px 8px',
                                      marginBottom: '4px',
                                      background: '#fff',
                                      border: '1px solid #ccc',
                                      cursor: 'pointer',
                                      fontSize: '13px'
                                    }}
                                    onClick={() => toggleDataSelectionQ14(dataKey)}
                                  >
                                    <div style={{
                                      width: '16px',
                                      height: '16px',
                                      border: '1px solid #333',
                                      borderRadius: '2px',
                                      background: currentIteration.selectedData.includes(dataKey) ? '#333' : '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                      fontSize: '12px',
                                      flexShrink: 0
                                    }}>
                                      {currentIteration.selectedData.includes(dataKey) ? '✓' : ''}
                                    </div>
                                    <div style={{ flex: 1 }}>{item.text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ))}
                      </div>
                    )}

                    {/* What if input */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: 'normal', marginBottom: '6px', color: '#333', fontSize: '13px' }}>
                        2. What if scenario:
                      </div>
                      <textarea
                        value={currentIteration.whatIf}
                        onChange={(e) => setCurrentIteration(prev => ({ ...prev, whatIf: e.target.value }))}
                        placeholder="Describe a scenario using the data you selected above..."
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '0',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    {/* Now what input */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontWeight: 'normal', marginBottom: '6px', color: '#333', fontSize: '13px' }}>
                        3. Now what (what should happen):
                      </div>
                      <textarea
                        value={currentIteration.nowWhat}
                        onChange={(e) => setCurrentIteration(prev => ({ ...prev, nowWhat: e.target.value }))}
                        placeholder="Explain what should happen in this scenario..."
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '0',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    {/* Add iteration button */}
                    <button
                      onClick={addIteration}
                      disabled={currentIteration.selectedData.length === 0 || !currentIteration.whatIf.trim() || !currentIteration.nowWhat.trim()}
                      style={{
                        padding: '8px 16px',
                        background: (currentIteration.selectedData.length > 0 && currentIteration.whatIf.trim() && currentIteration.nowWhat.trim()) ? '#2196f3' : '#ccc',
                        color: 'white',
                        border: 'none',
                        cursor: (currentIteration.selectedData.length > 0 && currentIteration.whatIf.trim() && currentIteration.nowWhat.trim()) ? 'pointer' : 'not-allowed',
                        fontSize: '13px'
                      }}
                    >
                      Add Scenario
                    </button>
                  </div>
                )}

                {/* Status message */}
                {iterations.length >= 3 && iterations.length < 5 && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '0',
                    fontSize: '12px',
                    color: '#856404',
                    marginBottom: '12px'
                  }}>
                    You've completed {iterations.length} scenario{iterations.length > 1 ? 's' : ''}. You can add up to {5 - iterations.length} more, or proceed when ready.
                  </div>
                )}

                {iterations.length === 5 && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#d4edda',
                    border: '1px solid #28a745',
                    borderRadius: '0',
                    fontSize: '12px',
                    color: '#155724',
                    marginBottom: '12px'
                  }}>
                    Great work! You've completed 5 scenarios. You can proceed to finish.
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            {currentStep >= 1 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(1)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#666',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back
                  </button>
                )}
                {currentStep === 1 && (
                  <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!systemReflection.trim() || !userType1.trim()}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: (systemReflection.trim() && userType1.trim()) ? '#546e7a' : '#999',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      cursor: (systemReflection.trim() && userType1.trim()) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Next →
                  </button>
                )}
                {currentStep === 2 && (
                  <button
                    onClick={submitAssessment}
                    disabled={
                      !selectedScenarioAnswer ||
                      !selectedCancellationAnswer ||
                      !selectedInfoAnswer ||
                      iterations.length < 3 ||
                      isFinalSubmitting ||
                      submitSuccess
                    }
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: (
                        selectedScenarioAnswer &&
                        selectedCancellationAnswer &&
                        selectedInfoAnswer &&
                        iterations.length >= 3 &&
                        !isFinalSubmitting &&
                        !submitSuccess
                      ) ? '#2e7d32' : '#999',
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      cursor: (
                        selectedScenarioAnswer &&
                        selectedCancellationAnswer &&
                        selectedInfoAnswer &&
                        iterations.length >= 3 &&
                        !isFinalSubmitting &&
                        !submitSuccess
                      ) ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {submitSuccess ? '✓ Submitted' : isFinalSubmitting ? 'Submitting...' : 'Submit Assessment'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reservation;
