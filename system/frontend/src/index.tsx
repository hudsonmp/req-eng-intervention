import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Landing from './Landing';
import PreAssessment from './PreAssessment';
import Intervention from './Intervention';
import PostAssessment from './PostAssessment';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/demo" element={<App />} />
      <Route path="/pre-assessment" element={<PreAssessment />} />
      <Route path="/intervention" element={<Intervention />} />
      <Route path="/post-assessment" element={<PostAssessment />} />
      <Route path="/" element={<Landing />} />
    </Routes>
  </BrowserRouter>
);
