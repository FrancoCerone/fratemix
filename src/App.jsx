import React, { useState, useCallback, useEffect } from 'react';
import Deck from './components/Deck';
import Mixer from './components/Mixer';
import TrackBrowser from './components/TrackBrowser';
import { useDeckAudio } from './hooks/useDeckAudio';
import { useLocalStorage, clearAppStorage } from './hooks/useLocalStorage';
import './App.css';

/**
 * Componente principale dell'applicazione FRATEMIX
 * 
 * Gestisce:
 * - Due deck indipendenti (Deck A e Deck B)
 * - Sincronizzazione BPM tra i deck
 * - Stato globale dell'applicazione
 * - Persistenza automatica dello stato
 */
function App() {
  // Stato per la sincronizzazione - con persistenza
  const [syncEnabledA, setSyncEnabledA] = useLocalStorage('fratemix_syncA', false);
  const [syncEnabledB, setSyncEnabledB] = useLocalStorage('fratemix_syncB', false);
  
  // Inizializza i due deck con gli hook personalizzati
  // Nota: inizialmente senza sync, verrà gestito tramite useEffect
  const deckA = useDeckAudio({
    deckId: 'A',
    initialBPM: 128
  });
  
  const deckB = useDeckAudio({
    deckId: 'B',
    initialBPM: 128
  });
  
  // Gestisce la sincronizzazione: quando sync è attivo su un deck,
  // aggiorna il suo BPM per seguire l'altro deck
  React.useEffect(() => {
    if (syncEnabledA && deckB.bpm !== deckA.bpm) {
      deckA.setBPM(deckB.bpm);
    }
  }, [syncEnabledA, deckB.bpm, deckA.bpm, deckA.setBPM]);
  
  React.useEffect(() => {
    if (syncEnabledB && deckA.bpm !== deckB.bpm) {
      deckB.setBPM(deckA.bpm);
    }
  }, [syncEnabledB, deckA.bpm, deckB.bpm, deckB.setBPM]);
  
  // Gestione toggle sync
  const handleSyncToggleA = useCallback(() => {
    setSyncEnabledA(!syncEnabledA);
    // Se attiviamo sync su A, disattiviamo su B (mutualmente esclusivo)
    if (!syncEnabledA) {
      setSyncEnabledB(false);
    }
  }, [syncEnabledA, setSyncEnabledA, setSyncEnabledB]);
  
  const handleSyncToggleB = useCallback(() => {
    setSyncEnabledB(!syncEnabledB);
    // Se attiviamo sync su B, disattiviamo su A (mutualmente esclusivo)
    if (!syncEnabledB) {
      setSyncEnabledA(false);
    }
  }, [syncEnabledB, setSyncEnabledA, setSyncEnabledB]);
  
  // Mostra un messaggio di benvenuto quando lo stato viene ripristinato
  const [showRestoreMessage, setShowRestoreMessage] = useState(false);
  
  useEffect(() => {
    const hasRestoredState = deckA.isLoaded || deckB.isLoaded;
    if (hasRestoredState) {
      console.log('🎵 FRATEMIX: Stato della sessione precedente ripristinato!');
      setShowRestoreMessage(true);
      // Nascondi il messaggio dopo 5 secondi
      setTimeout(() => setShowRestoreMessage(false), 5000);
    }
  }, [deckA.isLoaded, deckB.isLoaded]); // Dipendenze corrette
  
  // Funzione per resettare tutto lo stato salvato
  const handleResetState = useCallback(() => {
    if (window.confirm('Vuoi resettare tutti i controlli e cancellare lo stato salvato? Questo eliminerà anche i file audio salvati.')) {
      clearAppStorage();
      // Pulisci anche IndexedDB
      const deleteRequest = indexedDB.deleteDatabase('FratemixDB');
      deleteRequest.onsuccess = () => {
        console.log('✅ Database IndexedDB eliminato');
        window.location.reload();
      };
      deleteRequest.onerror = () => {
        console.error('❌ Errore nell\'eliminazione del database');
        window.location.reload();
      };
    }
  }, []);
  
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>FRATEMIX</h1>
          {showRestoreMessage && (
            <div className="restore-message">
              ✅ Sessione ripristinata
            </div>
          )}
        </div>
        
        <div className="header-center">
          <div className="master-tempo">
            <div className="master-tempo-label">MASTER TEMPO</div>
            <div className="master-tempo-value">
              {syncEnabledA ? deckB.bpm.toFixed(2) : syncEnabledB ? deckA.bpm.toFixed(2) : '128.00'}
            </div>
            <div className="master-tempo-controls">
              <button className="master-btn-small">MASTER</button>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <p className="subtitle">Minimal DJ Web App</p>
          <button 
            className="reset-btn-small" 
            onClick={handleResetState}
            title="Reset tutti i controlli e file audio salvati"
          >
            🔄 Reset
          </button>
        </div>
      </header>
      
      <div className="app-content">
        <main className="app-main">
          <Deck
            deckLabel="A"
            deckAudio={deckA}
            syncEnabled={syncEnabledA}
            onSyncToggle={handleSyncToggleA}
          />
          
          <Mixer deckA={deckA} deckB={deckB} />
          
          <Deck
            deckLabel="B"
            deckAudio={deckB}
            syncEnabled={syncEnabledB}
            onSyncToggle={handleSyncToggleB}
          />
        </main>
        
        <TrackBrowser 
          onLoadTrack={(track) => {
            // Callback opzionale per gestire il caricamento
          }}
          deckA={deckA}
          deckB={deckB}
        />
      </div>
      
      <footer className="app-footer">
        <p>Carica file audio locali e mixa come un DJ professionista</p>
      </footer>
    </div>
  );
}

export default App;
