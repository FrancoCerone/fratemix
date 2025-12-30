import React, { useEffect, useRef } from 'react';
import './WaveformOverview.css';

/**
 * WaveformOverview - Waveform compatto che mostra l'intera traccia
 * Usato per navigazione e overview generale
 */
function WaveformOverview({ audioBuffer, currentTime, duration, onSeek }) {
  const canvasRef = useRef(null);
  const waveformDataRef = useRef(null);
  
  /**
   * Estrae i dati del waveform dall'AudioBuffer
   */
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const channelData = audioBuffer.getChannelData(0);
    const length = channelData.length;
    
    // Riduci la risoluzione per performance
    const samples = 1500;
    const step = Math.floor(length / samples);
    const waveformData = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * step;
      const end = Math.min(start + step, length);
      
      let max = 0;
      let min = 0;
      
      for (let j = start; j < end; j++) {
        const value = channelData[j];
        if (value > max) max = value;
        if (value < min) min = value;
      }
      
      waveformData.push({ max, min });
    }
    
    waveformDataRef.current = waveformData;
    drawWaveform();
  }, [audioBuffer]);
  
  /**
   * Disegna il waveform compatto
   */
  const drawWaveform = () => {
    if (!canvasRef.current || !waveformDataRef.current || !duration) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Imposta dimensioni
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const waveformData = waveformDataRef.current;
    const samples = waveformData.length;
    
    // Sfondo
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);
    
    // Disegna waveform con colori arcobaleno
    const barWidth = width / samples;
    
    const colors = [
      { r: 255, g: 100, b: 100 },  // Rosso
      { r: 255, g: 150, b: 50 },   // Arancione
      { r: 255, g: 200, b: 100 },  // Giallo
      { r: 100, g: 255, b: 150 },  // Verde
      { r: 100, g: 200, b: 255 },  // Azzurro
      { r: 150, g: 100, b: 255 },  // Viola
    ];
    
    for (let i = 0; i < samples; i++) {
      const { max, min } = waveformData[i];
      
      const maxHeight = Math.abs(max) * centerY * 0.8;
      const minHeight = Math.abs(min) * centerY * 0.8;
      
      const x = i * barWidth;
      
      // Colore basato sulla posizione
      const colorIndex = Math.floor((i / samples) * colors.length);
      const color = colors[colorIndex % colors.length];
      
      // Barra superiore
      if (maxHeight > 0.3) {
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
        ctx.fillRect(x, centerY - maxHeight, barWidth, maxHeight);
      }
      
      // Barra inferiore
      if (minHeight > 0.3) {
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;
        ctx.fillRect(x, centerY, barWidth, minHeight);
      }
    }
    
    // Linea centrale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Playhead
    drawPlayhead();
  };
  
  /**
   * Disegna il cursore di posizione
   */
  const drawPlayhead = () => {
    if (!canvasRef.current || !duration) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const progress = duration > 0 ? currentTime / duration : 0;
    const x = progress * width;
    
    // Cursore bianco brillante
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  
  /**
   * Click per cercare
   */
  const handleCanvasClick = (e) => {
    if (!duration || !onSeek) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / canvas.width;
    const seekTime = progress * duration;
    
    onSeek(seekTime);
  };
  
  /**
   * Aggiorna quando cambia il tempo
   */
  useEffect(() => {
    if (waveformDataRef.current) {
      drawWaveform();
    }
  }, [currentTime, duration]);
  
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
  
  return (
    <div className="waveform-overview-container">
      <canvas 
        ref={canvasRef} 
        className="waveform-overview-canvas"
        onClick={handleCanvasClick}
        style={{ cursor: onSeek ? 'pointer' : 'default' }}
      />
    </div>
  );
}

export default WaveformOverview;

