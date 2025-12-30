import { useEffect, useCallback } from 'react';
import { saveToStorage, loadFromStorage } from './useLocalStorage';

/**
 * Hook per gestire la persistenza dello stato di un deck
 * 
 * Salva e ripristina:
 * - Volume/Gain
 * - EQ (Low, Mid, High) e Kill switches
 * - Filtro
 * - BPM corrente
 * - Posizione corrente nel brano
 * - Stato loop
 * - Metadata della traccia caricata
 * 
 * @param {string} deckId - Identificatore univoco del deck ('A' o 'B')
 * @param {Object} deckState - Stato corrente del deck da salvare
 */
export function usePersistedDeckState(deckId, deckState) {
  const storageKey = `fratemix_deck_${deckId}`;
  
  /**
   * Salva lo stato del deck nel localStorage
   */
  const saveDeckState = useCallback(() => {
    if (!deckState) return;
    
    const stateToSave = {
      // Controlli audio
      gain: deckState.gain,
      eqLow: deckState.eqLow,
      eqMid: deckState.eqMid,
      eqHigh: deckState.eqHigh,
      eqLowKill: deckState.eqLowKill,
      eqMidKill: deckState.eqMidKill,
      eqHighKill: deckState.eqHighKill,
      filterValue: deckState.filterValue,
      
      // BPM
      bpm: deckState.bpm,
      detectedBPM: deckState.detectedBPM,
      
      // Posizione e durata
      currentTime: deckState.currentTime,
      duration: deckState.duration,
      
      // Loop
      loopEnabled: deckState.loopEnabled,
      loopStart: deckState.loopStart,
      loopLength: deckState.loopLength,
      
      // Metadata traccia
      fileName: deckState.fileName,
      isLoaded: deckState.isLoaded,
      
      // Timestamp del salvataggio
      savedAt: new Date().toISOString()
    };
    
    saveToStorage(storageKey, stateToSave);
  }, [deckId, storageKey, deckState]);
  
  /**
   * Carica lo stato del deck dal localStorage
   */
  const loadDeckState = useCallback(() => {
    const savedState = loadFromStorage(storageKey, null);
    
    if (savedState) {
      console.log(`Stato del Deck ${deckId} ripristinato dal localStorage:`, savedState);
    }
    
    return savedState;
  }, [deckId, storageKey]);
  
  /**
   * Salva automaticamente lo stato quando cambia
   * (con debouncing per evitare troppi salvataggi)
   */
  useEffect(() => {
    // Salva dopo un piccolo delay per evitare salvataggi eccessivi
    const timeoutId = setTimeout(() => {
      if (deckState.isLoaded) {
        saveDeckState();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [
    deckState.gain,
    deckState.eqLow,
    deckState.eqMid,
    deckState.eqHigh,
    deckState.eqLowKill,
    deckState.eqMidKill,
    deckState.eqHighKill,
    deckState.filterValue,
    deckState.bpm,
    deckState.loopEnabled,
    deckState.loopStart,
    deckState.loopLength,
    deckState.isLoaded,
    saveDeckState
  ]);
  
  // Salva la posizione corrente meno frequentemente (ogni 2 secondi)
  useEffect(() => {
    if (!deckState.isPlaying) return;
    
    const intervalId = setInterval(() => {
      saveDeckState();
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, [deckState.isPlaying, saveDeckState]);
  
  return {
    saveDeckState,
    loadDeckState
  };
}

/**
 * Hook per gestire il salvataggio di file audio in IndexedDB
 * (per file di dimensioni ragionevoli)
 * 
 * Nota: IndexedDB può salvare Blob/File, ma per file molto grandi
 * potrebbe non essere pratico. Questo è opzionale.
 */
export function useAudioFileStorage(deckId) {
  const dbName = 'FratemixDB';
  const storeName = 'audioFiles';
  const dbVersion = 1;
  
  /**
   * Apri/crea il database IndexedDB
   */
  const openDB = useCallback(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'deckId' });
        }
      };
    });
  }, []);
  
  /**
   * Salva un file audio in IndexedDB
   */
  const saveAudioFile = useCallback(async (file, metadata) => {
    if (!file) return;
    
    // Limita la dimensione a 50MB per evitare problemi
    if (file.size > 50 * 1024 * 1024) {
      console.warn('File troppo grande per essere salvato in IndexedDB');
      return;
    }
    
    try {
      const db = await openDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const data = {
        deckId,
        file,
        metadata,
        savedAt: new Date().toISOString()
      };
      
      await store.put(data);
      console.log(`File audio salvato per Deck ${deckId}`);
    } catch (error) {
      console.error('Errore nel salvataggio del file audio:', error);
    }
  }, [deckId, openDB]);
  
  /**
   * Carica un file audio da IndexedDB
   */
  const loadAudioFile = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Errore nel caricamento del file audio:', error);
      return null;
    }
  }, [deckId, openDB]);
  
  /**
   * Rimuovi un file audio da IndexedDB
   */
  const removeAudioFile = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await store.delete(deckId);
    } catch (error) {
      console.error('Errore nella rimozione del file audio:', error);
    }
  }, [deckId, openDB]);
  
  return {
    saveAudioFile,
    loadAudioFile,
    removeAudioFile
  };
}

