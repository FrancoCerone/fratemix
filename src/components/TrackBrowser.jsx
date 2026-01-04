import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchAudioFilesFromDrive, convertDriveFileToTrack, downloadAudioFile } from '../services/googleDriveService';
import './TrackBrowser.css';

/**
 * Componente TrackBrowser - Browser per la selezione e caricamento tracce
 * 
 * Permette di:
 * - Caricare automaticamente file audio da Google Drive
 * - Caricare file audio dal file system locale
 * - Visualizzare le tracce caricate
 * - Selezionare e caricare tracce nei deck
 * - Gestire una libreria di tracce
 */
function TrackBrowser({ onLoadTrack, deckA, deckB }) {
  const [tracks, setTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [browserHeight, setBrowserHeight] = useState(20); // Percentuale di altezza
  const [isResizing, setIsResizing] = useState(false);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const fileInputRef = useRef(null);
  const browserRef = useRef(null);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);
  const hasLoadedRemoteTracks = useRef(false);
  
  /**
   * Carica automaticamente le tracce da Google Drive all'avvio
   */
  useEffect(() => {
    const loadRemoteTracks = async () => {
      // Carica solo una volta
      if (hasLoadedRemoteTracks.current) return;
      
      setIsLoadingRemote(true);
      console.log('🎵 Caricamento tracce da Google Drive...');
      
      try {
        // Recupera i file dalla cartella Google Drive
        const driveFiles = await fetchAudioFilesFromDrive();
        
        if (driveFiles.length > 0) {
          // Converti i file in oggetti Track
          const remoteTracks = driveFiles.map(convertDriveFileToTrack);
          
          setTracks(remoteTracks);
          setSelectedTrack(remoteTracks[0]);
          
          console.log(`✅ ${remoteTracks.length} tracce caricate da Google Drive`);
        } else {
          console.log('⚠️ Nessuna traccia trovata su Google Drive');
        }
        
        hasLoadedRemoteTracks.current = true;
      } catch (error) {
        console.error('❌ Errore caricamento tracce remote:', error);
      } finally {
        setIsLoadingRemote(false);
      }
    };
    
    loadRemoteTracks();
  }, []);
  
  /**
   * Carica un file audio e lo aggiunge alla libreria
   */
  const handleFileLoad = useCallback(async (file) => {
    if (!file) return;
    
    // Controlla se la traccia è già presente
    const isDuplicate = tracks.some(t => 
      t.name === file.name && t.size === file.size
    );
    
    if (isDuplicate) {
      console.log('⚠️ Traccia già presente nella libreria:', file.name);
      return;
    }
    
    // Crea un oggetto traccia con metadati
    const track = {
      id: `local_${Date.now()}_${Math.random()}`,
      name: file.name,
      file: file,
      size: file.size,
      type: file.type,
      addedAt: new Date(),
      isRemote: false
    };
    
    setTracks(prev => [...prev, track]);
    setSelectedTrack(track);
  }, [tracks]);
  
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
   * Carica una traccia nel deck specificato (con supporto per file remoti)
   */
  const loadTrackToDeck = useCallback(async (track, deck) => {
    if (!track || !deck) return;
    
    try {
      if (track.isRemote && track.fileId) {
        // Scarica il file da Google Drive
        console.log(`⬇️ Download traccia remota: ${track.name}`);
        const file = await downloadAudioFile(track.fileId, track.name);
        await deck.loadAudioFile(file);
      } else if (track.file) {
        // File locale già disponibile
        await deck.loadAudioFile(track.file);
      }
    } catch (error) {
      console.error('❌ Errore caricamento traccia nel deck:', error);
      alert(error.message || `Errore nel caricamento di ${track.name}`);
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
    e.preventDefault();
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = browserHeight;
  };
  
  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    
    e.preventDefault();
    
    const deltaY = resizeStartYRef.current - e.clientY; // Positivo quando si va su
    const windowHeight = window.innerHeight;
    const deltaPercent = (deltaY / windowHeight) * 100;
    const newHeight = Math.max(10, Math.min(60, resizeStartHeightRef.current + deltaPercent));
    
    setBrowserHeight(newHeight);
  }, [isResizing, browserHeight]);
  
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);
  
  /**
   * Event listeners globali per il resize
   * Permette di continuare il resize anche quando il mouse esce dal handle
   */
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);
  
  /**
   * Formatta la dimensione del file
   */
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'N/A';
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
      className={`track-browser ${isResizing ? 'resizing' : ''}`}
      ref={browserRef}
      style={{ height: `${browserHeight}%` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Resize handle */}
      <div 
        className={`browser-resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      >
        <div className="resize-indicator"></div>
      </div>
      
      {/* Header del browser */}
      <div className="browser-header">
        <div className="browser-title">
          <h3>TRACK COLLECTION</h3>
          <span className="track-count">
            {tracks.length} tracce
            {isLoadingRemote && ' (caricamento...)'}
          </span>
        </div>
        
        <div className="browser-actions">
          <button 
            className="load-track-btn"
            onClick={handleLoadClick}
            title="Carica file audio locale"
          >
            + Carica File Locale
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
            <p>
              {isLoadingRemote 
                ? '🔄 Caricamento tracce da Google Drive...' 
                : 'Nessuna traccia disponibile'}
            </p>
            <p className="browser-empty-hint">
              {isLoadingRemote 
                ? 'Attendi qualche secondo...'
                : 'Trascina file audio qui o clicca su "Carica File Locale"'}
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
                  <div className="track-name">
                    {track.isRemote && <span className="remote-badge" title="File su Google Drive">☁️ </span>}
                    {track.name}
                  </div>
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


