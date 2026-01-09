import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import 'katex/dist/katex.min.css';
import { 
  sendMessage, 
  logAttribute, 
  beginHelpingStudent, 
  testStudentCode,
  submitCostFunction,
  StakeholderAttribute,
  InterventionResponse,
  logExploratory,
  generateScaffoldedValues,
  getBugQueue,
  completeRun,
  switchMode,
  ScaffoldedValueOption,
  submitHypothesis,
  HypothesisResult
} from './chatService';

interface UserDropdown {
  id: number;
  selectedOption: string;
  customText: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

function Intervention() {
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
    value2: string;
    error: string;
  }
  
  const [interactionTests, setInteractionTests] = useState<InteractionTest[]>([
    { id: 1, stakeholder: '', attribute: '', value: '', value2: '', error: '' }
  ]);
  const [hasReceivedLLMMessage, setHasReceivedLLMMessage] = useState(false);
  const [showDistanceTool, setShowDistanceTool] = useState(false);
  
  // Intervention state
  const [isHelping, setIsHelping] = useState(false);
  const [showCostFunctionPopup, setShowCostFunctionPopup] = useState(false);
  const [showBugPrompt, setShowBugPrompt] = useState(false);
  const [showRunSimPopup, setShowRunSimPopup] = useState(false);
  const [sentScaffoldedTests, setSentScaffoldedTests] = useState<Array<{ stakeholder: string; attribute: string; value: string }>>([]);
  const [scaffoldedSelections, setScaffoldedSelections] = useState<Record<string, string>>({});
  const [costFunctionTarget, setCostFunctionTarget] = useState('');
  const [ioPairs, setIoPairs] = useState<Array<{ stakeholder: string; attribute: string; value: string }>>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  
  // Run tracking & bug queue
  const [runNumber, setRunNumber] = useState(1);
  const [scaffoldedValues, setScaffoldedValues] = useState<ScaffoldedValueOption[]>([]);
  const [currentMode, setCurrentMode] = useState<'helping' | 'exploratory'>('helping');
  
  // Exploratory mode state
  const [exploratoryTests, setExploratoryTests] = useState<Array<{
    id: number;
    stakeholder: string;
    attribute: string;
    value: string;
  }>>([]);
  const [selectedJustification, setSelectedJustification] = useState('');
  const [showJustificationMCQ, setShowJustificationMCQ] = useState(false);
  const [pendingTestCases, setPendingTestCases] = useState<Array<{stakeholder: string; attribute: string; value: string}>>([]);
  const [hasRunInitialTest, setHasRunInitialTest] = useState(false);
  
  // MCQ justification options
  const justificationOptions = [
    "These values test boundary conditions",
    "These values test an edge case with distance/position",
    "These values test timing constraints",
    "These values test resource availability",
    "These values test conflicting requirements",
    "These values test a rare but valid scenario"
  ];
  
  // Chat state - initial student message
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hey! I'm working on a rideshare matching algorithm but I think there's a bug somewhere. Can you help me test it? Choose which riders and vehicles you want me to include in my test cases, and I'll show you what happens!"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [turnNumber, setTurnNumber] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Get session info from localStorage
  const studyId = parseInt(localStorage.getItem('studyId') || '0');
  const participantId = localStorage.getItem('participantId') || 'test';
  
  // Pre-fill test data when using "test" participant
  useEffect(() => {
    if (participantId === 'test') {
      // Sample stakeholder-attribute pairs for quick testing (no values - those come from LLM)
      setInteractionTests([
        { id: 1, stakeholder: 'rider_1', attribute: 'pickup_location', value: '', value2: '', error: '' },
        { id: 2, stakeholder: 'rider_1', attribute: 'destination', value: '', value2: '', error: '' },
        { id: 3, stakeholder: 'vehicle_1', attribute: 'car_current_location', value: '', value2: '', error: '' },
        { id: 4, stakeholder: 'vehicle_1', attribute: 'battery', value: '', value2: '', error: '' },
        { id: 5, stakeholder: 'rider_1', attribute: 'request_time', value: '', value2: '', error: '' }
      ]);
    }
  }, [participantId]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending) return;
    
    const userMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: chatInput.trim()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSending(true);
    
