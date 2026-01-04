import React, { useEffect, useRef, useState, useCallback } from 'react';
import './WaveformDetail.css';

/**
 * WaveformDetail - Waveform zoomabile che mostra la sezione corrente in dettaglio
 * Simile alla vista dettaglio di Traktor
 */
function WaveformDetail({ audioBuffer, currentTime, duration, onSeek }) {
  const canvasRef = useRef(null);
  const waveformDataRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(4); // 4 secondi visibili
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragWindowCenterTime, setDragWindowCenterTime] = useState(0);
  
  /**
   * Estrae i dati del waveform ad alta risoluzione
   */
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Alta risoluzione per il dettaglio
    const samples = 3000;
    const samplesPerPixel = Math.floor(channelData.length / samples);
    const waveformData = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      
      let max = 0;
      let min = 0;
      let rms = 0;
      
      for (let j = start; j < end; j++) {
        const value = channelData[j];
        if (value > max) max = value;
        if (value < min) min = value;
        rms += value * value;
      }
      
      rms = Math.sqrt(rms / (end - start));
      
      waveformData.push({ max, min, rms });
    }
    
    waveformDataRef.current = waveformData;
    drawWaveform();
  }, [audioBuffer]);
  
  /**
   * Calcola il centro della finestra visibile basandosi su currentTime
   * Il cursore bianco è sempre al centro, quindi la finestra si centra su currentTime
   * Durante il drag, usa dragWindowCenterTime per spostare la traccia
   * @returns {number} Il tempo al centro della finestra visibile (in secondi)
   */
  const calculateWindowCenterTime = () => {
    // Durante il drag, usa il tempo calcolato dal movimento del mouse
    if (isDragging && dragWindowCenterTime !== undefined) {
      return dragWindowCenterTime;
    }
    
    const halfWindow = zoomLevel / 2;
    
    // Quando non è in drag, centra la finestra in modo che il cursore sia sempre al centro
    // Se currentTime è vicino all'inizio, sposta il centro in avanti
    if (currentTime < halfWindow) {
      return halfWindow;
    }
    
    // Se currentTime è vicino alla fine, sposta il centro indietro
    if (currentTime > duration - halfWindow) {
      return duration - halfWindow;
    }
    
    // Altrimenti, il centro è esattamente currentTime
    return currentTime;
  };
  
  /**
   * Calcola l'inizio e la fine della finestra visibile
   * @param {number} windowCenterTime - Il tempo al centro della finestra
   * @returns {{startTime: number, endTime: number, clampedStartTime: number, clampedEndTime: number}}
   */
  const calculateVisibleWindow = (windowCenterTime) => {
    const halfWindow = zoomLevel / 2;
    
    // Calcola l'inizio e la fine della finestra visibile
    // Durante il drag, questi valori possono essere negativi o > duration
    const startTime = windowCenterTime - halfWindow;
    const endTime = windowCenterTime + halfWindow;
    
    // Per il rendering, limitiamo i tempi alla durata della traccia
    const clampedStartTime = Math.max(0, startTime);
    const clampedEndTime = Math.min(duration, endTime);
    
    return { startTime, endTime, clampedStartTime, clampedEndTime };
  };
  
  /**
   * Calcola gli indici del waveform per la parte visibile
   * @param {number} clampedStartTime - Inizio della finestra clampato
   * @param {number} clampedEndTime - Fine della finestra clampata
   * @returns {{clampedStartIndex: number, clampedEndIndex: number, visibleSamples: number}}
   */
  const calculateWaveformIndices = (clampedStartTime, clampedEndTime) => {
    const waveformData = waveformDataRef.current;
    if (!waveformData) return { clampedStartIndex: 0, clampedEndIndex: 0, visibleSamples: 0 };
    
    const totalSamples = waveformData.length;
    const clampedStartIndex = Math.max(0, Math.floor((clampedStartTime / duration) * totalSamples));
    const clampedEndIndex = Math.min(totalSamples, Math.ceil((clampedEndTime / duration) * totalSamples));
    const visibleSamples = clampedEndIndex - clampedStartIndex;
    
    return { clampedStartIndex, clampedEndIndex, visibleSamples };
  };
  
  /**
   * Calcola la posizione X di una barra del waveform nel canvas
   * @param {number} sampleTime - Il tempo del campione (in secondi)
   * @param {number} startTime - Inizio della finestra visibile (non clampato)
   * @param {number} endTime - Fine della finestra visibile (non clampato)
   * @param {number} canvasWidth - Larghezza del canvas
   * @returns {number} La posizione X della barra nel canvas
   */
  const calculateBarPosition = (sampleTime, startTime, endTime, canvasWidth) => {
    const totalWindowTime = endTime - startTime;
    if (totalWindowTime <= 0) return 0;
    
    // Calcola l'offset X per le aree prima dell'inizio della traccia
    // Se startTime < 0, dobbiamo spostare il rendering a destra per mostrare l'area nera
    const offsetX = startTime < 0 ? (Math.abs(startTime) / totalWindowTime) * canvasWidth : 0;
    
    // Calcola la posizione X basata sul progresso nella finestra
    const progressInWindow = (sampleTime - startTime) / totalWindowTime;
    return offsetX + progressInWindow * canvasWidth;
  };
  
  /**
   * Calcola il tempo corrispondente al cursore bianco (sempre al centro del canvas)
   * @param {number} windowCenterTime - Il tempo al centro della finestra visibile
   * @returns {number} Il tempo corrispondente al cursore bianco
   */
  const getCursorTime = (windowCenterTime) => {
    // Il cursore bianco è sempre al centro del canvas
    // Il centro del canvas corrisponde al centro della finestra visibile
    return windowCenterTime;
  };
  
  /**
   * Disegna il waveform zoomato sulla sezione corrente
   */
  const drawWaveform = () => {
    if (!canvasRef.current || !waveformDataRef.current || !duration) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    
    // Sfondo
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Calcola il centro della finestra visibile
    const windowCenterTime = calculateWindowCenterTime();
    
    // Calcola la finestra visibile
    const { startTime, endTime, clampedStartTime, clampedEndTime } = calculateVisibleWindow(windowCenterTime);
    
    // Calcola gli indici del waveform visibile
    const { clampedStartIndex, clampedEndIndex, visibleSamples } = calculateWaveformIndices(clampedStartTime, clampedEndTime);
    
    if (visibleSamples <= 0) return;
    
    const waveformData = waveformDataRef.current;
    const totalSamples = waveformData.length;
    const totalWindowTime = endTime - startTime;
    
    // Calcola la larghezza di ogni barra
    const barWidth = totalWindowTime > 0 ? (width / (totalWindowTime / (zoomLevel / totalSamples))) : 0;
    
    // Il cursore bianco è sempre al centro e corrisponde a currentTime
    // (non windowCenterTime, perché windowCenterTime può essere aggiustato per centrare la finestra)
    const cursorTime = currentTime;
    
    // Disegna le barre del waveform
    for (let i = 0; i < visibleSamples; i++) {
      const dataIndex = clampedStartIndex + i;
      if (dataIndex < 0 || dataIndex >= totalSamples) continue;
      
      // Estrae i dati del waveform per questo campione
      const { max, min, rms } = waveformData[dataIndex];
      
      const maxHeight = Math.abs(max) * centerY * 0.95;
      const minHeight = Math.abs(min) * centerY * 0.95;
      const rmsHeight = rms * centerY * 0.95;
      
      // Calcola il tempo del campione
      const sampleTime = (dataIndex / totalSamples) * duration;
      
      // Calcola la posizione X della barra nel canvas
      const x = calculateBarPosition(sampleTime, startTime, endTime, width);
      
      // Determina se il campione è passato o futuro rispetto al cursore (currentTime)
      const isPast = sampleTime < cursorTime;
      
      // Colore basato su se è passato o futuro
      const baseColor = isPast 
        ? { r: 74, g: 144, b: 226 }  // Blu (passato)
        : { r: 100, g: 100, b: 100 }; // Grigio (futuro)
      
      // Barra superiore (max)
      if (maxHeight > 0.3) {
        const gradient = ctx.createLinearGradient(x, centerY - maxHeight, x, centerY);
        gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 1)`);
        gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - maxHeight, Math.max(barWidth, 1), maxHeight);
      }
      
      // Barra inferiore (min)
      if (minHeight > 0.3) {
        const gradient = ctx.createLinearGradient(x, centerY, x, centerY + minHeight);
        gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`);
        gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 1)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY, Math.max(barWidth, 1), minHeight);
      }
      
      // RMS indicator (volume medio)
      if (rmsHeight > 1 && barWidth > 2) {
        ctx.fillStyle = `rgba(${baseColor.r + 50}, ${baseColor.g + 50}, ${baseColor.b + 50}, 0.4)`;
        ctx.fillRect(x, centerY - rmsHeight, barWidth, rmsHeight * 2);
      }
    }
    
    // Grid verticali (ogni secondo)
    // Disegna le linee solo per i secondi che sono dentro la traccia
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let t = Math.ceil(clampedStartTime); t < clampedEndTime; t++) {
      // Calcola la posizione X della linea usando il metodo dedicato
      const x = calculateBarPosition(t, startTime, endTime, width);
      // Disegna solo se la linea è dentro il canvas
      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    
    // Linea centrale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Playhead al centro
    drawPlayhead();
  };
  
  /**
   * Disegna il playhead sempre al centro
   */
  const drawPlayhead = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Il playhead è sempre al centro
    const x = width / 2;
    
    // Linea playhead luminosa
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Punto al centro
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, height / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
  };
  
  /**
   * Inizio drag - cattura la posizione iniziale del mouse e il tempo corrente
   */
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Posizione X del mouse relativa al canvas
    
    // Calcola il tempo corrente al centro della finestra visibile
    const windowCenterTime = calculateWindowCenterTime();
    
    // Attiva il drag e salva i valori iniziali
    setIsDragging(true);
    setDragStartX(x);
    setDragStartTime(windowCenterTime);
    setDragWindowCenterTime(windowCenterTime);
    
    e.preventDefault();
  };
  
  /**
   * Drag in corso - sposta la finestra visibile
   * Il cursore bianco rimane sempre al centro, la traccia si sposta sotto
   */
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    
    // Calcola quanto si è mosso il mouse
    const deltaX = currentX - dragStartX;
    
    // Converti il movimento in pixel in movimento in tempo
    const pixelsPerSecond = canvas.width / zoomLevel;
    
    // Drag a sinistra (deltaX negativo) = spostare la finestra avanti nel tempo
    // Drag a destra (deltaX positivo) = spostare la finestra indietro nel tempo
    const deltaTime = -deltaX / pixelsPerSecond;
    
    // Calcola il nuovo centro della finestra visibile
    const newWindowCenterTime = dragStartTime + deltaTime;
    
    // Aggiorna il centro della finestra visibile durante il drag
    setDragWindowCenterTime(newWindowCenterTime);
    
    e.preventDefault();
  }, [isDragging, dragStartX, dragStartTime, zoomLevel]);
  
  /**
   * Fine drag - applica il seek al tempo corrispondente al cursore bianco
   * Il cursore bianco è sempre al centro, quindi il tempo è windowCenterTime
   * Calcola il delta X finale per ottenere la posizione corretta
   */
  const handleMouseUp = useCallback((e) => {
    if (isDragging && onSeek && duration) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left; // Posizione X finale del mouse
        
        // Calcola il delta X finale
        const deltaX = currentX - dragStartX;
        
        // Se non c'è stato movimento, usa il tempo corrente (come se non ci fosse stato drag)
        if (deltaX === 0) {
          // Imposta il tempo attuale come se il Drag&Drop non ci fosse stato
          onSeek(currentTime);
        } else {
          // Converti il movimento in pixel in movimento in tempo
          const pixelsPerSecond = canvas.width / zoomLevel;
          
          // Drag a sinistra (deltaX negativo) = spostare la finestra avanti nel tempo (deltaTime positivo)
          // Drag a destra (deltaX positivo) = spostare la finestra indietro nel tempo (deltaTime negativo)
          const deltaTime = -deltaX / pixelsPerSecond;
          
          // Calcola il tempo finale basandosi sul tempo iniziale e sul delta del drag
          // correttamente proporzionato rispetto al centro
          const finalWindowCenterTime = dragStartTime + deltaTime;
          
          // Il cursore bianco è sempre al centro, quindi il tempo corrisponde
          // al centro della finestra visibile finale
          const seekTime = Math.max(0, Math.min(duration, finalWindowCenterTime));
          onSeek(seekTime);
        }
      }
    }
    
    // Reset dello stato del drag
    setIsDragging(false);
    setDragStartX(0);
    setDragStartTime(0);
    setDragWindowCenterTime(0);
  }, [isDragging, onSeek, duration, dragStartX, dragStartTime, zoomLevel, currentTime]);
  
  /**
   * Click per cercare una posizione nella traccia (solo se non era un drag)
   */
  const handleCanvasClick = (e) => {
    // Non fare seek se era un drag
    if (isDragging) return;
    
    if (!duration || !onSeek) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Posizione X del click relativa al canvas
    
    // Calcola la finestra visibile corrente
    const windowCenterTime = calculateWindowCenterTime();
    const halfWindow = zoomLevel / 2;
    const startTime = windowCenterTime - halfWindow;
    const endTime = windowCenterTime + halfWindow;
    const totalWindowTime = endTime - startTime;
    
    // Calcola il progresso nella finestra (0 = inizio finestra, 1 = fine finestra)
    const progress = x / canvas.width;
    
    // Calcola il tempo corrispondente alla posizione cliccata
    const seekTime = startTime + progress * totalWindowTime;
    
    // Limita il tempo tra 0 e duration per evitare valori invalidi
    const clampedSeekTime = Math.max(0, Math.min(duration, seekTime));
    
    onSeek(clampedSeekTime);
  };
  
  /**
   * Controlli zoom con rotellina del mouse
   */
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setZoomLevel(prev => Math.max(2, Math.min(20, prev + delta)));
  };
  
  /**
   * Aggiorna quando cambia il tempo, zoom, durata o stato del drag
   * Durante il play, currentTime cambia continuamente e la finestra si aggiorna
   * Quando si clicca sulla traccia, currentTime cambia e la finestra si riposiziona
   * Durante il drag, dragWindowCenterTime cambia e la traccia si sposta
   * La finestra si centra sempre su currentTime (con il cursore bianco al centro)
   */
  useEffect(() => {
    if (waveformDataRef.current && duration > 0) {
      // Forza il ridisegno quando cambia currentTime o durante il drag
      drawWaveform();
    }
  }, [currentTime, duration, zoomLevel, isDragging, dragWindowCenterTime]);
  
  /**
   * Ridisegna al resize
   */
  useEffect(() => {
    const handleResize = () => {
      if (waveformDataRef.current) {
        drawWaveform();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  /**
   * Event listeners globali per il drag
   * Permette di continuare il drag anche quando il mouse esce dal canvas
   */
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  return (
    <div className="waveform-detail-container">
      <div className="waveform-detail-header">
        <span className="zoom-label">
          Zoom: {zoomLevel.toFixed(1)}s
          {isDragging && <span className="drag-indicator"> (dragging...)</span>}
        </span>
        <div className="zoom-controls">
          <button onClick={() => setZoomLevel(prev => Math.max(2, prev - 1))} title="Zoom In">+</button>
          <button onClick={() => setZoomLevel(prev => Math.min(20, prev + 1))} title="Zoom Out">-</button>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        className={`waveform-detail-canvas ${isDragging ? 'dragging' : ''}`}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{ 
          cursor: isDragging ? 'grabbing' : (onSeek ? 'grab' : 'default')
        }}
      />
    </div>
  );
}

export default WaveformDetail;

