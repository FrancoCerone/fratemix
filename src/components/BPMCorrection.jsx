import React, { useState } from 'react';
import './BPMCorrection.css';

/**
 * Componente per correggere manualmente il BPM se l'algoritmo sbaglia
 */
function BPMCorrection({ detectedBPM, currentBPM, onCorrect, suggestions = [] }) {
  const [showDialog, setShowDialog] = useState(false);
  const [customBPM, setCustomBPM] = useState(currentBPM.toFixed(1));
  
  const handleQuickFix = (newBPM) => {
    onCorrect(newBPM);
    setShowDialog(false);
  };
  
  const handleCustom = () => {
    const bpm = parseFloat(customBPM);
    if (bpm >= 60 && bpm <= 200) {
      onCorrect(bpm);
      setShowDialog(false);
    }
  };
  
  // Genera suggerimenti comuni
  const commonSuggestions = [
    detectedBPM,
    detectedBPM * 2,
    detectedBPM / 2,
    120, 125, 128, 130, 140, 150, 160, 174
  ].filter((bpm, index, self) => 
    bpm >= 60 && bpm <= 200 && self.indexOf(bpm) === index
  ).slice(0, 8);
  
  if (!showDialog) {
    return (
      <button 
        className="bpm-fix-trigger"
        onClick={() => setShowDialog(true)}
        title="BPM sbagliato? Clicca per correggere"
      >
        ⚙️
      </button>
    );
  }
  
  return (
    <div className="bpm-correction-overlay" onClick={() => setShowDialog(false)}>
      <div className="bpm-correction-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="bpm-correction-header">
          <h3>🎵 Correggi BPM</h3>
          <button className="close-btn" onClick={() => setShowDialog(false)}>×</button>
        </div>
        
        <div className="bpm-correction-content">
          <div className="current-bpm-info">
            <p>
              <strong>Rilevato:</strong> {detectedBPM.toFixed(1)} BPM<br/>
              <strong>Corrente:</strong> {currentBPM.toFixed(1)} BPM
            </p>
          </div>
          
          <div className="quick-fixes">
            <h4>Correzioni Rapide</h4>
            <div className="bpm-buttons">
              {commonSuggestions.map(bpm => (
                <button
                  key={bpm}
                  className={`bpm-btn ${bpm === currentBPM ? 'active' : ''}`}
                  onClick={() => handleQuickFix(bpm)}
                >
                  {bpm.toFixed(0)}
                </button>
              ))}
            </div>
          </div>
          
          <div className="custom-bpm">
            <h4>BPM Personalizzato</h4>
            <div className="custom-input-group">
              <input
                type="number"
                min="60"
                max="200"
                step="0.1"
                value={customBPM}
                onChange={(e) => setCustomBPM(e.target.value)}
                className="custom-bpm-input"
              />
              <button className="apply-btn" onClick={handleCustom}>
                Applica
              </button>
            </div>
          </div>
          
          <div className="bpm-tips">
            <p><strong>💡 Suggerimenti:</strong></p>
            <ul>
              <li>Se il BPM sembra doppio, prova la metà</li>
              <li>120-130 BPM: House/Techno tipico</li>
              <li>140-150 BPM: Techno/Trance veloce</li>
              <li>160-180 BPM: Drum & Bass</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BPMCorrection;

