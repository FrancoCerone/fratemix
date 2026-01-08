import React, { useState } from 'react';
import CustomKnob from './CustomKnob';
import './Mixer.css';

/**
 * Componente Mixer - Gestisce i controlli di mixing tra i due deck
 * 
 * Questo componente contiene:
 * - EQ a 3 bande per ogni deck (Low, Mid, High)
 * - Kill switch per ogni banda EQ
 * - Filtro passa-alto/passa-basso per ogni deck
 * - Controlli loop per ogni deck
 * - Persistenza dello stato del crossfader
 */
function Mixer({ deckA, deckB, crossfader, setCrossfader }) {
  
  // Handler per il drag verticale degli slider del volume
  const handleVolumeChange = (deck, e) => {
    const value = parseFloat(e.target.value);
    if (deck === 'A') {
      deckA.setGain(value);
    } else {
      deckB.setGain(value);
    }
  };

  // Handler personalizzato per drag verticale
  const handleVolumeMouseDown = (deck, e) => {
    e.preventDefault();
    e.stopPropagation();
    const slider = e.currentTarget;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    const updateValue = (clientY) => {
      const rect = slider.getBoundingClientRect();
      const y = clientY - rect.top;
      const height = rect.height;
      const percentage = 1 - (y / height); // Invertito perché parte da sopra
      const value = min + (max - min) * Math.max(0, Math.min(1, percentage));
      
      if (deck === 'A') {
        deckA.setGain(value);
      } else {
        deckB.setGain(value);
      }
    };
    
    const handleMouseMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      updateValue(moveEvent.clientY);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Gestisci anche il click iniziale
    updateValue(e.clientY);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handler per touch (mobile)
  const handleVolumeTouchStart = (deck, e) => {
    e.preventDefault();
    const slider = e.currentTarget;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    
    const updateValue = (clientY) => {
      const rect = slider.getBoundingClientRect();
      const y = clientY - rect.top;
      const height = rect.height;
      const percentage = 1 - (y / height);
      const value = min + (max - min) * Math.max(0, Math.min(1, percentage));
      
      if (deck === 'A') {
        deckA.setGain(value);
      } else {
        deckB.setGain(value);
      }
    };
    
    const handleTouchMove = (moveEvent) => {
      if (moveEvent.touches.length > 0) {
        moveEvent.preventDefault();
        updateValue(moveEvent.touches[0].clientY);
      }
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    if (e.touches.length > 0) {
      updateValue(e.touches[0].clientY);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }
  };
  
  // Aggiorna i gain dei deck in base al crossfader
  React.useEffect(() => {
    // Crossfader: 0 = solo A (gain A = 1, gain B = 0), 1 = solo B (gain A = 0, gain B = 1)
    // Usa curve logaritmiche per transizioni più naturali
    const curveA = Math.cos(crossfader * Math.PI / 2); // Da 1 a 0 quando crossfader va da 0 a 1
    const curveB = Math.sin(crossfader * Math.PI / 2); // Da 0 a 1 quando crossfader va da 0 a 1
    
    // Applica il crossfader al gain finale di ogni deck
    // Il gain del deck viene moltiplicato per la curva del crossfader
    if (deckA && deckA.setCrossfaderGain) {
      deckA.setCrossfaderGain(curveA);
    }
    if (deckB && deckB.setCrossfaderGain) {
      deckB.setCrossfaderGain(curveB);
    }
  }, [crossfader, deckA, deckB]);
  
  // Calcola l'opacità dei deck in base al crossfader
  // Al centro (0.5): entrambi a opacità 1
  // Più si sposta verso un deck, più l'altro si opacizza
  // Opacità minima: 0.35 per mantenere sempre l'interfaccia visibile
  const MIN_OPACITY = 0.35;
  
  const deckAOpacity = crossfader <= 0.5 
    ? 1 
    : Math.max(MIN_OPACITY, 1 - ((crossfader - 0.5) * 2 * (1 - MIN_OPACITY)));
  
  const deckBOpacity = crossfader >= 0.5 
    ? 1 
    : Math.max(MIN_OPACITY, 1 - ((0.5 - crossfader) * 2 * (1 - MIN_OPACITY)));
  
  /**
   * Componente per un singolo controllo EQ con knob personalizzato
   * I knob sono sempre modificabili, anche durante la riproduzione
   * Memoizzato per evitare re-render inutili quando altri knob cambiano
   */
  const EQControl = React.memo(({ label, value, onChange, kill, onKillToggle }) => {
    // Gestisce il cambio valore del knob
    const handleChange = React.useCallback((newValue) => {
      // Questo viene chiamato sempre, anche durante la riproduzione
      if (typeof onChange === 'function') {
        onChange(newValue);
      }
    }, [onChange]);
    
    return (
      <div className="eq-control-traktor">
        <div className="eq-knob-wrapper-prime">
          <CustomKnob
            value={value}
            onChange={handleChange}
            min={-12}
            max={12}
            step={0.1}
            size={75}
            disabled={kill}
            valueTemplate={`{value}dB`}
          />
          <label className="eq-label-traktor">{label}</label>
        </div>
        <button
          className={`eq-kill-traktor ${kill ? 'active' : ''}`}
          onClick={onKillToggle}
          title="Kill"
        >
          K
        </button>
      </div>
    );
  });
  
  /**
   * Componente per il controllo filtro con knob personalizzato
   * Memoizzato per evitare re-render inutili quando altri controlli cambiano
   */
  const FilterControl = React.memo(({ value, onChange }) => {
    const filterType = value < -0.1 ? 'HP' : value > 0.1 ? 'LP' : 'OFF';
    
    const handleChange = React.useCallback((newValue) => {
      if (typeof onChange === 'function') {
        onChange(newValue);
      }
    }, [onChange]);
    
    return (
      <div className="filter-control-traktor">
        <div className="filter-knob-wrapper-prime">
          <CustomKnob
            value={value}
            onChange={handleChange}
            min={-1}
            max={1}
            step={0.01}
            size={75}
            disabled={false}
            valueTemplate={filterType}
          />
          <label className="filter-label-traktor">FLTR</label>
        </div>
      </div>
    );
  });
  
  return (
    <div className="mixer-traktor">
      {/* Deck A Section (Left) */}
      <div 
        className="mixer-section-traktor mixer-section-a"
        style={{ opacity: deckAOpacity, transition: 'opacity 0.2s ease-out' }}
      >
        <div className="eq-panel-traktor">
          {/* Volume Slider e Filter - Sinistra per Deck A */}
          <div className="mixer-volume-container">
            <div className="mixer-volume-label">VOL</div>
            <div className="mixer-volume-slider-wrapper">
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={deckA.gain}
                onChange={(e) => handleVolumeChange('A', e)}
                onInput={(e) => handleVolumeChange('A', e)}
                onMouseDown={(e) => handleVolumeMouseDown('A', e)}
                onTouchStart={(e) => handleVolumeTouchStart('A', e)}
                className="mixer-volume-slider slider-traktor"
                orient="vertical"
              />
              <div 
                className="mixer-volume-indicator"
                style={{ 
                  bottom: `${(deckA.gain / 2) * 100}%`
                }}
              ></div>
            </div>
            <div className="mixer-volume-value">{(deckA.gain * 100).toFixed(0)}%</div>
            <FilterControl value={deckA.filterValue} onChange={deckA.setFilterValue} />
          </div>
          
          {/* EQ Controls - Verticale */}
          <div className="eq-row-traktor">
            <EQControl
              label="HI"
              value={deckA.eqHigh}
              onChange={deckA.setEqHigh}
              kill={deckA.eqHighKill}
              onKillToggle={() => deckA.setEqHighKill(!deckA.eqHighKill)}
            />
            <EQControl
              label="MO"
              value={deckA.eqMid}
              onChange={deckA.setEqMid}
              kill={deckA.eqMidKill}
              onKillToggle={() => deckA.setEqMidKill(!deckA.eqMidKill)}
            />
            <EQControl
              label="LO"
              value={deckA.eqLow}
              onChange={deckA.setEqLow}
              kill={deckA.eqLowKill}
              onKillToggle={() => deckA.setEqLowKill(!deckA.eqLowKill)}
            />
          </div>
        </div>
        
        <div className="mixer-buttons-traktor">
          <button className="mixer-btn-traktor">FX 1</button>
          <button className="mixer-btn-traktor">FX 2</button>
          <button className="mixer-btn-traktor cue-btn-traktor" title="Cue">🎧</button>
        </div>
      </div>
      
      {/* Divider Verticale */}
      <div className="mixer-divider-traktor-vertical"></div>
      
      {/* Deck B Section (Right) */}
      <div 
        className="mixer-section-traktor mixer-section-b"
        style={{ opacity: deckBOpacity, transition: 'opacity 0.2s ease-out' }}
      >
        <div className="eq-panel-traktor">
          {/* EQ Controls - Verticale */}
          <div className="eq-row-traktor">
            <EQControl
              label="HI"
              value={deckB.eqHigh}
              onChange={deckB.setEqHigh}
              kill={deckB.eqHighKill}
              onKillToggle={() => deckB.setEqHighKill(!deckB.eqHighKill)}
            />
            <EQControl
              label="MO"
              value={deckB.eqMid}
              onChange={deckB.setEqMid}
              kill={deckB.eqMidKill}
              onKillToggle={() => deckB.setEqMidKill(!deckB.eqMidKill)}
            />
            <EQControl
              label="LO"
              value={deckB.eqLow}
              onChange={deckB.setEqLow}
              kill={deckB.eqLowKill}
              onKillToggle={() => deckB.setEqLowKill(!deckB.eqLowKill)}
            />
          </div>
          
          {/* Volume Slider e Filter - Destra per Deck B */}
          <div className="mixer-volume-container">
            <div className="mixer-volume-label">VOL</div>
            <div className="mixer-volume-slider-wrapper">
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={deckB.gain}
                onChange={(e) => handleVolumeChange('B', e)}
                onInput={(e) => handleVolumeChange('B', e)}
                onMouseDown={(e) => handleVolumeMouseDown('B', e)}
                onTouchStart={(e) => handleVolumeTouchStart('B', e)}
                className="mixer-volume-slider slider-traktor"
                orient="vertical"
              />
              <div 
                className="mixer-volume-indicator"
                style={{ 
                  bottom: `${(deckB.gain / 2) * 100}%`
                }}
              ></div>
            </div>
            <div className="mixer-volume-value">{(deckB.gain * 100).toFixed(0)}%</div>
            <FilterControl value={deckB.filterValue} onChange={deckB.setFilterValue} />
          </div>
        </div>
        
        <div className="mixer-buttons-traktor">
          <button className="mixer-btn-traktor">FX 1</button>
          <button className="mixer-btn-traktor">FX 2</button>
          <button className="mixer-btn-traktor cue-btn-traktor" title="Cue">🎧</button>
        </div>
      </div>
      
      {/* Crossfader */}
      <div className="crossfader-container">
        <div className="crossfader-label">A</div>
        <div className="crossfader-wrapper">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={(e) => setCrossfader(parseFloat(e.target.value))}
            className="crossfader-slider slider-traktor"
          />
        </div>
        <div className="crossfader-label">B</div>
      </div>
    </div>
  );
}

export default Mixer;

