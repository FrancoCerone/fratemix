import React, { useRef, useEffect, useState } from 'react';
import './CustomKnob.css';

/**
 * Componente Knob personalizzato che funziona sempre, anche durante la riproduzione
 */
function CustomKnob({ 
  value, 
  onChange, 
  min = -12, 
  max = 12, 
  step = 0.1,
  size = 75,
  disabled = false,
  label = '',
  valueTemplate = null
}) {
  const knobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [angle, setAngle] = useState(0);
  
  // Calcola l'angolo iniziale dal valore
  useEffect(() => {
    const normalizedValue = (value - min) / (max - min);
    const newAngle = -135 + (normalizedValue * 270); // Da -135° a +135°
    setAngle(newAngle);
  }, [value, min, max]);
  
  const handleMouseDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    
    const knob = knobRef.current;
    const rect = knob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const handleMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - centerX;
      const y = moveEvent.clientY - centerY;
      
      // Calcola l'angolo dal centro
      let newAngle = Math.atan2(y, x) * (180 / Math.PI);
      newAngle += 90; // Aggiusta per avere 0° in alto
      
      // Normalizza l'angolo tra -135° e +135°
      if (newAngle > 180) newAngle -= 360;
      newAngle = Math.max(-135, Math.min(135, newAngle));
      
      // Converti angolo in valore
      const normalizedValue = (newAngle + 135) / 270;
      const newValue = min + normalizedValue * (max - min);
      const steppedValue = Math.round(newValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));
      
      if (onChange && typeof onChange === 'function') {
        onChange(clampedValue);
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Chiama immediatamente per il primo movimento
    handleMouseMove(e);
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleWheel = (e) => {
    if (disabled) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    const newValue = Math.max(min, Math.min(max, value + delta));
    if (onChange && typeof onChange === 'function') {
      onChange(newValue);
    }
  };
  
  // Gestisce il valueTemplate: se contiene {value}, lo sostituisce, altrimenti usa il template direttamente
  const displayValue = valueTemplate 
    ? (valueTemplate.includes('{value}') 
        ? valueTemplate.replace('{value}', value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1))
        : valueTemplate)
    : `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
  
  return (
    <div 
      className={`custom-knob ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ width: size, height: size }}
      onWheel={handleWheel}
    >
      <svg
        ref={knobRef}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="knob-svg"
        onMouseDown={handleMouseDown}
        style={{ cursor: disabled ? 'not-allowed' : 'grab' }}
      >
        {/* Cerchio esterno */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="4"
          className="knob-track"
        />
        
        
        {/* Indicatore (linea) */}
        <line
          x1="50"
          y1="50"
          x2={50 + 35 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={50 + 35 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke="#4a90e2"
          strokeWidth="3"
          strokeLinecap="round"
          className="knob-indicator"
        />
        
        {/* Punto centrale */}
        <circle
          cx="50"
          cy="50"
          r="3"
          fill="#4a90e2"
          className="knob-center"
        />
      </svg>
      
      {/* Valore testuale */}
      <div className="knob-value-text">
        {displayValue}
      </div>
    </div>
  );
}

// Memoizza il componente per evitare re-render inutili
export default React.memo(CustomKnob);
