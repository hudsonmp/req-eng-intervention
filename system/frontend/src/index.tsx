import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/demo" element={<App />} />
      <Route path="/" element={<Navigate to="/demo" replace />} />
    </Routes>
  </BrowserRouter>
);