    try {
      const response = await sendMessage(
        userMessage.content,
        studyId,
        participantId,
        turnNumber
      );
      
      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      setTurnNumber(response.turn_number);
      setHasReceivedLLMMessage(true);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  const [distanceStakeholder1, setDistanceStakeholder1] = useState('');
  const [distanceStakeholder2, setDistanceStakeholder2] = useState('');
  const [distanceResult, setDistanceResult] = useState<number | null>(null);
  
  const isLocationAttribute = (attr: string) => 
    ['pickup_location', 'destination', 'car_current_location', 'end_early'].includes(attr);
  
  const isTimeAttribute = (attr: string) => 
    ['request_time', 'eta_vehicle', 'eta_destination'].includes(attr);
  
  const isBinaryAttribute = (attr: string) => 
    ['accessible', 'occupied', 'assigned', 'traffic_delay', 'cancels', 'change_destination', 'end_early'].includes(attr);
  
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
  
  const getFormattedValue = (attribute: string, value: string): string => {
    if (!value) return '';
    if (isLocationAttribute(attribute)) return `(${value})`;
    if (isTimeAttribute(attribute)) return `T+${value}`;
    if (attribute === 'battery') return `${value}/100`;
    return value;
  };
  
  // Get scaffolded value options for a stakeholder-attribute pair
  const getScaffoldedOptions = (stakeholder: string, attribute: string): string[] => {
    const match = scaffoldedValues.find(
      sv => sv.stakeholder === stakeholder && sv.attribute === attribute
    );
    return match?.options || [];
  };
  
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
  
  const getStakeholdersWithCoords = () => {
    return [...new Set(interactionTests
      .filter(t => t.stakeholder && isLocationAttribute(t.attribute) && t.value && !t.error)
      .map(t => t.stakeholder))];
  };
  
  const getSimulationEntities = () => {
    const entities: { type: string; stakeholder: string; location: string; isDestination: boolean; callouts: string[] }[] = [];
    
    interactionTests.filter(t => t.stakeholder && t.attribute && t.value && !t.error).forEach(test => {
      const isDestAttr = test.attribute === 'destination';
      const isDestEta = test.attribute === 'eta_destination';
      const isMainLocAttr = (test.attribute === 'pickup_location' || test.attribute === 'car_current_location');
      
      if (isDestAttr) {
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
    
    entities.sort((a, b) => {
      if (a.stakeholder !== b.stakeholder) return a.stakeholder.localeCompare(b.stakeholder);
      return a.isDestination ? 1 : -1;
    });
    
    return entities;
  };

  useEffect(() => {
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
    return { x: 10, y: 10 };
  };

  const getIconPosition = (coordString: string) => {
    const coords = parseCoordinates(coordString);
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
    setErrorMessage('');
  };

  const handleCustomTextChange = (id: number, value: string) => {
    setDropdowns(dropdowns.map(dropdown => 
      dropdown.id === id ? { ...dropdown, customText: value } : dropdown
    ));
    setErrorMessage('');
  };

  const completeUsers = dropdowns.filter(d => d.selectedOption && d.customText).length;
  const isButtonEnabled = completeUsers >= 2;

  const handleBeginHelping = () => {
    const completeDropdowns = dropdowns.filter(d => d.selectedOption && d.customText);
    const uniqueCategories = new Set(completeDropdowns.map(d => d.selectedOption));
    
    if (uniqueCategories.size < 2) {
      setErrorMessage("You must select two or more distinct categories");
      return;
    }
    
    setErrorMessage('');
    console.log('Proceeding with simulation', completeDropdowns);
  };

  // Log attribute add/delete to backend
  const handleLogAttribute = async (stakeholder: string, attribute: string, action: 'add' | 'delete') => {
    if (!stakeholder || !attribute) return;
    try {
      await logAttribute(studyId, participantId, stakeholder, attribute, action, turnNumber);
    } catch (error) {
      console.error('Failed to log attribute:', error);
    }
  };

  // Begin helping student - main intervention start
  const handleBeginHelpingStudent = async () => {
    const validTests = interactionTests.filter(t => t.stakeholder && t.attribute);
    if (validTests.length === 0) {
      setErrorMessage("Please add at least one stakeholder-attribute pair");
      return;
    }
    
    setIsHelping(true);
    setShowCostFunctionPopup(true); // Show cost function selection while API call happens
    
    try {
      const stakeholderAttributes: StakeholderAttribute[] = validTests.map(t => ({
        stakeholder: t.stakeholder,
        attribute: t.attribute,
        value: t.value,
        value2: t.value2
      }));
      
      const response = await beginHelpingStudent(
        studyId,
        participantId,
        turnNumber,
        stakeholderAttributes
      );
      
      if (response.success && response.student_message) {
        // Add student message to chat
        const studentMessage: ChatMessage = {
          id: Date.now(),
          role: 'assistant',
          content: response.student_message
        };
        setChatMessages(prev => [...prev, studentMessage]);
        
        // Store IO pairs for display and testing
        if (response.io_pairs?.io_pairs) {
          setIoPairs(response.io_pairs.io_pairs);
          
          // Add formatted IO pairs as separate message
          const pairsMessage: ChatMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: `__TEST_SCENARIO__${JSON.stringify({
              pairs: response.io_pairs.io_pairs,
              result: response.io_pairs.test_result || 'Tests passed'
            })}`
          };
          setChatMessages(prev => [...prev, pairsMessage]);
        }
        
        setHasReceivedLLMMessage(true);
        setTurnNumber(prev => prev + 1);
        
        // Populate interactionTests with LLM's values so they show on grid
        if (response.io_pairs && response.io_pairs.length > 0) {
          setInteractionTests(response.io_pairs.map((p: any, i: number) => ({
            id: i + 1,
            stakeholder: p.stakeholder,
            attribute: p.attribute,
            value: p.value,
            value2: '',
            error: ''
          })));
        }
        
        // Fetch scaffolded value options for later
        try {
          const scaffoldedResponse = await generateScaffoldedValues(
            studyId,
            participantId,
            turnNumber + 1,
            runNumber
          );
          if (scaffoldedResponse.scaffolded_values?.value_options) {
            setScaffoldedValues(scaffoldedResponse.scaffolded_values.value_options);
            setScaffoldedSelections({}); // Reset selections when new values come in
            setSentScaffoldedTests([]); // Reset sent tests
          }
        } catch (err) {
          console.error('Failed to get scaffolded values:', err);
        }
        
        // Auto-toggle to exploratory mode after API returns
        setCurrentMode('exploratory');
        setHasRunInitialTest(true);
      }
    } catch (error) {
      console.error('Failed to begin helping:', error);
      setErrorMessage("Failed to start session");
    } finally {
      setIsHelping(false);
    }
  };

  // Handle mode toggle
  const handleModeToggle = async () => {
    const newMode = currentMode === 'helping' ? 'exploratory' : 'helping';
    try {
      await switchMode(studyId, participantId, runNumber, newMode);
      setCurrentMode(newMode);
    } catch (error) {
      console.error('Failed to switch mode:', error);
    }
  };

  // Log exploratory add/delete
  const handleExploratoryLog = async (action: 'add' | 'delete', stakeholder: string, attribute: string, value?: string) => {
    try {
      await logExploratory(studyId, participantId, runNumber, action, {
        stakeholder,
        attribute,
        value
      });
    } catch (error) {
      console.error('Failed to log exploratory action:', error);
    }
  };

  // Send scaffolded tests to student → update grid → student responds → show SEND button
  const handleSendScaffoldedTests = async () => {
    // Collect all selected scaffolded values from the separate state
    const selectedTests = scaffoldedValues
      .map(sv => {
        const key = `${sv.stakeholder}-${sv.attribute}`;
        const value = scaffoldedSelections[key];
        return value ? { stakeholder: sv.stakeholder, attribute: sv.attribute, value } : null;
      })
      .filter(Boolean) as Array<{ stakeholder: string; attribute: string; value: string }>;
    
    if (selectedTests.length === 0) {
      setErrorMessage("Select values for all test cases");
      return;
    }
    
    setIsSending(true);
    
    // NOW update the grid with selected values (only after clicking send)
    setInteractionTests(prev => prev.map(test => {
      const match = selectedTests.find(s => s.stakeholder === test.stakeholder && s.attribute === test.attribute);
      return match ? { ...test, value: match.value } : test;
    }));
    
    // Store sent tests for later comparison
    setSentScaffoldedTests(selectedTests);
    
    // Add participant's test message to chat (shows all at once)
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: `__TEST_SCENARIO__${JSON.stringify({ pairs: selectedTests, result: "Sent to student" })}`
    }]);
    
    // Alex responds with one message
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: "Okay, I'll run my code with these test values. Click 'Send' to tell me what you expect to happen!"
      }]);
      
      // Store test cases for hypothesis
      setPendingTestCases(selectedTests);
      setIsSending(false);
    }, 800);
  };

  // Submit hypothesis with MCQ justification (API #3)
  const handleSubmitHypothesis = async () => {
    if (pendingTestCases.length === 0) {
      setErrorMessage("No test cases pending");
      return;
    }
    if (!selectedJustification) {
      setErrorMessage("Select a justification");
      return;
    }

    setIsSending(true);
    setShowJustificationMCQ(false);
    
    try {
      const result = await submitHypothesis(
        studyId,
        participantId,
        runNumber,
        turnNumber,
        pendingTestCases,
        selectedJustification,
        ""
      );
      
      // Visual feedback
      const feedbackContent = `__TUTOR_FEEDBACK__${JSON.stringify({
        bug_exposed: result.bug_exposed,
        test_values: validTests,
        justification: selectedJustification,
        hint: result.hint,
        feedback: result.feedback
      })}`;
      
      setChatMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: feedbackContent
      }]);
      
      if (result.bug_exposed) {
        // CORRECT → advance to next bug
        setChatMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: "🎉 Correct! You found the bug. Moving to next bug..."
        }]);
        
        // Auto-advance to next bug after short delay
        setTimeout(async () => {
          const completeResult = await completeRun(studyId, participantId, runNumber, true);
          setRunNumber(completeResult.next_run);
          setHasReceivedLLMMessage(false);
          setIoPairs([]);
          setScaffoldedValues([]);
          setScaffoldedSelections({});
          setSentScaffoldedTests([]);
          setCurrentMode('helping');
          setSelectedJustification('');
          setPendingTestCases([]);
          setShowJustificationMCQ(false);
          setHasRunInitialTest(false);
          setSimulationResult(null);
          // Reset to initial S-A selection
          setInteractionTests([
            { id: 1, stakeholder: 'rider_1', attribute: 'pickup_location', value: '', value2: '', error: '' },
            { id: 2, stakeholder: 'rider_1', attribute: 'destination', value: '', value2: '', error: '' },
            { id: 3, stakeholder: 'vehicle_1', attribute: 'car_current_location', value: '', value2: '', error: '' }
          ]);
        }, 1500);
      } else {
        // INCORRECT → force back to exploratory mode
        setChatMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          content: "❌ Not quite. Switch to Exploratory mode to test more scenarios."
        }]);
        setCurrentMode('exploratory');
        setPendingTestCases([]);
      }
      
      setTurnNumber(prev => prev + 1);
      setSelectedJustification('');
    } catch (error) {
      console.error('Failed to submit hypothesis:', error);
      setErrorMessage("Failed to submit hypothesis");
    } finally {
      setIsSending(false);
    }
  };

  // Complete current run and move to next bug
  const handleCompleteRun = async (bugFound: boolean) => {
    try {
      const result = await completeRun(studyId, participantId, runNumber, bugFound);
      
      // Add completion message to chat
      const completionMessage: ChatMessage = {
        id: Date.now(),
        role: 'assistant',
        content: result.message
      };
      setChatMessages(prev => [...prev, completionMessage]);
      
      // Reset for next run
      setRunNumber(result.next_run);
      setHasReceivedLLMMessage(false);
      setIoPairs([]);
      setScaffoldedValues([]);
      setScaffoldedSelections({});
      setSentScaffoldedTests([]);
      setInteractionTests([{ id: 1, stakeholder: '', attribute: '', value: '', value2: '', error: '' }]);
      setCurrentMode('helping');
    } catch (error) {
      console.error('Failed to complete run:', error);
    }
  };

  // Submit cost function selection
  const handleSubmitCostFunction = async () => {
    // Hide popup immediately and show typing
    setShowCostFunctionPopup(false);
    setIsSending(true);
    
    try {
      await submitCostFunction(
        studyId,
        participantId,
        turnNumber,
        costFunctionTarget
      );
    } catch (error) {
      console.error('Failed to submit cost function:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Test student code with simulation
  const handleTestStudentCode = async () => {
    // Use the LLM-provided IO pairs if available, otherwise use user-entered values
    let testCases: StakeholderAttribute[];
    
    if (ioPairs.length > 0 && currentMode === 'helping') {
      // Use LLM-provided test values and populate interactionTests for display
      testCases = ioPairs.map(p => ({
        stakeholder: p.stakeholder,
        attribute: p.attribute,
        value: p.value
      }));
      
      // Update interactionTests so simulation grid shows the LLM's values
      setInteractionTests(ioPairs.map((p, i) => ({
        id: i + 1,
        stakeholder: p.stakeholder,
        attribute: p.attribute,
        value: p.value,
        value2: '',
        error: ''
      })));
    } else {
      // Use user-entered values (exploratory mode)
      const validTests = interactionTests.filter(t => t.stakeholder && t.attribute && t.value);
      if (validTests.length === 0) {
        setErrorMessage("No test values available");
        return;
      }
      testCases = validTests.map(t => ({
        stakeholder: t.stakeholder,
        attribute: t.attribute,
        value: t.value,
        value2: t.value2
      }));
    }
    
    setIsSending(true);
    
    try {
      const response = await testStudentCode(
        studyId,
        participantId,
        turnNumber,
        testCases
      );
      
      if (response.success) {
        setSimulationResult(response.simulation_result);
        
        // Add simulation result message
        setChatMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: `__SIM_RESULT__${JSON.stringify(response.simulation_result)}`
        }]);
        
        // After first test, show "passed but bug exists" and auto-switch to exploratory
        if (currentMode === 'helping' && !hasRunInitialTest) {
          setHasRunInitialTest(true);
          setChatMessages(prev => [...prev, {
            id: Date.now() + 1,
            role: 'assistant',
            content: `__BUG_PROMPT__My code passed all these tests, but the autograder says there's still a bug! Can you help me figure out what's wrong? Try different test values to find the edge case.`
          }]);
          // Auto-switch to exploratory mode
          setCurrentMode('exploratory');
        }
        
        setTurnNumber(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to test student code:', error);
      setErrorMessage("Failed to run simulation");
    } finally {
      setIsSending(false);
    }
  };

  const parseInlineFormatting = (text: string): JSX.Element[] => {
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
      
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={index} style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '15px', marginBottom: '10px' }}>
            {line.substring(2)}
          </h2>
        );
      }
      else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={index} style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', marginBottom: '8px' }}>
            {line.substring(3)}
          </h3>
        );
      }
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
              <span style={{ fontSize: '10px', color: '#666', marginLeft: '8px' }}>Run #{runNumber}</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
              <span style={{ color: currentMode === 'helping' ? '#007bff' : '#999' }}>Helping</span>
              <button
                onClick={handleModeToggle}
                disabled={!hasReceivedLLMMessage}
                style={{
                  width: '28px',
                  height: '14px',
                  borderRadius: '7px',
                  border: '1px solid #ccc',
                  backgroundColor: currentMode === 'exploratory' ? '#007bff' : '#e0e0e0',
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
                  left: currentMode === 'exploratory' ? '15px' : '1px',
                  transition: 'left 0.2s'
                }} />
              </button>
              <span style={{ color: currentMode === 'exploratory' ? '#007bff' : '#999' }}>Exploratory</span>
            </div>
          </div>
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
                  Reasoning:
                </label>
                <textarea
                  value={interactions}
                  onChange={(e) => setInteractions(e.target.value)}
                  placeholder="Describe reasoning..."
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
                  onChange={(e) => {
                    const newAttribute = e.target.value;
                    // Log add if we now have both stakeholder and attribute
                    if (test.stakeholder && newAttribute) {
                      handleLogAttribute(test.stakeholder, newAttribute, 'add');
                    }
                    setInteractionTests(interactionTests.map(t => 
                      t.id === test.id ? { ...t, attribute: newAttribute, value: '', value2: '', error: '' } : t
                    ));
                  }}
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
                
                {isCoord ? (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                    <span>(</span>
                    {getScaffoldedOptions(test.stakeholder, test.attribute).length > 0 ? (
                      <select
                        value={test.value}
                        onChange={(e) => {
                          setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value, error: '' } : t
                          ));
                          if (currentMode === 'exploratory') {
                            handleExploratoryLog('add', test.stakeholder, test.attribute, e.target.value);
                          }
                        }}
                        disabled={!hasReceivedLLMMessage || !test.attribute}
                        style={{ width: '55px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                      >
                        <option value="">--</option>
                        {getScaffoldedOptions(test.stakeholder, test.attribute).map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={test.value}
                        onChange={(e) => {
                          const error = validateValue(test.attribute, e.target.value);
                          setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value, error } : t
                          ));
                        }}
                        disabled={!hasReceivedLLMMessage || !test.attribute}
                        placeholder="x,y"
                        style={{ width: '40px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                      />
                    )}
                    <span>)</span>
                      </div>
                ) : isTime ? (
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '9px' }}>
                    <span>T+</span>
                    {getScaffoldedOptions(test.stakeholder, test.attribute).length > 0 ? (
                      <select
                        value={test.value}
                        onChange={(e) => {
                          setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value, error: '' } : t
                          ));
                          if (currentMode === 'exploratory') {
                            handleExploratoryLog('add', test.stakeholder, test.attribute, e.target.value);
                          }
                        }}
                        disabled={!hasReceivedLLMMessage || !test.attribute}
                        style={{ width: '45px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                      >
                        <option value="">--</option>
                        {getScaffoldedOptions(test.stakeholder, test.attribute).map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={test.value}
                        onChange={(e) => {
                          const error = validateValue(test.attribute, e.target.value);
                          setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value: e.target.value, error } : t
                          ));
                        }}
                        disabled={!hasReceivedLLMMessage || !test.attribute}
                        placeholder="0"
                        style={{ width: '30px', padding: '2px', fontSize: '9px', border: '1px solid #ccc', textAlign: 'center' }}
                      />
                    )}
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
                      disabled={!hasReceivedLLMMessage || !test.attribute}
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
                      disabled={!hasReceivedLLMMessage}
                      style={{ width: '50px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                    >
                      <option value="">--</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                    {test.attribute === 'assigned' && test.value === 'true' && (
                      <select
                        value={test.value2}
                        onChange={(e) => setInteractionTests(interactionTests.map(t => 
                          t.id === test.id ? { ...t, value2: e.target.value } : t
                        ))}
                        disabled={!hasReceivedLLMMessage}
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
                    {test.attribute === 'end_early' && test.value === 'true' && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span>(</span>
                        <input
                          type="text"
                          value={test.value2}
                          onChange={(e) => setInteractionTests(interactionTests.map(t => 
                            t.id === test.id ? { ...t, value2: e.target.value } : t
                          ))}
                          disabled={!hasReceivedLLMMessage}
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
                    disabled={!hasReceivedLLMMessage || !test.attribute}
                    placeholder="val"
                    style={{ width: '50px', padding: '2px', fontSize: '9px', border: '1px solid #ccc' }}
                  />
                )}
                
                <button
                  onClick={() => {
                    // Log delete action if stakeholder and attribute were set
                    if (test.stakeholder && test.attribute) {
                      handleLogAttribute(test.stakeholder, test.attribute, 'delete');
                    }
                    setInteractionTests(interactionTests.filter(t => t.id !== test.id));
                  }}
                  style={{ padding: '2px 5px', fontSize: '10px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer', color: '#d32f2f' }}
                >
                  ×
                </button>
                
                {test.error && <span style={{ fontSize: '8px', color: '#f44336' }}>⚠{test.error}</span>}
                </div>
              );
            })}
            
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
          
          {errorMessage && (
            <div style={{ color: '#d32f2f', fontSize: '11px', marginTop: '8px' }}>
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleBeginHelpingStudent}
            disabled={isHelping || hasReceivedLLMMessage}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '1px solid #ccc',
              backgroundColor: isHelping ? '#ccc' : '#007bff',
              color: 'white',
              cursor: isHelping || hasReceivedLLMMessage ? 'not-allowed' : 'pointer',
              opacity: hasReceivedLLMMessage ? 0.5 : 1
            }}
          >
            {isHelping ? 'Starting...' : 'BEGIN HELPING STUDENT'}
          </button>

          
          {/* EXPLORATORY MODE: Free value editing + simulate */}
          {hasReceivedLLMMessage && currentMode === 'exploratory' && (
            <button
              onClick={async () => {
                const validTests = interactionTests.filter(t => t.stakeholder && t.attribute && t.value && !t.error);
                if (validTests.length === 0) {
                  setErrorMessage("Add test values first");
                  return;
                }
                
                // Log exploratory test run
                for (const test of validTests) {
                  await logExploratory(studyId, participantId, runNumber, 'test_run', {
                    stakeholder: test.stakeholder,
                    attribute: test.attribute,
                    value: test.value
                  });
                }
                
                // Run simulation
                setIsSending(true);
                try {
                  const testCases = validTests.map(t => ({
                    stakeholder: t.stakeholder,
                    attribute: t.attribute,
                    value: t.value
                  }));
                  
                  const response = await testStudentCode(
                    studyId,
                    participantId,
                    turnNumber,
                    testCases
                  );
                  
                  if (response.success) {
                    setSimulationResult(response.simulation_result);
                    
                    // Add result to chat
                    setChatMessages(prev => [...prev, {
                      id: Date.now(),
                      role: 'assistant',
                      content: `__SIM_RESULT__${JSON.stringify(response.simulation_result)}`
                    }]);
                    
                    setTurnNumber(prev => prev + 1);
                  }
                } catch (error) {
                  console.error('Failed to run simulation:', error);
                  setErrorMessage("Failed to run simulation");
                } finally {
                  setIsSending(false);
                }
              }}
              disabled={isSending}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: '1px solid #2196f3',
                backgroundColor: isSending ? '#ccc' : '#2196f3',
                color: 'white',
                cursor: isSending ? 'not-allowed' : 'pointer'
              }}
            >
              {isSending ? 'Running...' : 'SIMULATE SCENARIO WITH TESTS'}
            </button>
          )}
          
          {/* HELPING MODE: Send scaffolded tests to student - only after initial test */}
          {hasReceivedLLMMessage && hasRunInitialTest && currentMode === 'helping' && scaffoldedValues.length > 0 && (
            <div style={{ marginTop: '8px', border: '1px solid #4caf50', padding: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#2e7d32' }}>
                Select Test Values to Send
              </div>
              
              {/* Scaffolded S-A-V selection - uses separate state, doesn't update grid */}
              <div style={{ marginBottom: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                {scaffoldedValues.map((sv, i) => {
                  const key = `${sv.stakeholder}-${sv.attribute}`;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '10px' }}>
                      <span style={{ width: '80px', fontWeight: 'bold' }}>{sv.stakeholder}</span>
                      <span style={{ width: '80px', color: '#666' }}>{sv.attribute}</span>
                      <select
                        value={scaffoldedSelections[key] || ''}
                        onChange={(e) => {
                          setScaffoldedSelections(prev => ({
                            ...prev,
                            [key]: e.target.value
                          }));
                        }}
                        style={{ flex: 1, padding: '3px', fontSize: '10px', border: '1px solid #ccc' }}
                      >
                        <option value="">-- select --</option>
                        {sv.options.map((opt, j) => (
                          <option key={j} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              
              {sentScaffoldedTests.length === 0 ? (
                <button
                  onClick={handleSendScaffoldedTests}
                  disabled={isSending}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '1px solid #4caf50',
                    backgroundColor: isSending ? '#ccc' : '#4caf50',
                    color: 'white',
                    cursor: isSending ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSending ? 'Sending...' : 'SEND TESTS TO STUDENT'}
                </button>
              ) : (
                <button
                  onClick={() => setShowRunSimPopup(true)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    border: '1px solid #4caf50',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  SEND
                </button>
              )}
            </div>
          )}

        </div>
      </div>
      <div className="container container-3" style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
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
              Start the conversation with Alex
            </div>
          )}
          {chatMessages.map(msg => {
            // Check if this is a test scenario message
            if (msg.content.startsWith('__TEST_SCENARIO__')) {
              const data = JSON.parse(msg.content.replace('__TEST_SCENARIO__', ''));
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#f0f7ff',
                    border: '1px solid #007bff',
                    padding: '12px',
                    maxWidth: '85%',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#007bff' }}>
                    📋 Test Scenario
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e3f2fd' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Entity</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Attribute</th>
                        <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ccc' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pairs.map((p: any, i: number) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{p.stakeholder}</td>
                          <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{p.attribute}</td>
                          <td style={{ padding: '4px 8px', border: '1px solid #ccc', fontFamily: 'monospace' }}>{p.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#e8f5e9', border: '1px solid #4caf50', fontSize: '11px' }}>
                    ✅ <strong>Result:</strong> {data.result}
                  </div>
                  
                  {/* Button to display student's values on the simulation grid */}
                  <button
                    onClick={() => {
                      // Populate the grid with student's values
                      setInteractionTests(prev => prev.map(test => {
                        const match = data.pairs.find((p: any) => 
                          p.stakeholder === test.stakeholder && p.attribute === test.attribute
                        );
                        return match ? { ...test, value: String(match.value) } : test;
                      }));
                      
                      // Store the test cases and show justification MCQ
                      setPendingTestCases(data.pairs);
                      setShowJustificationMCQ(true);
                    }}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      padding: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '1px solid #4caf50',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    ▶ SHOW ON GRID
                  </button>
                </div>
              );
            }
            
            // Check if this is a bug prompt message
            if (msg.content.startsWith('__BUG_PROMPT__')) {
              const text = msg.content.replace('__BUG_PROMPT__', '');
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#fff3e0',
                    border: '2px solid #ff9800',
                    padding: '12px',
                    maxWidth: '90%',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#e65100' }}>
                    ⚠️ Tests Passed - But Bug Exists!
                  </div>
                  <div>{parseInlineFormatting(text)}</div>
                </div>
              );
            }
            
            // Check if this is a tutor feedback message
            if (msg.content.startsWith('__TUTOR_FEEDBACK__')) {
              const data = JSON.parse(msg.content.replace('__TUTOR_FEEDBACK__', ''));
              const { bug_exposed, test_values, justification, feedback, hint } = data;
              
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: bug_exposed ? '#e8f5e9' : '#ffebee',
                    border: `2px solid ${bug_exposed ? '#4caf50' : '#f44336'}`,
                    padding: '12px',
                    maxWidth: '90%',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: bug_exposed ? '#2e7d32' : '#c62828' }}>
                    {bug_exposed ? '✅ Correct! Bug Exposed' : '❌ Incorrect - Bug Not Exposed'}
                  </div>
                  
                  {/* Show their test values with indicators */}
                  <div style={{ marginBottom: '8px', fontSize: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Your test values:</div>
                    {test_values?.map((tv: any, i: number) => (
                      <div key={i} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        padding: '2px 4px',
                        backgroundColor: bug_exposed ? '#c8e6c9' : '#ffcdd2',
                        marginBottom: '2px'
                      }}>
                        <span style={{ color: bug_exposed ? '#2e7d32' : '#c62828' }}>
                          {bug_exposed ? '✓' : '✗'}
                        </span>
                        <span>{tv.stakeholder}.{tv.attribute} = {tv.value}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>
                    <em>Your reasoning: {justification}</em>
                  </div>
                  
                  <div style={{ fontSize: '11px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.7)' }}>
                    {feedback}
                  </div>
                  
                  {!bug_exposed && hint && (
                    <div style={{ fontSize: '11px', marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                      <strong>💡 Hint:</strong> {hint}
                    </div>
                  )}
                </div>
              );
            }
            
            // Check if this is a simulation result message
            if (msg.content.startsWith('__SIM_RESULT__')) {
              const result = JSON.parse(msg.content.replace('__SIM_RESULT__', ''));
              const passed = result?.test_passed;
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: passed ? '#e8f5e9' : '#ffebee',
                    border: `1px solid ${passed ? '#4caf50' : '#f44336'}`,
                    padding: '12px',
                    maxWidth: '85%',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: passed ? '#2e7d32' : '#c62828' }}>
                    {passed ? '✅ Tests Passed' : '❌ Test Failed'}
                  </div>
                  {passed ? (
                    <div style={{ fontSize: '11px' }}>
                      <div>Requests fulfilled: {result.metrics?.fulfilled_requests || 0}</div>
                      <div>Avg wait: {result.metrics?.avg_wait_time?.toFixed(1) || 0} min</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px' }}>
                      {result?.bug_triggered ? 'Bug detected in student code!' : 'Unexpected behavior found.'}
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
                  maxWidth: '80%',
                  fontSize: '12px',
                  border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none'
                }}
              >
                {msg.content}
              </div>
            );
          })}
          {(isSending || isHelping) && (
            <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: '11px' }}>
              Alex is typing...
            </div>
          )}
          
          {/* MCQ Justification - appears in chat after student asks "why?" */}
          {showJustificationMCQ && (
            <div style={{
              alignSelf: 'flex-end',
              backgroundColor: '#e3f2fd',
              border: '2px solid #2196f3',
              padding: '12px',
              maxWidth: '85%',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1565c0' }}>
                Select your reasoning:
              </div>
              <div style={{ marginBottom: '10px' }}>
                {justificationOptions.map((option, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="justification_chat"
                      checked={selectedJustification === option}
                      onChange={() => setSelectedJustification(option)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSubmitHypothesis}
                disabled={!selectedJustification || isSending}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  border: 'none',
                  backgroundColor: !selectedJustification || isSending ? '#ccc' : '#2196f3',
                  color: 'white',
                  cursor: !selectedJustification || isSending ? 'not-allowed' : 'pointer'
                }}
              >
                {isSending ? 'Checking...' : 'SUBMIT ANSWER'}
              </button>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
        
      </div>
      
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
      
      {showCostFunctionPopup && (
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
              padding: '20px',
              width: '400px',
              border: '1px solid #ccc'
            }}
          >
            <h3 style={{ marginTop: '0', marginBottom: '15px', fontSize: '14px' }}>
              What should the algorithm optimize for?
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                <input
                  type="radio"
                  name="costTarget"
                  value="minimize_wait"
                  checked={costFunctionTarget === 'minimize_wait'}
                  onChange={(e) => setCostFunctionTarget(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Minimize rider wait time
              </label>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                <input
                  type="radio"
                  name="costTarget"
                  value="maximize_profit"
                  checked={costFunctionTarget === 'maximize_profit'}
                  onChange={(e) => setCostFunctionTarget(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Maximize company profit
              </label>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                <input
                  type="radio"
                  name="costTarget"
                  value="balance"
                  checked={costFunctionTarget === 'balance'}
                  onChange={(e) => setCostFunctionTarget(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                Balance both
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={handleSubmitCostFunction}
                disabled={!costFunctionTarget}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  border: 'none',
                  backgroundColor: costFunctionTarget ? '#007bff' : '#ccc',
                  color: 'white',
                  cursor: costFunctionTarget ? 'pointer' : 'not-allowed'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showBugPrompt && (
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
              width: '400px',
              border: '2px solid #ff9800',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333' }}>
              Tests Pass, But There's Still a Bug!
            </h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px', lineHeight: '1.5' }}>
              The student's code passed these tests, but we know there's a hidden bug.
              <br /><br />
              <strong>Your task:</strong> Switch to <span style={{ color: '#007bff', fontWeight: 'bold' }}>Exploratory Mode</span> and 
              modify the test values to find inputs that expose the bug.
            </p>
            <div style={{ fontSize: '24px', marginBottom: '15px' }}>
              ⬆️ Change values above ⬆️
            </div>
            <button
              onClick={() => {
                setShowBugPrompt(false);
                setCurrentMode('exploratory');
              }}
              style={{
                padding: '10px 25px',
                fontSize: '13px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Got it - Start Exploring
            </button>
          </div>
        </div>
      )}
      
      {showRunSimPopup && (
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
              border: '1px solid #ccc'
            }}
          >
            <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
              What do you expect to happen?
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Expected Output:
              </label>
              <input
                type="text"
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                placeholder="e.g., Rider matched to closest vehicle"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                Why do you think these values expose a bug?
              </label>
              {justificationOptions.map((opt, i) => (
                <label key={i} style={{ display: 'block', marginBottom: '6px', fontSize: '11px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="justification"
                    value={opt}
                    checked={selectedJustification === opt}
                    onChange={() => setSelectedJustification(opt)}
                    style={{ marginRight: '8px' }}
                  />
                  {opt}
                </label>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRunSimPopup(false);
                  setExpectedOutput('');
                  setSelectedJustification('');
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!expectedOutput || !selectedJustification) {
                    setErrorMessage("Fill in expected output and justification");
                    return;
                  }
                  
                  // Close popup
                  setShowRunSimPopup(false);
                  
                  // Show what happened (from LLM's ioPairs - what student's code does)
                  const actualResult = ioPairs.length > 0 
                    ? "Student's code ran: " + ioPairs.map(p => `${p.stakeholder}.${p.attribute}=${p.value}`).join(', ')
                    : "Code executed with test values";
                  
                  // Add simulation result to chat
                  setChatMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'assistant',
                    content: `__SIM_RESULT__${JSON.stringify({
                      expected: expectedOutput,
                      actual: actualResult,
                      justification: selectedJustification,
                      test_passed: true
                    })}`
                  }]);
                  
                  // Store for hypothesis submission
                  setPendingTestCases(sentScaffoldedTests);
                  setShowJustificationMCQ(false);
                  
                  // Reset for next round
                  setSentScaffoldedTests([]);
                  setExpectedOutput('');
                }}
                disabled={!expectedOutput || !selectedJustification}
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  border: 'none',
                  backgroundColor: expectedOutput && selectedJustification ? '#ff9800' : '#ccc',
                  color: 'white',
                  cursor: expectedOutput && selectedJustification ? 'pointer' : 'not-allowed'
                }}
              >
                Run & Check
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

export default Intervention;
