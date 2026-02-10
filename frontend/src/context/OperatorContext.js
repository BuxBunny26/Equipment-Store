import React, { createContext, useContext, useState, useEffect } from 'react';
import { personnelApi } from '../services/api';

const OperatorContext = createContext();

const STORAGE_KEY = 'equipment_store_operator';

export function OperatorProvider({ children }) {
  const [operator, setOperator] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load personnel list on mount
  useEffect(() => {
    loadPersonnel();
  }, []);

  // Load saved operator from localStorage
  useEffect(() => {
    const savedOperator = localStorage.getItem(STORAGE_KEY);
    if (savedOperator) {
      try {
        const parsed = JSON.parse(savedOperator);
        setOperator(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const loadPersonnel = async () => {
    try {
      const response = await personnelApi.getAll(true);
      setPersonnel(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load personnel:', error);
      setPersonnel([]);
    } finally {
      setLoading(false);
    }
  };

  const selectOperator = (person) => {
    setOperator(person);
    if (person) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(person));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearOperator = () => {
    setOperator(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = {
    operator,
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
