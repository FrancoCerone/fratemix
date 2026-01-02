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
  // Stato per la sincronizzazione - unico stato globale
  const [syncEnabled, setSyncEnabled] = useLocalStorage('fratemix_sync', false);
  
  // Inizializza i due deck con gli hook personalizzati
  const deckA = useDeckAudio({
    deckId: 'A',
    initialBPM: 128,
    syncEnabled: syncEnabled
  });
  
  const deckB = useDeckAudio({
    deckId: 'B',
    initialBPM: 128,
    syncEnabled: syncEnabled
  });
  
  // Gestisce la sincronizzazione BPM: quando sync è attivo,
  // il deck che non è master segue il BPM del master
  React.useEffect(() => {
    if (syncEnabled) {
      // Se A sta suonando, B segue A. Altrimenti A segue B
      if (deckA.isPlaying && !deckB.isPlaying) {
        if (deckB.bpm !== deckA.bpm) {
          deckB.setBPM(deckA.bpm);
        }
      } else if (deckB.isPlaying && !deckA.isPlaying) {
        if (deckA.bpm !== deckB.bpm) {
          deckA.setBPM(deckB.bpm);
        }
      } else if (deckA.isPlaying && deckB.isPlaying) {
        // Se entrambi stanno suonando, usa il BPM del primo che ha iniziato
        // Per semplicità, usa il BPM di A
        if (deckB.bpm !== deckA.bpm) {
          deckB.setBPM(deckA.bpm);
        }
      }
    }
  }, [syncEnabled, deckA.isPlaying, deckB.isPlaying, deckA.bpm, deckB.bpm, deckA.setBPM, deckB.setBPM]);
  
  // Gestione toggle sync
  const handleSyncToggle = useCallback(() => {
    setSyncEnabled(!syncEnabled);
  }, [syncEnabled, setSyncEnabled]);
  
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
              {syncEnabled && deckA.isPlaying ? deckA.bpm.toFixed(2) : 
               syncEnabled && deckB.isPlaying ? deckB.bpm.toFixed(2) : 
               deckA.isPlaying ? deckA.bpm.toFixed(2) :
               deckB.isPlaying ? deckB.bpm.toFixed(2) : '128.00'}
            </div>
            <div className="master-tempo-controls">
              <button 
                className={`master-btn-small ${syncEnabled ? 'active' : ''}`}
                onClick={handleSyncToggle}
                title="Sync"
              >
                SYNC
              </button>
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
            otherDeck={deckB}
            syncEnabled={syncEnabled}
          />
          
          <Mixer deckA={deckA} deckB={deckB} />
          
          <Deck
            deckLabel="B"
            deckAudio={deckB}
            otherDeck={deckA}
            syncEnabled={syncEnabled}
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
