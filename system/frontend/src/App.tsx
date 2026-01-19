import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Intervention from './Intervention';
import Assessment from './Assessment';
import TestVisualization from './TestVisualization';
import ParticipantExplorer from './ParticipantExplorer';
import Notes from './Notes';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/intervention" element={<Intervention />} />
        <Route path="/pre" element={<Assessment />} />
        <Route path="/test" element={<TestVisualization />} />
        <Route path="/explorer" element={<ParticipantExplorer />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
