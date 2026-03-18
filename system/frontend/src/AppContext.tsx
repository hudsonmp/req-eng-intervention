import React from 'react';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface User {
  id: string;
  subject_number: number;
  preferred_name: string;
}

export interface AppContextType {
  user: User | null;
  studyStartTime: number | null;
  elapsedMinutes: number;
}

export const AppContext = React.createContext<AppContextType>({
  user: null,
  studyStartTime: null,
  elapsedMinutes: 0
});
