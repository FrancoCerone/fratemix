import React, { useEffect, useRef, useState } from 'react';
import './Waveform.css';

/**
 * Componente Waveform - Visualizza la forma d'onda completa del brano
 * 
 * Analizza l'intero AudioBuffer e disegna il waveform completo
 * con un cursore che indica la posizione corrente nella traccia
 */
function Waveform({ audioBuffer, isPlaying, currentTime, duration, onSeek }) {
  const canvasRef = useRef(null);
  const waveformDataRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  /**
   * Estrae i dati del waveform dall'AudioBuffer
   * Analizza l'intero buffer e crea un array di punti per il waveform
   */
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Ottieni i dati PCM dal primo canale (mono) o media dei canali (stereo)
    const channelData = audioBuffer.getChannelData(0);
    const length = channelData.length;
    
    // Riduci la risoluzione per performance (prendi un campione ogni N punti)
    const samples = 2000; // Numero di punti da visualizzare
    const step = Math.floor(length / samples);
    const waveformData = [];
    
    for (let i = 0; i < samples; i++) {
      const start = i * step;
      const end = Math.min(start + step, length);
      
      // Calcola il valore massimo e minimo in questo intervallo
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
    
    // Disegna il waveform
    drawWaveform();
  }, [audioBuffer]);
  
  /**
   * Disegna il waveform completo sul canvas
   */
  const drawWaveform = () => {
    if (!canvasRef.current || !waveformDataRef.current || !duration) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Imposta dimensioni canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const waveformData = waveformDataRef.current;
    const samples = waveformData.length;
    
    // Sfondo
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    // Disegna il waveform
    const barWidth = width / samples;
    
    // Colori per il waveform (simile a Traktor)
    const colors = [
      { r: 255, g: 100, b: 100 }, // Rosso
      { r: 255, g: 150, b: 50 },  // Arancione
      { r: 255, g: 200, b: 100 }, // Giallo
      { r: 100, g: 255, b: 150 }, // Verde
      { r: 100, g: 200, b: 255 }, // Azzurro
      { r: 150, g: 100, b: 255 }, // Viola
    ];
    
    for (let i = 0; i < samples; i++) {
      const { max, min } = waveformData[i];
      
      // Calcola l'altezza delle barre (normalizza tra -1 e 1)
      const maxHeight = Math.abs(max) * centerY * 0.9;
      const minHeight = Math.abs(min) * centerY * 0.9;
      
      const x = i * barWidth;
      
      // Scegli colore basato sulla posizione
      const colorIndex = Math.floor((i / samples) * colors.length);
      const color = colors[colorIndex % colors.length];
      
      // Disegna la barra superiore (max)
      if (maxHeight > 0.5) {
        const gradient = ctx.createLinearGradient(x, centerY - maxHeight, x, centerY);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY - maxHeight, barWidth, maxHeight);
      }
      
      // Disegna la barra inferiore (min)
      if (minHeight > 0.5) {
        const gradient = ctx.createLinearGradient(x, centerY, x, centerY + minHeight);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, centerY, barWidth, minHeight);
      }
    }
    
    // Disegna la linea centrale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // Disegna il cursore di posizione
    drawPlayhead();
  };
  
  /**
   * Disegna il cursore che indica la posizione corrente
   */
  const drawPlayhead = () => {
    if (!canvasRef.current || !duration) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Calcola la posizione X del cursore
    const progress = duration > 0 ? currentTime / duration : 0;
    const x = progress * width;
    
    // Disegna il cursore (linea verticale)
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4a90e2';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Disegna un punto più grande al centro
    ctx.fillStyle = '#4a90e2';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset shadow
    ctx.shadowBlur = 0;
  };
  
  /**
   * Gestisce il click sul waveform per cercare una posizione
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
   * Aggiorna il disegno quando cambia il tempo corrente
   */
  useEffect(() => {
    if (waveformDataRef.current) {
      drawWaveform();
    }
  }, [currentTime, duration]);
  
  /**
   * Ridisegna quando il canvas viene ridimensionato
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
    <div className="waveform-container">
      <canvas 
        ref={canvasRef} 
        className="waveform-canvas"
        onClick={handleCanvasClick}
        style={{ cursor: onSeek ? 'pointer' : 'default' }}
        title={onSeek ? 'Clicca per cercare una posizione' : ''}
      />
    </div>
  );
}

export default Waveform;
