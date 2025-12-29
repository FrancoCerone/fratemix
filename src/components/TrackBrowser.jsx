import React, { useState, useRef, useCallback } from 'react';
import './TrackBrowser.css';

/**
 * Componente TrackBrowser - Browser per la selezione e caricamento tracce
 * 
 * Permette di:
 * - Caricare file audio dal file system
 * - Visualizzare le tracce caricate
 * - Selezionare e caricare tracce nei deck
 * - Gestire una libreria di tracce
 */
function TrackBrowser({ onLoadTrack, deckA, deckB }) {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [browserHeight, setBrowserHeight] = useState(20); // Percentuale di altezza
  const [isResizing, setIsResizing] = useState(false);
  const fileInputRef = useRef(null);
  const browserRef = useRef(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);
  
  /**
   * Carica un file audio e lo aggiunge alla libreria
   */
  const handleFileLoad = useCallback(async (file) => {
    if (!file) return;
    
    // Crea un oggetto traccia con metadati
    const track = {
      id: Date.now() + Math.random(),
      name: file.name,
      file: file,
      size: file.size,
      type: file.type,
      addedAt: new Date()
    };
    
    setTracks(prev => [...prev, track]);
    setSelectedTrack(track);
  }, []);
  
  /**
   * Gestisce il click sul pulsante di caricamento
   */
  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };
  
  /**
   * Gestisce la selezione di un file
   */
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('audio/')) {
        handleFileLoad(file);
      }
    });
  };
  
  /**
   * Carica una traccia nel deck specificato
   */
  const loadTrackToDeck = useCallback((track, deck) => {
    if (track && track.file && deck) {
      deck.loadAudioFile(track.file);
    }
  }, []);
  
  /**
   * Gestisce il doppio click su una traccia per caricarla nel deck A
   */
  const handleTrackDoubleClick = (track) => {
    loadTrackToDeck(track, deckA);
  };
  
  /**
   * Gestisce il drag and drop
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach(file => {
      if (file.type.startsWith('audio/')) {
        handleFileLoad(file);
      }
    });
  };
  
  /**
   * Gestisce il resize del browser
   */
  const handleResizeStart = (e) => {
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = browserHeight;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  const handleResizeMove = (e) => {
    if (!isResizing) return;
    
    const deltaY = resizeStartYRef.current - e.clientY; // Negativo quando si va su
    const windowHeight = window.innerHeight;
    const deltaPercent = (deltaY / windowHeight) * 100;
    const newHeight = Math.max(10, Math.min(50, resizeStartHeightRef.current + deltaPercent));
    
    setBrowserHeight(newHeight);
  };
  
  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  /**
   * Formatta la dimensione del file
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  /**
   * Formatta la data
   */
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div 
      className="track-browser"
      ref={browserRef}
      style={{ height: `${browserHeight}%` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Resize handle */}
      <div 
        className="browser-resize-handle"
        onMouseDown={handleResizeStart}
        style={{ cursor: isResizing ? 'ns-resize' : 'row-resize' }}
      >
        <div className="resize-indicator"></div>
      </div>
      
      {/* Header del browser */}
      <div className="browser-header">
        <div className="browser-title">
          <h3>TRACK COLLECTION</h3>
          <span className="track-count">{tracks.length} tracce</span>
        </div>
        
        <div className="browser-actions">
          <button 
            className="load-track-btn"
            onClick={handleLoadClick}
            title="Carica file audio"
          >
            + Carica Traccia
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      
      {/* Lista tracce */}
      <div className="browser-content">
        {tracks.length === 0 ? (
          <div className="browser-empty">
            <p>Nessuna traccia caricata</p>
            <p className="browser-empty-hint">
              Trascina file audio qui o clicca su "Carica Traccia"
            </p>
          </div>
        ) : (
          <div className="tracks-list">
            {tracks.map(track => (
              <div
                key={track.id}
                className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
                onClick={() => setSelectedTrack(track)}
                onDoubleClick={() => handleTrackDoubleClick(track)}
                title="Doppio click per caricare nel Deck A"
              >
                <div className="track-info">
                  <div className="track-name">{track.name}</div>
                  <div className="track-meta">
                    <span>{formatFileSize(track.size)}</span>
                    <span>•</span>
                    <span>{formatDate(track.addedAt)}</span>
                  </div>
                </div>
                
                <div className="track-actions">
                  <button
                    className="track-load-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadTrackToDeck(track, deckA);
                    }}
                    title="Carica nel Deck A"
                  >
                    → A
                  </button>
                  <button
                    className="track-load-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadTrackToDeck(track, deckB);
                    }}
                    title="Carica nel Deck B"
                  >
                    → B
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrackBrowser;


