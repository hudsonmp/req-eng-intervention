import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import 'katex/dist/katex.min.css';
import { AppContext, User } from './AppContext';
import { NavigationMenu } from './NavigationMenu';
import { PaperworkPage } from './PaperworkPage';
import { PreAssessmentPage } from './PreAssessmentPage';
import { PostAssessmentPage } from './PostAssessmentPage';
import { LearnModePage } from './LearnModePage';
import { SlideViewer } from './SlideViewer';
import { MockupPage } from './MockupPage';
import { SimulationPage } from './SimulationPage';

function App() {
  const defaultUser: User = { id: 'dev', subject_number: 0, preferred_name: 'Dev' };
  const [user] = useState<User | null>(defaultUser);
  const [studyStartTime] = useState<number | null>(Date.now());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    if (studyStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - studyStartTime) / 60000);
        setElapsedMinutes(elapsed);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [studyStartTime]);

  return (
    <AppContext.Provider value={{ user, studyStartTime, elapsedMinutes }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<NavigationMenu />} />
          <Route path="/paperwork" element={<PaperworkPage />} />
          <Route path="/pre-assessment" element={<PreAssessmentPage />} />
          <Route path="/learn" element={<LearnModePage />} />
          <Route path="/post-assessment" element={<PostAssessmentPage />} />
          <Route path="/slides" element={<SlideViewer />} />
          <Route path="/mockup" element={<MockupPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
