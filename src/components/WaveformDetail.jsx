import React, { useEffect, useRef, useState } from 'react';
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
  const dragOffsetRef = useRef(0);
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
    const startTime = Math.max(0, currentTime - halfWindow);
    const endTime = Math.min(duration, currentTime + halfWindow);
    
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
      const isPast = sampleTime < currentTime;
      
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
   * Disegna il playhead al centro (posizione corrente)
   */
  const drawPlayhead = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Il playhead è sempre al centro nella vista zoom
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
   * Inizio drag
   */
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartTime(currentTime);
    dragOffsetRef.current = 0;
    e.preventDefault();
  };
  
  /**
   * Drag in corso
   */
  const handleMouseMove = (e) => {
    if (!isDragging || !duration || !onSeek) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calcola quanto si è mosso il mouse in pixel
    const deltaX = dragStartX - e.clientX;
    
    // Converti pixel in tempo basato sullo zoom
    // Più pixel = più tempo da saltare
    const pixelsPerSecond = canvas.width / zoomLevel;
    const deltaTime = deltaX / pixelsPerSecond;
    
    // Nuovo tempo = tempo iniziale + delta
    let newTime = dragStartTime + deltaTime;
    
    // Clamp tra 0 e durata
    newTime = Math.max(0, Math.min(duration, newTime));
    
    // Aggiorna il tempo (questo triggera il ridisegno)
    dragOffsetRef.current = deltaTime;
    
    // Usa requestAnimationFrame per smooth updates
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      onSeek(newTime);
    });
  };
  
  /**
   * Fine drag
   */
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      dragOffsetRef.current = 0;
    }
  };
  
  /**
   * Mouse esce dal canvas durante drag
   */
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      dragOffsetRef.current = 0;
    }
  };
  
  /**
   * Click per cercare (solo se non era un drag)
   */
  const handleCanvasClick = (e) => {
    // Non fare seek se era un drag
    if (Math.abs(dragOffsetRef.current) > 0.1) return;
    
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
   * Aggiorna quando cambia il tempo o lo zoom
   */
  useEffect(() => {
    if (waveformDataRef.current) {
      drawWaveform();
    }
  }, [currentTime, duration, zoomLevel]);
  
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
      const handleUp = () => handleMouseUp();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    }
  }, [isDragging]);
  
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

