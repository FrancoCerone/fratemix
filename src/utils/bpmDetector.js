/**
 * BPM Detector usando realtime-bpm-analyzer
 * 
 * Usa la libreria professionale realtime-bpm-analyzer per analisi BPM accurata
 * Mantiene un algoritmo di fallback per compatibilità
 */

import { createRealtimeBpmAnalyzer } from 'realtime-bpm-analyzer';

/**
 * Rileva il BPM di un AudioBuffer usando realtime-bpm-analyzer
 * @param {AudioBuffer} buffer - Il buffer audio da analizzare
 * @returns {Promise<number>} - BPM stimato
 */
export async function detectBPM(buffer) {
  if (!buffer || buffer.length === 0) {
    return 120; // Default BPM
  }
  
  try {
    console.log('🎵 Inizio analisi BPM con realtime-bpm-analyzer...');
    
    // Crea un AudioContext temporaneo per l'analisi
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    
    // Crea l'analyzer
    const analyzer = await createRealtimeBpmAnalyzer(offlineContext);
    
    // Promise per catturare il BPM rilevato
    const bpmPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: BPM non rilevato entro 10 secondi'));
      }, 10000);
      
      analyzer.on('bpm', (data) => {
        clearTimeout(timeout);
        console.log('📊 Dati BPM ricevuti:', data);
        
        if (data.bpm && data.bpm.length > 0) {
          // Prendi il primo BPM rilevato (solitamente il più accurato)
          const detectedBPM = data.bpm[0].tempo;
          console.log(`✅ BPM rilevato: ${detectedBPM}`);
          resolve(detectedBPM);
        } else {
          reject(new Error('Nessun BPM nei dati'));
        }
      });
    });
    
    // Crea un source buffer per l'analisi
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    
    // Connetti source -> analyzer -> destination
    source.connect(analyzer.node);
    analyzer.node.connect(offlineContext.destination);
    
    // Avvia la riproduzione per l'analisi
    source.start(0);
    
    // Rendi l'audio offline (processa tutto in una volta)
    offlineContext.startRendering();
    
    // Aspetta il risultato
    const bpm = await bpmPromise;
    
    // Arrotonda a 0.1
    return Math.round(bpm * 10) / 10;
    
  } catch (error) {
    console.warn('⚠️ Errore con realtime-bpm-analyzer:', error.message);
    console.log('🔄 Fallback all\'algoritmo interno...');
    
    // Fallback al nostro algoritmo se la libreria fallisce
    return detectBPMFallback(buffer);
  }
}

/**
 * Algoritmo di fallback per rilevamento BPM
 * Versione semplificata del nostro algoritmo precedente
 */
function detectBPMFallback(buffer) {
  try {
    console.log('🎵 Analisi BPM con algoritmo fallback...');
    
    // Ottieni i dati del canale
    const channelData = buffer.numberOfChannels > 1 
      ? averageChannels(buffer) 
      : buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Analizza primi 30 secondi
    const analyzeDuration = Math.min(30, buffer.duration);
    const maxSamples = Math.floor(sampleRate * analyzeDuration);
    
    // Calcola energia in finestre di 100ms
    const windowSize = Math.floor(sampleRate * 0.1);
    const hopSize = Math.floor(windowSize / 2);
    const energyValues = [];
    
    for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = i; j < i + windowSize; j++) {
        energy += channelData[j] * channelData[j];
      }
      energyValues.push(energy / windowSize);
    }
    
    // Trova picchi
    const peaks = findPeaksSimple(energyValues, hopSize, sampleRate);
    
    if (peaks.length < 4) {
      return estimateBPMFromDuration(buffer.duration);
    }
    
    // Calcola intervalli
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      const interval = (peaks[i] - peaks[i - 1]) * hopSize / sampleRate;
      if (interval >= 0.2 && interval <= 2.0) {
        intervals.push(interval);
      }
    }
    
    if (intervals.length === 0) {
      return estimateBPMFromDuration(buffer.duration);
    }
    
    // Media degli intervalli
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    let bpm = 60 / avgInterval;
    
    // Normalizza tra 60-180
    while (bpm < 60) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    
    // Aggiusta a BPM comuni
    const commonBPMs = [120, 128, 125, 130, 140, 150, 160, 174];
    for (let common of commonBPMs) {
      if (Math.abs(bpm - common) < 5) {
        console.log(`🎯 Aggiustato ${bpm.toFixed(1)} → ${common} BPM`);
        bpm = common;
        break;
      }
    }
    
    console.log(`✅ BPM fallback: ${bpm.toFixed(1)}`);
    
    return Math.round(bpm * 10) / 10;
  } catch (error) {
    console.error('❌ Errore anche nel fallback:', error);
    return estimateBPMFromDuration(buffer.duration);
  }
}

/**
 * Trova picchi semplificato
 */
function findPeaksSimple(values, hopSize, sampleRate) {
  const peaks = [];
  const sortedValues = [...values].sort((a, b) => a - b);
  const threshold = sortedValues[Math.floor(sortedValues.length * 0.7)];
  const minPeakDistance = Math.floor(0.3 * sampleRate / hopSize);
  
  let lastPeakIndex = -minPeakDistance;
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > threshold && 
        values[i] > values[i - 1] && 
        values[i] > values[i + 1] &&
        (i - lastPeakIndex) >= minPeakDistance) {
      peaks.push(i);
      lastPeakIndex = i;
    }
  }
  
  return peaks;
}

/**
 * Media i canali stereo
 */
function averageChannels(buffer) {
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }
  
  return mono;
}

/**
 * Stima il BPM dalla durata (ultimo fallback)
 */
function estimateBPMFromDuration(duration) {
  console.log('ℹ️ Stima BPM dalla durata della traccia');
  if (duration < 120) return 128;
  if (duration < 180) return 125;
  if (duration < 240) return 122;
  if (duration < 300) return 120;
  return 120;
}

/**
 * Analizza il BPM in modo asincrono
 */
export async function detectBPMAsync(buffer) {
  return detectBPM(buffer);
}
