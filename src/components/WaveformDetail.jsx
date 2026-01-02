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
  const [dragOffsetPixels, setDragOffsetPixels] = useState(0);
  const [dragCurrentTime, setDragCurrentTime] = useState(0);
  const animationFrameRef = useRef(null);
  
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
    
    // Calcola la finestra visibile basata sullo zoom
    const halfWindow = zoomLevel / 2;
    
    // Durante il drag, mantieni la finestra visibile fissa al tempo iniziale del drag
    // e mostra solo il tempo corrente che cambia
    let effectiveTime = currentTime;
    let windowCenterTime = currentTime;
    
    if (isDragging && dragStartTime !== undefined) {
      // Usa il tempo corrente calcolato dal drag
      effectiveTime = dragCurrentTime || dragStartTime;
      // Ma mantieni la finestra visibile centrata sul tempo iniziale del drag
      windowCenterTime = dragStartTime;
    }
    
    const startTime = Math.max(0, windowCenterTime - halfWindow);
    const endTime = Math.min(duration, windowCenterTime + halfWindow);
    
    // Mappa tempo a indici del waveform
    const waveformData = waveformDataRef.current;
    const totalSamples = waveformData.length;
    const startIndex = Math.floor((startTime / duration) * totalSamples);
    const endIndex = Math.ceil((endTime / duration) * totalSamples);
    const visibleSamples = endIndex - startIndex;
    
    if (visibleSamples <= 0) return;
    
    const barWidth = width / visibleSamples;
    
    // Disegna le barre del waveform con dettaglio
    for (let i = 0; i < visibleSamples; i++) {
      const dataIndex = startIndex + i;
      if (dataIndex >= totalSamples) break;
      
      const { max, min, rms } = waveformData[dataIndex];
      
      const maxHeight = Math.abs(max) * centerY * 0.95;
      const minHeight = Math.abs(min) * centerY * 0.95;
      const rmsHeight = rms * centerY * 0.95;
      
      const x = i * barWidth;
      
      // Calcola il tempo di questo campione
      const sampleTime = startTime + (i / visibleSamples) * (endTime - startTime);
      // Durante il drag, confronta con il tempo corrente del drag
      const compareTime = isDragging ? (dragCurrentTime || dragStartTime) : currentTime;
      const isPast = sampleTime < compareTime;
      
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let t = Math.ceil(startTime); t < endTime; t++) {
      const x = ((t - startTime) / (endTime - startTime)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
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
   * Disegna il playhead nella posizione corretta
   */
  const drawPlayhead = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Durante il drag, calcola la posizione X del playhead in base al tempo corrente
    let x = width / 2; // Default: centro
    
    if (isDragging && dragCurrentTime !== undefined && dragStartTime !== undefined) {
      // Calcola la posizione X del playhead in base al tempo corrente del drag
      const halfWindow = zoomLevel / 2;
      const startTime = Math.max(0, dragStartTime - halfWindow);
      const endTime = Math.min(duration, dragStartTime + halfWindow);
      const timeRange = endTime - startTime;
      
      if (timeRange > 0) {
        const progress = (dragCurrentTime - startTime) / timeRange;
        x = progress * width;
        x = Math.max(0, Math.min(width, x));
      }
    }
    
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
   * Calcola il tempo corrispondente a una posizione X nel canvas
   * Durante il drag, usa il tempo corrente come riferimento per la finestra visibile
   */
  const getTimeFromX = useCallback((x, canvas, referenceTime) => {
    if (!canvas || !duration) return referenceTime;
    
    const width = canvas.width;
    const halfWindow = zoomLevel / 2;
    
    // Calcola la finestra visibile basata sul tempo di riferimento
    const startTime = Math.max(0, referenceTime - halfWindow);
    const endTime = Math.min(duration, referenceTime + halfWindow);
    const timeRange = endTime - startTime;
    
    // La posizione X nel canvas corrisponde a un tempo nella finestra visibile
    const progress = Math.max(0, Math.min(1, x / width));
    const time = startTime + progress * timeRange;
    
    return Math.max(0, Math.min(duration, time));
  }, [duration, zoomLevel]);

  /**
   * Inizio drag
   */
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Posizione relativa al canvas
    
    // Calcola il tempo corrispondente al punto dove l'utente ha cliccato
    const clickTime = getTimeFromX(x, canvas, currentTime);
    
    setIsDragging(true);
    setDragStartX(x);
    setDragStartTime(clickTime);
    setDragCurrentTime(clickTime);
    setDragOffsetPixels(0);
    e.preventDefault();
  };
  
  /**
   * Drag in corso - calcola il tempo dal delta X
   */
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left; // Posizione relativa al canvas
    
    // Calcola il delta X (positivo = drag a destra, negativo = drag a sinistra)
    const deltaX = currentX - dragStartX;
    
    // Converti delta X in delta tempo usando la scala corrente
    const pixelsPerSecond = canvas.width / zoomLevel;
    // Drag a sinistra (deltaX negativo) = andare avanti nel tempo (deltaTime positivo)
    // Drag a destra (deltaX positivo) = andare indietro nel tempo (deltaTime negativo)
    const deltaTime = -deltaX / pixelsPerSecond;
    
    // Calcola il nuovo tempo
    const newTime = dragStartTime + deltaTime;
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    
    // Aggiorna il tempo corrente del drag
    setDragCurrentTime(clampedTime);
    
    // Aggiorna l'offset in pixel per il rendering visivo
    setDragOffsetPixels(deltaX);
    
    e.preventDefault();
  };
  
  /**
   * Fine drag - fai seek al tempo calcolato
   */
  const handleMouseUp = (e) => {
    if (isDragging && onSeek && duration) {
      const canvas = canvasRef.current;
      if (canvas && Math.abs(dragOffsetPixels) > 2 && dragCurrentTime !== undefined) {
        // Usa il tempo corrente calcolato durante il drag
        onSeek(dragCurrentTime);
      }
      
      setIsDragging(false);
      setDragOffsetPixels(0);
      setDragCurrentTime(0);
    }
  };
  
  /**
   * Mouse esce dal canvas durante drag
   */
  const handleMouseLeave = () => {
    // Non terminare il drag, continua a seguire il mouse globalmente
  };
  
  /**
   * Click per cercare (solo se non era un drag)
   */
  const handleCanvasClick = (e) => {
    // Non fare seek se era un drag
    if (Math.abs(dragOffsetPixels) > 2) return;
    
    if (!duration || !onSeek) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / canvas.width;
    
    const halfWindow = zoomLevel / 2;
    const startTime = Math.max(0, currentTime - halfWindow);
    const endTime = Math.min(duration, currentTime + halfWindow);
    
    const seekTime = startTime + progress * (endTime - startTime);
    onSeek(seekTime);
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
   * Aggiorna quando cambia il tempo, zoom o offset drag
   */
  useEffect(() => {
    if (waveformDataRef.current) {
      drawWaveform();
    }
  }, [currentTime, duration, zoomLevel, isDragging, dragOffsetPixels, dragStartTime, dragCurrentTime]);
  
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
   * Cleanup animation frame al unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  /**
   * Event listeners per drag globale
   */
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => handleMouseMove(e);
      const handleUp = (e) => handleMouseUp(e);
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging, dragStartX, dragStartTime, dragOffsetPixels, duration, zoomLevel, onSeek]);
  
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
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      />
    </div>
  );
}

export default WaveformDetail;

