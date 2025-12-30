import { useState, useEffect } from 'react';

/**
 * Hook personalizzato per gestire lo stato persistente nel localStorage
 * 
 * @param {string} key - Chiave per il localStorage
 * @param {*} initialValue - Valore iniziale se non esiste nel localStorage
 * @returns {[*, Function]} - [valore, funzione per aggiornare]
 */
export function useLocalStorage(key, initialValue) {
  // Stato per memorizzare il valore
  // Passa una funzione a useState per essere lazy-evaluated
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    
    try {
      // Ottieni dal localStorage tramite la chiave
      const item = window.localStorage.getItem(key);
      // Parse del JSON memorizzato o ritorna initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Errore nel caricamento di ${key} dal localStorage:`, error);
      return initialValue;
    }
  });

  // Funzione wrapper per aggiornare il valore
  const setValue = (value) => {
    try {
      // Permette che value sia una funzione come useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Salva lo stato
      setStoredValue(valueToStore);
      
      // Salva nel localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Errore nel salvataggio di ${key} nel localStorage:`, error);
    }
  };

  return [storedValue, setValue];
}

/**
 * Hook per salvare automaticamente lo stato nel localStorage
 * quando cambia
 * 
 * @param {string} key - Chiave per il localStorage
 * @param {*} value - Valore da salvare
 */
export function usePersistState(key, value) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Errore nel salvataggio automatico di ${key}:`, error);
    }
  }, [key, value]);
}

/**
 * Funzione helper per caricare dal localStorage
 */
export function loadFromStorage(key, defaultValue = null) {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Errore nel caricamento di ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Funzione helper per salvare nel localStorage
 */
export function saveToStorage(key, value) {
  if (typeof window === 'undefined') return;
  
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Errore nel salvataggio di ${key}:`, error);
  }
}

/**
 * Funzione helper per rimuovere dal localStorage
 */
export function removeFromStorage(key) {
  if (typeof window === 'undefined') return;
  
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`Errore nella rimozione di ${key}:`, error);
  }
}

/**
 * Funzione helper per pulire tutto il localStorage dell'app
 */
export function clearAppStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key.startsWith('fratemix_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.error('Errore nella pulizia del localStorage:', error);
  }
}

