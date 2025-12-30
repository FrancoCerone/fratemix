import React, { useState, useRef, useEffect } from 'react';
import './TapTempo.css';

/**
 * Componente TapTempo - Permette di calcolare il BPM manualmente
 * 
 * Features:
 * - Tap button: clicca al ritmo della musica
 * - Input manuale: digita il BPM direttamente
 * - Calcolo automatico dai tap
 * - Reset tap
 */
function TapTempo({ currentBPM, onBPMChange, deckLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tapTimes, setTapTimes] = useState([]);
  const [calculatedBPM, setCalculatedBPM] = useState(null);
  const [manualBPM, setManualBPM] = useState(currentBPM.toFixed(1));
  const tapTimeoutRef = useRef(null);
  
  // Aggiorna manualBPM quando cambia currentBPM (dal rilevamento automatico)
  useEffect(() => {
    if (!isOpen) {
      setManualBPM(currentBPM.toFixed(1));
    }
  }, [currentBPM, isOpen]);
  
  // Reset tap dopo 3 secondi di inattività
  useEffect(() => {
    if (tapTimes.length > 0) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      
      tapTimeoutRef.current = setTimeout(() => {
        console.log('⏱️ Reset tap times per inattività');
        setTapTimes([]);
        setCalculatedBPM(null);
      }, 3000);
    }
    
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [tapTimes]);
  
  /**
   * Gestisce un tap
   */
  const handleTap = () => {
    const now = Date.now();
    const newTapTimes = [...tapTimes, now];
    
    // Mantieni solo gli ultimi 8 tap (per calcolo più stabile)
    if (newTapTimes.length > 8) {
      newTapTimes.shift();
    }
    
    setTapTimes(newTapTimes);
    
    // Calcola BPM se abbiamo almeno 2 tap
    if (newTapTimes.length >= 2) {
      const intervals = [];
      
      // Calcola intervalli tra tap consecutivi
      for (let i = 1; i < newTapTimes.length; i++) {
        intervals.push(newTapTimes[i] - newTapTimes[i - 1]);
      }
      
      // Media degli intervalli in millisecondi
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      
      // Converti in BPM: (60000 ms/min) / (intervallo in ms)
      const bpm = 60000 / avgInterval;
      
      // Arrotonda a 0.1
      const roundedBPM = Math.round(bpm * 10) / 10;
      
      setCalculatedBPM(roundedBPM);
      console.log(`🎵 Tap ${newTapTimes.length}: BPM calcolato = ${roundedBPM}`);
    }
  };
  
  /**
   * Applica il BPM calcolato dai tap
   */
  const applyTappedBPM = () => {
    if (calculatedBPM) {
      onBPMChange(calculatedBPM);
      setManualBPM(calculatedBPM.toFixed(1));
      console.log(`✅ BPM applicato: ${calculatedBPM}`);
      // Reset tap dopo applicazione
      setTapTimes([]);
      setCalculatedBPM(null);
    }
  };
  
  /**
   * Applica il BPM inserito manualmente
   */
  const applyManualBPM = () => {
    const bpm = parseFloat(manualBPM);
    
    if (isNaN(bpm)) {
      alert('Inserisci un numero valido!');
      return;
    }
    
    if (bpm < 40 || bpm > 300) {
      alert('BPM deve essere tra 40 e 300!');
      return;
    }
    
    onBPMChange(bpm);
    console.log(`✅ BPM manuale applicato: ${bpm}`);
  };
  
  /**
   * Reset dei tap
   */
  const resetTaps = () => {
    setTapTimes([]);
    setCalculatedBPM(null);
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
  };
  
  /**
   * Shortcut da tastiera
   */
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyPress = (e) => {
      // Spazio o T per tap
      if (e.code === 'Space' || e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleTap();
      }
      // ESC per chiudere
      else if (e.key === 'Escape') {
        setIsOpen(false);
      }
      // Enter per applicare
      else if (e.key === 'Enter') {
        if (calculatedBPM) {
          applyTappedBPM();
        } else {
          applyManualBPM();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, calculatedBPM, manualBPM]);
  
  if (!isOpen) {
    return (
      <button 
        className="tap-tempo-trigger"
        onClick={() => setIsOpen(true)}
        title="Tap Tempo / BPM Manuale"
      >
        🎹 TAP
      </button>
    );
  }
  
  return (
    <div className="tap-tempo-overlay" onClick={() => setIsOpen(false)}>
      <div className="tap-tempo-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tap-tempo-header">
          <h3>🎹 Tap Tempo - Deck {deckLabel}</h3>
          <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
        </div>
        
        <div className="tap-tempo-content">
          {/* Tap Tempo Section */}
          <div className="tap-section">
            <h4>Metodo 1: Tap Tempo</h4>
            <p className="tap-instructions">
              Clicca il pulsante (o premi SPAZIO) al ritmo del beat
            </p>
            
            <button 
              className="tap-button"
              onClick={handleTap}
              onKeyDown={(e) => {
                if (e.code === 'Space') {
                  e.preventDefault();
                  handleTap();
                }
              }}
            >
              <span className="tap-icon">👆</span>
              <span className="tap-text">TAP</span>
              {tapTimes.length > 0 && (
                <span className="tap-count">{tapTimes.length}</span>
              )}
            </button>
            
            {calculatedBPM && (
              <div className="tap-result">
                <div className="calculated-bpm">
                  <span className="bpm-value">{calculatedBPM.toFixed(1)}</span>
                  <span className="bpm-label">BPM</span>
                </div>
                <div className="tap-actions">
                  <button 
                    className="apply-btn"
                    onClick={applyTappedBPM}
                  >
                    ✅ Applica
                  </button>
                  <button 
                    className="reset-btn"
                    onClick={resetTaps}
                  >
                    🔄 Reset
                  </button>
                </div>
              </div>
            )}
            
            {tapTimes.length > 0 && !calculatedBPM && (
              <div className="tap-hint">
                Continua a cliccare al ritmo... ({tapTimes.length} tap)
              </div>
            )}
          </div>
          
          <div className="divider">
            <span>OPPURE</span>
          </div>
          
          {/* Manual Input Section */}
          <div className="manual-section">
            <h4>Metodo 2: Inserimento Manuale</h4>
            <p className="manual-instructions">
              Inserisci il BPM se lo conosci già
            </p>
            
            <div className="manual-input-group">
              <input
                type="number"
                min="40"
                max="300"
                step="0.1"
                value={manualBPM}
                onChange={(e) => setManualBPM(e.target.value)}
                className="manual-bpm-input"
                placeholder="Es: 120.0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyManualBPM();
                  }
                }}
              />
              <button 
                className="apply-btn"
                onClick={applyManualBPM}
              >
                ✅ Applica
              </button>
            </div>
            
            {/* Quick BPM buttons */}
            <div className="quick-bpm-section">
              <p className="quick-label">BPM Comuni:</p>
              <div className="quick-bpm-buttons">
                {[100, 110, 120, 125, 128, 130, 140, 150, 160, 174].map(bpm => (
                  <button
                    key={bpm}
                    className={`quick-bpm-btn ${currentBPM === bpm ? 'active' : ''}`}
                    onClick={() => {
                      setManualBPM(bpm.toString());
                      onBPMChange(bpm);
                    }}
                  >
                    {bpm}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Info Section */}
          <div className="tap-info">
            <p><strong>💡 Tips:</strong></p>
            <ul>
              <li><strong>Tap Tempo</strong>: Clicca al ritmo del kick drum (4/4 = ogni beat)</li>
              <li><strong>Tastiera</strong>: SPAZIO per tap, ENTER per applicare, ESC per chiudere</li>
              <li><strong>Precisione</strong>: Più tap = più accurato (min 2, consigliati 4-8)</li>
              <li><strong>BPM corrente</strong>: {currentBPM.toFixed(1)} BPM</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TapTempo;

