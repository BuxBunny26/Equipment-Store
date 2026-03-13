import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { personnelApi, usersApi } from '../services/api';

const OperatorContext = createContext();

const STORAGE_KEY = 'equipment_store_operator';
const ACTIVITY_KEY = 'equipment_store_last_activity';
const ROLE_KEY = 'equipment_store_operator_role';
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function OperatorProvider({ children }) {
  const [operator, setOperator] = useState(null);
  const [operatorRole, setOperatorRole] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load personnel list on mount
  useEffect(() => {
    loadPersonnel();
  }, []);

  // Load saved operator from localStorage (check inactivity)
  useEffect(() => {
    const savedOperator = localStorage.getItem(STORAGE_KEY);
    const lastActivity = localStorage.getItem(ACTIVITY_KEY);
    if (savedOperator) {
      try {
        const parsed = JSON.parse(savedOperator);
        // Check if session has expired due to inactivity
        if (lastActivity && (Date.now() - parseInt(lastActivity, 10)) > INACTIVITY_TIMEOUT) {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          localStorage.removeItem(ROLE_KEY);
        } else {
          setOperator(parsed);
          setOperatorRole(localStorage.getItem(ROLE_KEY));
          localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVITY_KEY);
        localStorage.removeItem(ROLE_KEY);
      }
    }
  }, []);

  // Track user activity to reset inactivity timer
  const updateActivity = useCallback(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
    }
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, updateActivity));
  }, [updateActivity]);

  // Periodically check for inactivity while app is open
  useEffect(() => {
    const interval = setInterval(() => {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      if (operator && lastActivity && (Date.now() - parseInt(lastActivity, 10)) > INACTIVITY_TIMEOUT) {
        clearOperator();
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [operator]);

  const loadPersonnel = async () => {
    try {
      const response = await personnelApi.getAll(true);
      setPersonnel(response.data);
    } catch (error) {
      console.error('Failed to load personnel:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectOperator = async (person) => {
    setOperator(person);
    if (person) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(person));
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
      // Fetch user role by personnel_id
      try {
        const res = await usersApi.getAll({ search: '' });
        const user = (res.data || []).find(u => u.personnel_id === person.id);
        const role = user?.role_name || null;
        setOperatorRole(role);
        localStorage.setItem(ROLE_KEY, role || '');
      } catch (err) {
        console.error('Failed to fetch operator role:', err);
        setOperatorRole(null);
        localStorage.removeItem(ROLE_KEY);
      }
      // Update last_login in users table
      usersApi.recordLogin(person.id).catch(err =>
        console.error('Failed to record login:', err)
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVITY_KEY);
      localStorage.removeItem(ROLE_KEY);
      setOperatorRole(null);
    }
  };

  const clearOperator = () => {
    setOperator(null);
    setOperatorRole(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(ROLE_KEY);
  };

  const value = {
    operator,
    operatorRole,
    personnel,
    loading,
    selectOperator,
    clearOperator,
    isOperatorSelected: !!operator,
  };

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator() {
  const context = useContext(OperatorContext);
  if (!context) {
    throw new Error('useOperator must be used within an OperatorProvider');
  }
  return context;
}

export default OperatorContext;
