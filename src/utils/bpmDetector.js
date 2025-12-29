/**
 * BPM Detector - Analizza un AudioBuffer per stimare il BPM
 * 
 * Usa l'analisi dei picchi nell'energia del segnale audio
 * per determinare il tempo della traccia
 */

/**
 * Rileva il BPM di un AudioBuffer
 * @param {AudioBuffer} buffer - Il buffer audio da analizzare
 * @returns {number} - BPM stimato
 */
export function detectBPM(buffer) {
  if (!buffer || buffer.length === 0) {
    return 120; // Default BPM
  }
  
  try {
    // Ottieni i dati del canale (usa il primo canale)
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    // Analizza solo i primi 30 secondi per velocità
    const maxSamples = Math.min(channelData.length, sampleRate * 30);
    
    // Calcola l'energia del segnale in finestre temporali
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const energyValues = [];
    
    for (let i = 0; i < maxSamples - windowSize; i += windowSize) {
      let energy = 0;
      for (let j = i; j < i + windowSize; j++) {
        energy += Math.abs(channelData[j]);
      }
      energyValues.push(energy / windowSize);
    }
    
    // Trova i picchi di energia
    const peaks = findPeaks(energyValues, 0.3);
    
    if (peaks.length < 2) {
      return estimateBPMFromDuration(buffer.duration);
    }
    
    // Calcola gli intervalli tra i picchi
    const intervals = [];
    for (let i = 1; i < Math.min(peaks.length, 50); i++) {
      intervals.push((peaks[i] - peaks[i - 1]) * windowSize / sampleRate);
    }
    
    if (intervals.length === 0) {
      return estimateBPMFromDuration(buffer.duration);
    }
    
    // Trova l'intervallo più comune (clustering)
    const intervalClusters = clusterIntervals(intervals);
    const avgInterval = intervalClusters[0] || (intervals.reduce((a, b) => a + b) / intervals.length);
    
    // Converti l'intervallo in BPM
    let bpm = 60 / avgInterval;
    
    // Normalizza il BPM in un range ragionevole (60-180)
    while (bpm < 60) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    
    // Arrotonda a 0.1
    return Math.round(bpm * 10) / 10;
  } catch (error) {
    console.error('Errore nel rilevamento BPM:', error);
    return estimateBPMFromDuration(buffer.duration);
  }
}

/**
 * Trova i picchi in un array di valori
 */
function findPeaks(values, threshold) {
  const peaks = [];
  const avgEnergy = values.reduce((a, b) => a + b) / values.length;
  const minPeakHeight = avgEnergy * (1 + threshold);
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > minPeakHeight && 
        values[i] > values[i - 1] && 
        values[i] > values[i + 1]) {
      peaks.push(i);
    }
  }
  
  return peaks;
}

/**
 * Raggruppa gli intervalli simili
 */
function clusterIntervals(intervals) {
  if (intervals.length === 0) return [];
  
  // Crea bins per gli intervalli
  const bins = {};
  const binSize = 0.05; // 50ms
  
  intervals.forEach(interval => {
    const bin = Math.round(interval / binSize);
    bins[bin] = (bins[bin] || 0) + 1;
  });
  
  // Trova il bin più popolato
  const sortedBins = Object.entries(bins)
    .sort((a, b) => b[1] - a[1])
    .map(([bin]) => parseInt(bin) * binSize);
  
  return sortedBins;
}

/**
 * Stima il BPM basandosi sulla durata (fallback)
 */
function estimateBPMFromDuration(duration) {
  // Tipicamente le tracce dance sono tra 120-140 BPM
  // Usiamo una stima basata sulla durata comune
  if (duration < 120) return 140; // Tracce corte tendono ad essere più veloci
  if (duration < 180) return 128;
  if (duration < 300) return 125;
  return 120;
}

/**
 * Analizza il BPM in background usando Web Worker (opzionale)
 * Per ora usiamo l'analisi sincrona per semplicità
 */
export async function detectBPMAsync(buffer) {
  return new Promise((resolve) => {
    // In una versione più avanzata, questo userebbe un Web Worker
    setTimeout(() => {
      resolve(detectBPM(buffer));
    }, 0);
  });
}


