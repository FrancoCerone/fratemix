import React, { useRef, useState } from 'react';
import WaveformOverview from './WaveformOverview';
import WaveformDetail from './WaveformDetail';
import BPMCorrection from './BPMCorrection';
import TapTempo from './TapTempo';
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
  otherDeck,
  syncEnabled,
  crossfader
}) {
  
  // Calcola l'opacità del deck in base al crossfader
  // Al centro (0.5): entrambi a opacità 1
  // Più si sposta verso un deck, più l'altro si opacizza
  // Opacità minima: 0.35 per mantenere sempre l'interfaccia visibile
  const MIN_OPACITY = 0.35;
  
  const deckOpacity = deckLabel === 'A'
    ? crossfader <= 0.5 
      ? 1 
      : Math.max(MIN_OPACITY, 1 - ((crossfader - 0.5) * 2 * (1 - MIN_OPACITY)))
    : crossfader >= 0.5 
      ? 1 
      : Math.max(MIN_OPACITY, 1 - ((0.5 - crossfader) * 2 * (1 - MIN_OPACITY)));
  
  const handlePlayPause = () => {
    if (deckAudio.isPlaying) {
      deckAudio.pause();
    } else {
      // Passa l'altro deck per la sincronizzazione con i picchi
      deckAudio.play(otherDeck);
    }
  };
  
  return (
    <div 
      className="deck-traktor"
      style={{ 
        opacity: deckOpacity, 
        transition: 'opacity 0.2s ease-out' 
      }}
    >
      {/* Header con nome traccia e controlli */}
      <div className="deck-traktor-header">
        <div className="deck-traktor-title">
          {deckAudio.isRestoringAudio ? (
            <span className="load-placeholder restoring">
              🔄 Ripristino traccia...
            </span>
          ) : deckAudio.fileName ? (
            <span className="track-name">{deckAudio.fileName}</span>
          ) : (
            <span className="load-placeholder">Nessun file caricato</span>
          )}
        </div>
        
        <div className="deck-traktor-controls-top">
          <button 
            className="deck-btn master-btn"
            title="Master"
          >
            MASTER
          </button>
        </div>
      </div>
      
      {/* Waveform Overview - compatto, mostra tutta la traccia */}
      {deckAudio.isLoaded && (
        <WaveformOverview
          audioBuffer={deckAudio.audioBuffer}
          currentTime={deckAudio.currentTime}
          duration={deckAudio.duration}
          onSeek={deckAudio.seek}
        />
      )}
      
      {/* Waveform Detail - zoomabile, mostra sezione corrente */}
      {deckAudio.isLoaded && (
        <WaveformDetail
          audioBuffer={deckAudio.audioBuffer}
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
            {deckAudio.isLoaded && (
              <>
                <TapTempo
                  currentBPM={deckAudio.bpm}
                  onBPMChange={(newBPM) => deckAudio.setBPM(newBPM)}
                  deckLabel={deckLabel}
                />
                <BPMCorrection
                  detectedBPM={deckAudio.detectedBPM || deckAudio.bpm}
                  currentBPM={deckAudio.bpm}
                  onCorrect={(newBPM) => deckAudio.setBPM(newBPM)}
                />
              </>
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
            <span className="pitch-value">
              {deckAudio.pitchValue > 0 ? '+' : ''}{deckAudio.pitchValue.toFixed(1)}%
            </span>
            {syncEnabled && <span className="sync-indicator">🔗 SYNC</span>}
          </div>
          <div className="bpm-slider-container">
            <span className="bpm-range-label">-8%</span>
            <div className="bpm-slider-wrapper">
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={deckAudio.pitchValue}
              onChange={(e) => !syncEnabled && deckAudio.setPitchValue(parseFloat(e.target.value))}
              disabled={syncEnabled}
              className="bpm-slider pitch-slider slider-traktor"
            />
              <div className="bpm-center-marker pitch-center" title="0% (velocità originale)"></div>
            </div>
            <span className="bpm-range-label">+8%</span>
          </div>
          <div className="bpm-info-row">
            <span className="bpm-reference">
              BPM: {deckAudio.bpm.toFixed(1)} → {(deckAudio.bpm * (1 + deckAudio.pitchValue / 100)).toFixed(1)}
            </span>
            <button 
              className="pitch-reset-btn"
              onClick={() => deckAudio.setPitchValue(0)}
              disabled={deckAudio.pitchValue === 0 || syncEnabled}
              title="Reset pitch a 0%"
            >
              0%
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deck;

