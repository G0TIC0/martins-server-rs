import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { demoStore } from '../lib/demo-store';

interface DemoContextType {
  isDemoMode: boolean;
  demoTimeLeft: number;
  startDemo: () => void;
  endDemo: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_DURATION = 30 * 60 * 1000; // 30 minutes in ms

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoTimeLeft, setDemoTimeLeft] = useState(0);

  const endDemo = useCallback(() => {
    localStorage.removeItem('demo_session');
    demoStore.clear();
    setIsDemoMode(false);
    setDemoTimeLeft(0);
  }, []);

  const startDemo = useCallback(() => {
    const startedAt = Date.now();
    localStorage.setItem('demo_session', JSON.stringify({ startedAt }));
    setIsDemoMode(true);
    setDemoTimeLeft(DEMO_DURATION);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('demo_session');
    if (session) {
      try {
        const { startedAt } = JSON.parse(session);
        const elapsed = Date.now() - startedAt;
        const remaining = DEMO_DURATION - elapsed;

        if (remaining > 0) {
          setIsDemoMode(true);
          setDemoTimeLeft(remaining);
        } else {
          endDemo();
        }
      } catch (e) {
        localStorage.removeItem('demo_session');
      }
    }
  }, [endDemo]);

  useEffect(() => {
    if (!isDemoMode) return;

    const interval = setInterval(() => {
      const session = localStorage.getItem('demo_session');
      if (session) {
        const { startedAt } = JSON.parse(session);
        const elapsed = Date.now() - startedAt;
        const remaining = DEMO_DURATION - elapsed;

        if (remaining <= 0) {
          endDemo();
        } else {
          setDemoTimeLeft(remaining);
        }
      } else {
        endDemo();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isDemoMode, endDemo]);

  return (
    <DemoContext.Provider value={{ isDemoMode, demoTimeLeft, startDemo, endDemo }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
