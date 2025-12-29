import React, { useRef } from 'react';
import Waveform from './Waveform';
import './Deck.css';

/**
 * Componente Deck - Rappresenta un singolo deck DJ
 * 
 * Questo componente gestisce:
 * - Caricamento file audio
 * - Controlli play/pause
 * - Visualizzazione stato (tempo, BPM, loop)
 * - Input per file audio
 */
function Deck({ 
  deckLabel, 
  deckAudio, 
  syncEnabled, 
  onSyncToggle 
}) {
  
  const handlePlayPause = () => {
    if (deckAudio.isPlaying) {
      deckAudio.pause();
    } else {
      deckAudio.play();
    }
  };
  
  return (
    <div className="deck-traktor">
      {/* Header con nome traccia e controlli */}
      <div className="deck-traktor-header">
        <div className="deck-traktor-title">
          {deckAudio.fileName ? (
            <span className="track-name">{deckAudio.fileName}</span>
          ) : (
            <span className="load-placeholder">Nessun file caricato</span>
          )}
        </div>
        
        <div className="deck-traktor-controls-top">
          <button 
            className={`deck-btn sync-btn-traktor ${syncEnabled ? 'active' : ''}`}
            onClick={onSyncToggle}
            title="Sync"
          >
            SYNC
          </button>
          <button 
            className="deck-btn master-btn"
            title="Master"
          >
            MASTER
          </button>
        </div>
      </div>
      
      {/* Waveform principale */}
      {deckAudio.isLoaded && (
        <Waveform
          audioBuffer={deckAudio.audioBuffer}
          isPlaying={deckAudio.isPlaying}
          currentTime={deckAudio.currentTime}
          duration={deckAudio.duration}
          onSeek={deckAudio.seek}
        />
      )}
      
      {/* Info e controlli sotto waveform */}
      <div className="deck-traktor-info">
        <div className="deck-time-info">
          <span className="time-display">{deckAudio.formatTime(deckAudio.currentTime)}</span>
          <span className="bpm-display">
            {deckAudio.bpm.toFixed(2)} BPM
            {deckAudio.detectedBPM && (
              <span className="detected-bpm-badge" title={`BPM originale: ${deckAudio.detectedBPM}`}>
                ⚡ {deckAudio.detectedBPM}
              </span>
            )}
          </span>
        </div>
        
        <div className="deck-playback-buttons">
          <button
            className={`deck-btn playback-btn ${deckAudio.isPlaying ? 'playing' : ''}`}
            onClick={handlePlayPause}
            disabled={!deckAudio.isLoaded}
            title="Play/Pause"
          >
            {deckAudio.isPlaying ? '⏸' : '▶'}
          </button>
          <button className="deck-btn cue-btn" title="Cue">CUE</button>
          <button className="deck-btn" title="Cup">CUP</button>
          <button className="deck-btn" title="Flex">FLX</button>
          <button className="deck-btn" title="Reverse">REV</button>
        </div>
      </div>
      
      {/* BPM Controls */}
      {deckAudio.isLoaded && (
        <div className="deck-bpm-controls">
          <div className="bpm-control-header">
            <label>TEMPO</label>
            {syncEnabled && <span className="sync-indicator">🔗 SYNC</span>}
          </div>
          <div className="bpm-slider-container">
            <span className="bpm-range-label">30</span>
            <div className="bpm-slider-wrapper">
              <input
                type="range"
                min="30"
                max="250"
                step="0.1"
                value={deckAudio.bpm}
                onChange={(e) => !syncEnabled && deckAudio.setBPM(parseFloat(e.target.value))}
                disabled={syncEnabled}
                className="bpm-slider"
                style={{
                  background: `linear-gradient(to right, 
                    #4a90e2 0%, 
                    #4a90e2 ${((deckAudio.bpm - 30) / (250 - 30)) * 100}%, 
                    #333 ${((deckAudio.bpm - 30) / (250 - 30)) * 100}%, 
                    #333 100%)`
                }}
              />
              {deckAudio.detectedBPM && (
                <div 
                  className="bpm-center-marker"
                  style={{
                    left: `${((deckAudio.detectedBPM - 30) / (250 - 30)) * 100}%`
                  }}
                  title={`BPM originale: ${deckAudio.detectedBPM}`}
                />
              )}
            </div>
            <span className="bpm-range-label">250</span>
          </div>
          <div className="bpm-actions">
            <button
              className="bpm-reset-btn"
              onClick={() => deckAudio.detectedBPM && deckAudio.setBPM(deckAudio.detectedBPM)}
              disabled={syncEnabled || !deckAudio.detectedBPM}
              title="Reset al BPM originale"
            >
              ↻ Reset
            </button>
            <input
              type="number"
              className="bpm-input-number"
              value={deckAudio.bpm.toFixed(1)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 30 && value <= 250 && !syncEnabled) {
                  deckAudio.setBPM(value);
                }
              }}
              disabled={syncEnabled}
              step="0.1"
              min="30"
              max="250"
            />
            <span className="bpm-percentage">
              {deckAudio.detectedBPM 
                ? `${((deckAudio.bpm / deckAudio.detectedBPM - 1) * 100).toFixed(1)}%`
                : '0%'
              }
            </span>
          </div>
        </div>
      )}
      
      {/* Fader verticale a destra */}
      <div className="deck-fader-container">
        <div className="deck-fader-label">VOL</div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={deckAudio.gain}
          onChange={(e) => deckAudio.setGain(parseFloat(e.target.value))}
          className="deck-fader"
          orient="vertical"
        />
        <div className="deck-fader-value">{(deckAudio.gain * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
}

export default Deck;

