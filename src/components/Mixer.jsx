import React, { useState } from 'react';
import { Knob } from 'primereact/knob';
import { useLocalStorage } from '../hooks/useLocalStorage';
import 'primereact/resources/themes/lara-dark-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
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
function Mixer({ deckA, deckB }) {
  // Usa useLocalStorage per persistere il valore del crossfader
  const [crossfader, setCrossfader] = useLocalStorage('fratemix_crossfader', 0.5); // 0 = solo A, 1 = solo B, 0.5 = mix 50/50
  
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
  
  /**
   * Componente per un singolo controllo EQ con knob PrimeReact
   */
  const EQControl = ({ label, value, onChange, kill, onKillToggle }) => {
    return (
      <div className="eq-control-traktor">
        <div className="eq-knob-wrapper-prime">
          <Knob
            value={value}
            onChange={(e) => onChange(e.value)}
            min={-12}
            max={12}
            step={0.1}
            disabled={kill}
            size={50}
            valueTemplate={`${value > 0 ? '+' : ''}${value.toFixed(1)}dB`}
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
  };
  
  /**
   * Componente per il controllo filtro con knob PrimeReact
   */
  const FilterControl = ({ value, onChange }) => {
    const filterType = value < -0.1 ? 'HP' : value > 0.1 ? 'LP' : 'OFF';
    
    return (
      <div className="filter-control-traktor">
        <div className="filter-knob-wrapper-prime">
          <Knob
            value={value}
            onChange={(e) => onChange(e.value)}
            min={-1}
            max={1}
            step={0.01}
            size={60}
            valueTemplate={filterType}
          />
          <label className="filter-label-traktor">FLTR</label>
        </div>
      </div>
    );
  };
  
  /**
   * Componente per i controlli Gain con knob PrimeReact
   */
  const GainControl = ({ value, onChange }) => {
    return (
      <div className="gain-control-traktor">
        <div className="gain-knob-wrapper-prime">
          <Knob
            value={value}
            onChange={(e) => onChange(e.value)}
            min={0}
            max={2}
            step={0.01}
            size={60}
            valueTemplate={`${(value * 100).toFixed(0)}%`}
          />
          <label className="gain-label-traktor">GAIN</label>
        </div>
      </div>
    );
  };
  
  return (
    <div className="mixer-traktor">
      {/* Deck A Section (Left) */}
      <div className="mixer-section-traktor mixer-section-a">
        <GainControl value={deckA.gain} onChange={deckA.setGain} />
        
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
        
        <FilterControl value={deckA.filterValue} onChange={deckA.setFilterValue} />
        
        <div className="mixer-buttons-traktor">
          <button className="mixer-btn-traktor">FX 1</button>
          <button className="mixer-btn-traktor">FX 2</button>
          <button className="mixer-btn-traktor cue-btn-traktor" title="Cue">🎧</button>
        </div>
      </div>
      
      {/* Divider Verticale */}
      <div className="mixer-divider-traktor-vertical"></div>
      
      {/* Deck B Section (Right) */}
      <div className="mixer-section-traktor mixer-section-b">
        <GainControl value={deckB.gain} onChange={deckB.setGain} />
        
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
        
        <FilterControl value={deckB.filterValue} onChange={deckB.setFilterValue} />
        
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
            className="crossfader-slider"
            style={{
              background: `linear-gradient(to right, 
                #4a90e2 0%, 
                #4a90e2 ${crossfader * 50}%, 
                #e24a4a ${crossfader * 50}%, 
                #e24a4a 100%)`
            }}
          />
          <div className="crossfader-indicator" style={{ left: `${crossfader * 100}%` }}>
            <div className="crossfader-handle"></div>
          </div>
        </div>
        <div className="crossfader-label">B</div>
      </div>
    </div>
  );
}

export default Mixer;

