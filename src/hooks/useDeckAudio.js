import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBPMAsync } from '../utils/bpmDetector';
import { usePersistedDeckState, useAudioFileStorage } from './usePersistedDeckState';

/**
 * Hook personalizzato per gestire l'audio di un deck DJ
 * 
 * Questo hook gestisce:
 * - Caricamento e riproduzione di file audio
 * - EQ a 3 bande (Low, Mid, High) con kill switch
 * - Filtro passa-alto/passa-basso
 * - Controllo del gain
 * - Controllo del tempo/BPM (playbackRate)
 * - Sistema di loop con lunghezze configurabili
 * - Sincronizzazione con altri deck
 * - Persistenza dello stato nel localStorage
 * 
 * @param {Object} options - Opzioni di configurazione
 * @param {string} options.deckId - Identificatore del deck ('A' o 'B')
 * @param {number} options.initialBPM - BPM iniziale (default: 128)
 * @param {Function} options.onSyncRequest - Callback quando questo deck richiede sync
 * @param {number} options.syncBPM - BPM di riferimento per sync (da altro deck)
 * @param {boolean} options.syncEnabled - Se true, questo deck segue syncBPM
 */
export function useDeckAudio({
  deckId = 'A',
  initialBPM = 128,
  onSyncRequest = null,
  syncBPM = null,
  syncEnabled = false
} = {}) {
  // Carica lo stato salvato dal localStorage
  const { loadDeckState } = usePersistedDeckState(deckId, {});
  const { saveAudioFile, loadAudioFile: loadSavedAudioFile } = useAudioFileStorage(deckId);
  const savedState = useRef(loadDeckState());
  const [stateRestored, setStateRestored] = useState(false);
  const [isRestoringAudio, setIsRestoringAudio] = useState(false);
  // Stato del deck - carica valori salvati se esistono
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(savedState.current?.isLoaded || false);
  const [currentTime, setCurrentTime] = useState(savedState.current?.currentTime || 0);
  const [duration, setDuration] = useState(savedState.current?.duration || 0);
  const [fileName, setFileName] = useState(savedState.current?.fileName || '');
  const [bpm, setBPM] = useState(savedState.current?.bpm || initialBPM);
  const [detectedBPM, setDetectedBPM] = useState(savedState.current?.detectedBPM || null);
  const [originalBPM, setOriginalBPM] = useState(savedState.current?.detectedBPM || initialBPM); // BPM originale della traccia caricata
  
  // Stato EQ (valori in dB, range tipico: -12 a +12) - ripristina valori salvati
  const [eqLow, setEqLow] = useState(savedState.current?.eqLow ?? 0);
  const [eqMid, setEqMid] = useState(savedState.current?.eqMid ?? 0);
  const [eqHigh, setEqHigh] = useState(savedState.current?.eqHigh ?? 0);
  const [eqLowKill, setEqLowKill] = useState(savedState.current?.eqLowKill || false);
  const [eqMidKill, setEqMidKill] = useState(savedState.current?.eqMidKill || false);
  const [eqHighKill, setEqHighKill] = useState(savedState.current?.eqHighKill || false);
  
  // Stato filtro (0 = centro/nessun filtro, negativo = high-pass, positivo = low-pass)
  const [filterValue, setFilterValue] = useState(savedState.current?.filterValue ?? 0); // Range: -1 a +1
  
  // Stato gain - ripristina valore salvato
  const [gain, setGain] = useState(savedState.current?.gain ?? 1); // Range: 0 a 2
  
  // Stato pitch/tempo - separato dal BPM!
  // Questo è il valore che controlla realmente la velocità di riproduzione
  const [pitchValue, setPitchValue] = useState(savedState.current?.pitchValue ?? 0); // Range: -8% a +8% (0 = normale)
  
  // Stato loop - ripristina valori salvati
  const [loopEnabled, setLoopEnabled] = useState(savedState.current?.loopEnabled || false);
  const [loopStart, setLoopStart] = useState(savedState.current?.loopStart || 0);
  const [loopLength, setLoopLength] = useState(savedState.current?.loopLength || 1); // in beat (1, 2, 4, 8)
  
  // Aggiorna il ref quando cambia loopEnabled
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);
  
  // Riferimenti Web Audio API
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const crossfaderGainNodeRef = useRef(null);
  const eqLowNodeRef = useRef(null);
  const eqMidNodeRef = useRef(null);
  const eqHighNodeRef = useRef(null);
  const filterNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const audioBufferRef = useRef(null);
  
  // Stato crossfader gain
  const [crossfaderGain, setCrossfaderGainState] = useState(1);
  
  // Riferimenti per il loop
  const loopStartTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const startOffsetRef = useRef(0);
  const isPlayingRef = useRef(false);
  const loopEnabledRef = useRef(false);
  const loopTimeoutRef = useRef(null);
  
  // Riferimento per i picchi della traccia
  const peaksRef = useRef([]);
  
  /**
   * Funzione helper per media dei canali stereo
   */
  const averageChannels = useCallback((buffer) => {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    const averaged = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      averaged[i] = (left[i] + right[i]) / 2;
    }
    return averaged;
  }, []);

  /**
   * Rileva i picchi nella traccia audio
   * @param {AudioBuffer} audioBuffer - Il buffer audio da analizzare
   * @returns {Array<number>} - Array di tempi (in secondi) dove si trovano i picchi
   */
  const detectPeaks = useCallback((audioBuffer) => {
    if (!audioBuffer) return [];
    
    try {
      const channelData = audioBuffer.numberOfChannels > 1 
        ? averageChannels(audioBuffer) 
        : audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Calcola energia in finestre di 100ms
      const windowSize = Math.floor(sampleRate * 0.1);
      const hopSize = Math.floor(windowSize / 2);
      const energyValues = [];
      
      for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
        let energy = 0;
        for (let j = i; j < i + windowSize && j < channelData.length; j++) {
          energy += channelData[j] * channelData[j];
        }
        energyValues.push(energy / windowSize);
      }
      
      // Trova picchi usando soglia adattiva
      const sortedValues = [...energyValues].sort((a, b) => a - b);
      const threshold = sortedValues[Math.floor(sortedValues.length * 0.7)];
      const minPeakDistance = Math.floor(0.3 * sampleRate / hopSize); // Minimo 0.3s tra picchi
      
      const peaks = [];
      let lastPeakIndex = -minPeakDistance;
      
      for (let i = 1; i < energyValues.length - 1; i++) {
        if (energyValues[i] > threshold && 
            energyValues[i] > energyValues[i - 1] && 
            energyValues[i] > energyValues[i + 1] &&
            (i - lastPeakIndex) >= minPeakDistance) {
          // Converti indice in tempo (secondi)
          const time = (i * hopSize) / sampleRate;
          peaks.push(time);
          lastPeakIndex = i;
        }
      }
      
      console.log(`🎵 Rilevati ${peaks.length} picchi per Deck ${deckId}`);
      return peaks;
    } catch (error) {
      console.error('Errore nel rilevamento dei picchi:', error);
      return [];
    }
  }, [averageChannels, deckId]);

  /**
   * Trova il picco più vicino a un tempo target
   * @param {number} targetTime - Tempo target in secondi
   * @param {Array<number>} peaks - Array di tempi dei picchi
   * @returns {number|null} - Il picco più vicino o null se non ci sono picchi
   */
  const findNearestPeak = useCallback((targetTime, peaks) => {
    if (!peaks || peaks.length === 0) return null;
    
    let nearestPeak = peaks[0];
    let minDistance = Math.abs(peaks[0] - targetTime);
    
    for (const peak of peaks) {
      const distance = Math.abs(peak - targetTime);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPeak = peak;
      }
    }
    
    return nearestPeak;
  }, []);

  /**
   * Inizializza l'AudioContext se non esiste già
   * L'AudioContext è il "motore" della Web Audio API
   */
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // Crea un nuovo AudioContext (il contesto audio principale)
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Crea il nodo di gain per il crossfader (deve essere creato prima)
      crossfaderGainNodeRef.current = audioContextRef.current.createGain();
      crossfaderGainNodeRef.current.gain.value = 1;
      
      // Crea il nodo di gain principale (controllo volume)
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = gain;
      
      // Crea i nodi BiquadFilter per l'EQ a 3 bande
      // Low shelf: agisce sulle frequenze basse
      eqLowNodeRef.current = audioContextRef.current.createBiquadFilter();
      eqLowNodeRef.current.type = 'lowshelf';
      eqLowNodeRef.current.frequency.value = 250; // Frequenza di taglio per i bassi
      eqLowNodeRef.current.gain.value = eqLow; // Applica il valore corrente
      
      // Peaking EQ per i medi: agisce su una banda specifica
      eqMidNodeRef.current = audioContextRef.current.createBiquadFilter();
      eqMidNodeRef.current.type = 'peaking';
      eqMidNodeRef.current.frequency.value = 1000; // Frequenza centrale per i medi
      eqMidNodeRef.current.Q.value = 1; // Q factor (larghezza della banda)
      eqMidNodeRef.current.gain.value = eqMid; // Applica il valore corrente
      
      // High shelf: agisce sulle frequenze alte
      eqHighNodeRef.current = audioContextRef.current.createBiquadFilter();
      eqHighNodeRef.current.type = 'highshelf';
      eqHighNodeRef.current.frequency.value = 4000; // Frequenza di taglio per gli alti
      eqHighNodeRef.current.gain.value = eqHigh; // Applica il valore corrente
      
      // Filtro passa-alto/passa-basso (utilizzato per il filtro principale)
      filterNodeRef.current = audioContextRef.current.createBiquadFilter();
      filterNodeRef.current.type = 'lowpass'; // Inizialmente lowpass, cambierà dinamicamente
      filterNodeRef.current.frequency.value = 20000; // Nessun filtro inizialmente (20kHz = tutto passa)
      filterNodeRef.current.Q.value = 1;
      
      // Analyser per visualizzazioni future (se necessario)
      analyserNodeRef.current = audioContextRef.current.createAnalyser();
      analyserNodeRef.current.fftSize = 256;
      
      // Connessione della catena audio:
      // source -> eqLow -> eqMid -> eqHigh -> filter -> gain -> crossfaderGain -> analyser -> destination
      eqLowNodeRef.current.connect(eqMidNodeRef.current);
      eqMidNodeRef.current.connect(eqHighNodeRef.current);
      eqHighNodeRef.current.connect(filterNodeRef.current);
      filterNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(crossfaderGainNodeRef.current);
      crossfaderGainNodeRef.current.connect(analyserNodeRef.current);
      analyserNodeRef.current.connect(audioContextRef.current.destination);
      
      // Applica i valori iniziali degli EQ
      if (eqLowNodeRef.current) {
        eqLowNodeRef.current.gain.value = eqLowKill ? -100 : eqLow;
      }
      if (eqMidNodeRef.current) {
        eqMidNodeRef.current.gain.value = eqMidKill ? -100 : eqMid;
      }
      if (eqHighNodeRef.current) {
        eqHighNodeRef.current.gain.value = eqHighKill ? -100 : eqHigh;
      }
    }
  }, [gain, eqLow, eqMid, eqHigh, eqLowKill, eqMidKill, eqHighKill]);
  
  /**
   * Carica un file audio dal file system
   * @param {File} file - Il file audio da caricare
   */
  const loadAudioFile = useCallback(async (file) => {
    if (!file) return;
    
    try {
      // Inizializza l'AudioContext se necessario
      initAudioContext();
      
      // Leggi il file come ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Decodifica l'audio in un AudioBuffer (rappresentazione PCM del suono)
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      
      setIsLoaded(true);
      setFileName(file.name);
      setDuration(audioBuffer.duration);
      
      // Rileva il BPM usando l'algoritmo di analisi
      console.log('Analizzando BPM della traccia...');
      const detectedBPMValue = await detectBPMAsync(audioBuffer);
      console.log('BPM rilevato:', detectedBPMValue);
      
      // Imposta sia il BPM rilevato che quello originale
      setDetectedBPM(detectedBPMValue);
      setOriginalBPM(detectedBPMValue); // Salva il BPM originale della traccia
      setBPM(detectedBPMValue); // Imposta il BPM corrente al valore rilevato
      
      // Rileva i picchi della traccia
      const detectedPeaks = detectPeaks(audioBuffer);
      peaksRef.current = detectedPeaks;
      
      // Reset dell'offset per la nuova traccia
      startOffsetRef.current = 0;
      
      // Salva il file in IndexedDB per ripristinarlo dopo il refresh
      // (solo se < 50MB per non riempire lo storage)
      if (file.size < 50 * 1024 * 1024) {
        console.log(`💾 Salvataggio file audio per Deck ${deckId} in IndexedDB...`);
        await saveAudioFile(file, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          duration: audioBuffer.duration,
          detectedBPM: detectedBPMValue
        });
        console.log(`✅ File salvato con successo per Deck ${deckId}`);
      } else {
        console.warn(`⚠️ File troppo grande (${(file.size / 1024 / 1024).toFixed(2)}MB) per essere salvato. Limite: 50MB`);
      }
      
    } catch (error) {
      console.error('Errore nel caricamento del file audio:', error);
      alert('Errore nel caricamento del file audio. Assicurati che sia un formato supportato (MP3, WAV, OGG).');
    }
  }, [initAudioContext, deckId, saveAudioFile, detectPeaks]);
  
  /**
   * Crea e avvia un nuovo source node per la riproduzione
   * Ogni volta che vogliamo riprodurre, dobbiamo creare un nuovo source node
   * perché un source node può essere riprodotto solo una volta
   */
  const createAndStartSource = useCallback((offset = 0) => {
    if (!audioBufferRef.current || !audioContextRef.current) return;
    
    // Ferma il source precedente se esiste
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignora errori se già fermato
      }
    }
    
    // Pulisci timeout precedente se esiste
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    
    // Crea un nuovo BufferSource (il nodo che riproduce l'AudioBuffer)
    sourceNodeRef.current = audioContextRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    
    // Imposta la velocità di riproduzione usando SOLO il pitch slider
    // pitchValue: 0 = normale, +8 = 8% più veloce, -8 = 8% più lento
    // playbackRate = 1.0 + (pitchValue / 100)
    // Esempio: pitchValue = 4 → playbackRate = 1.04 (4% più veloce)
    const playbackRate = 1.0 + (pitchValue / 100);
    sourceNodeRef.current.playbackRate.value = playbackRate;
    
    // Assicurati che i valori degli EQ siano applicati prima di collegare il source
    if (eqLowNodeRef.current) {
      eqLowNodeRef.current.gain.value = eqLowKill ? -100 : eqLow;
    }
    if (eqMidNodeRef.current) {
      eqMidNodeRef.current.gain.value = eqMidKill ? -100 : eqMid;
    }
    if (eqHighNodeRef.current) {
      eqHighNodeRef.current.gain.value = eqHighKill ? -100 : eqHigh;
    }
    
    // Collega il source al primo nodo della catena (EQ Low)
    sourceNodeRef.current.connect(eqLowNodeRef.current);
    
    // Calcola quando iniziare la riproduzione
    const startTime = audioContextRef.current.currentTime;
    
    // Se c'è un loop attivo, calcola i parametri
    const audioDuration = audioBufferRef.current ? audioBufferRef.current.duration : 0;
    if (loopEnabledRef.current && loopStart >= 0 && loopStart < audioDuration) {
      // Converti beat in secondi: ogni beat dura 60/BPM secondi
      const beatDuration = 60 / bpm;
      const loopDuration = loopLength * beatDuration;
      const loopEnd = Math.min(loopStart + loopDuration, audioDuration);
      const actualLoopDuration = loopEnd - loopStart;
      
      // Avvia la riproduzione dal punto di loop
      const startOffset = Math.max(0, Math.min(loopStart + offset, audioDuration));
      sourceNodeRef.current.start(startTime, startOffset);
      
      // Calcola quando fermare e riavviare il loop
      const remainingTime = (actualLoopDuration - (offset % actualLoopDuration)) / playbackRate;
      
      // Imposta un timeout per fermare al punto di loop e riavviare
      loopTimeoutRef.current = setTimeout(() => {
        if (sourceNodeRef.current && isPlayingRef.current && loopEnabledRef.current) {
          try {
            sourceNodeRef.current.stop();
          } catch (e) {
            // Ignora errori
          }
          // Riavvia il loop dal punto di inizio
          createAndStartSource(0);
        }
      }, remainingTime * 1000);
      
      // Gestisci la fine del source (backup)
      sourceNodeRef.current.onended = () => {
        if (isPlayingRef.current && loopEnabledRef.current) {
          createAndStartSource(0);
        } else {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      };
    } else {
      // Riproduzione normale senza loop
      const audioDuration = audioBufferRef.current ? audioBufferRef.current.duration : 0;
      const startOffset = Math.max(0, Math.min(offset, audioDuration));
      sourceNodeRef.current.start(startTime, startOffset);
      sourceNodeRef.current.onended = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
      };
    }
    
    // Salva il tempo di inizio per calcolare il tempo corrente
    startOffsetRef.current = offset;
    loopStartTimeRef.current = startTime;
  }, [pitchValue, loopStart, loopLength, eqLow, eqMid, eqHigh, eqLowKill, eqMidKill, eqHighKill, bpm]);
  
  /**
   * Avvia o riprende la riproduzione
   * @param {Object} otherDeck - L'altro deck per la sincronizzazione (opzionale)
   */
  const play = useCallback((otherDeck = null) => {
    if (!isLoaded || !audioContextRef.current) return;
    
    // Se sync è attivo e c'è un altro deck in riproduzione con picchi
    if (syncEnabled && otherDeck && otherDeck.isPlaying && otherDeck.peaks && otherDeck.peaks.length > 0) {
      const masterCurrentTime = otherDeck.currentTime;
      
      if (peaksRef.current.length > 0) {
        // Trova il picco più vicino nella traccia slave al tempo corrente del master
        // Questo fa partire la slave dal picco più vicino al punto in cui si trova il master
        const targetPeak = findNearestPeak(masterCurrentTime, peaksRef.current);
        
        if (targetPeak !== null) {
          // Vai al picco trovato
          startOffsetRef.current = targetPeak;
          setCurrentTime(targetPeak);
          console.log(`🎯 Sync: Master a ${masterCurrentTime.toFixed(2)}s → Deck ${deckId} parte dal picco più vicino ${targetPeak.toFixed(2)}s`);
        }
      }
    }
    
    // Se l'AudioContext è sospeso (spesso succede dopo un'interazione utente),
    // riprendilo
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    isPlayingRef.current = true;
    setIsPlaying(true);
    createAndStartSource(startOffsetRef.current || 0);
  }, [isLoaded, createAndStartSource, syncEnabled, findNearestPeak, deckId]);
  
  /**
   * Cerca una posizione specifica nel brano (seek)
   * @param {number} time - Tempo in secondi a cui saltare
   */
  const seek = useCallback((time) => {
    if (!isLoaded || !audioBufferRef.current) return;
    
    const audioDuration = audioBufferRef.current.duration;
    const seekTime = Math.max(0, Math.min(time, audioDuration));
    
    const wasPlaying = isPlayingRef.current;
    
    // Ferma la riproduzione corrente
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      } catch (e) {
        // Ignora errori
      }
    }
    
    // Pulisci timeout del loop
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    
    // Aggiorna l'offset
    startOffsetRef.current = seekTime;
    setCurrentTime(seekTime);
    
    // Se stava suonando, riavvia dalla nuova posizione
    if (wasPlaying) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      createAndStartSource(seekTime);
    }
  }, [isLoaded, createAndStartSource]);
  
  /**
   * Ferma la riproduzione
   */
  const pause = useCallback(() => {
    isPlayingRef.current = false;
    
    if (sourceNodeRef.current) {
      try {
        // Calcola quanto tempo è passato dall'inizio della riproduzione
        const elapsed = audioContextRef.current.currentTime - loopStartTimeRef.current;
        startOffsetRef.current = (startOffsetRef.current || 0) + elapsed;
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      } catch (e) {
        // Ignora errori se già fermato
      }
    }
    
    // Pulisci timeout del loop
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    
    setIsPlaying(false);
  }, []);
  
  /**
   * Aggiorna il valore dell'EQ Low in tempo reale
   * Funziona anche durante la riproduzione perché i nodi EQ sono sempre connessi nella catena
   */
  useEffect(() => {
    if (eqLowNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (eqLowKill) {
        // Kill switch: taglia completamente la banda
        eqLowNodeRef.current.gain.value = -100;
      } else {
        // Applica il valore direttamente (i BiquadFilter accettano valori in dB)
        // I valori vanno da -12 a +12 dB
        // Questo funziona in tempo reale anche durante la riproduzione
        eqLowNodeRef.current.gain.value = eqLow;
      }
    }
  }, [eqLow, eqLowKill]);
  
  /**
   * Aggiorna il valore dell'EQ Mid in tempo reale
   * Funziona anche durante la riproduzione perché i nodi EQ sono sempre connessi nella catena
   */
  useEffect(() => {
    if (eqMidNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (eqMidKill) {
        eqMidNodeRef.current.gain.value = -100;
      } else {
        // Applica il valore direttamente (i BiquadFilter accettano valori in dB)
        // Questo funziona in tempo reale anche durante la riproduzione
        eqMidNodeRef.current.gain.value = eqMid;
      }
    }
  }, [eqMid, eqMidKill]);
  
  /**
   * Aggiorna il valore dell'EQ High in tempo reale
   * Funziona anche durante la riproduzione perché i nodi EQ sono sempre connessi nella catena
   */
  useEffect(() => {
    if (eqHighNodeRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      if (eqHighKill) {
        eqHighNodeRef.current.gain.value = -100;
      } else {
        // Applica il valore direttamente (i BiquadFilter accettano valori in dB)
        // Questo funziona in tempo reale anche durante la riproduzione
        eqHighNodeRef.current.gain.value = eqHigh;
      }
    }
  }, [eqHigh, eqHighKill]);
  
  /**
   * Aggiorna il filtro passa-alto/passa-basso
   * filterValue: -1 (high-pass) a +1 (low-pass), 0 = nessun filtro
   */
  useEffect(() => {
    if (filterNodeRef.current) {
      if (filterValue === 0) {
        // Nessun filtro: imposta frequenza molto alta (tutto passa)
        filterNodeRef.current.frequency.value = 20000;
      } else if (filterValue < 0) {
        // High-pass: passa solo le frequenze alte
        filterNodeRef.current.type = 'highpass';
        // Mappa -1 a 20Hz (taglia tutto), -0.5 a ~500Hz, 0 a 20000Hz
        filterNodeRef.current.frequency.value = 20 + (Math.abs(filterValue) * 1980);
      } else {
        // Low-pass: passa solo le frequenze basse
        filterNodeRef.current.type = 'lowpass';
        // Mappa 0 a 20000Hz, 0.5 a ~10000Hz, 1 a 20Hz (taglia tutto)
        filterNodeRef.current.frequency.value = 20000 - (filterValue * 19980);
      }
    }
  }, [filterValue]);
  
  /**
   * Aggiorna il gain (volume)
   */
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain;
    }
  }, [gain]);
  
  /**
   * Aggiorna il gain del crossfader
   */
  const setCrossfaderGain = useCallback((value) => {
    setCrossfaderGainState(value);
    if (crossfaderGainNodeRef.current) {
      crossfaderGainNodeRef.current.gain.value = value;
    }
  }, []);
  
  useEffect(() => {
    if (crossfaderGainNodeRef.current) {
      crossfaderGainNodeRef.current.gain.value = crossfaderGain;
    }
  }, [crossfaderGain]);
  
  /**
   * Aggiorna il playbackRate quando cambia il pitch slider (NON il BPM!)
   */
  useEffect(() => {
    if (sourceNodeRef.current) {
      const playbackRate = 1.0 + (pitchValue / 100);
      sourceNodeRef.current.playbackRate.value = playbackRate;
      console.log(`🎚️ Pitch aggiornato: ${pitchValue.toFixed(1)}% → playbackRate: ${playbackRate.toFixed(3)}`);
    }
  }, [pitchValue]);
  
  /**
   * Gestisce la sincronizzazione con altri deck
   */
  useEffect(() => {
    if (syncEnabled && syncBPM !== null && syncBPM !== bpm) {
      setBPM(syncBPM);
      if (onSyncRequest) {
        onSyncRequest(bpm);
      }
    }
  }, [syncEnabled, syncBPM, bpm, onSyncRequest]);
  
  /**
   * Aggiorna il tempo corrente durante la riproduzione
   */
  useEffect(() => {
    if (!isPlaying) return;
    
    const updateTime = () => {
      if (audioContextRef.current && loopStartTimeRef.current) {
        const elapsed = audioContextRef.current.currentTime - loopStartTimeRef.current;
        const current = (startOffsetRef.current || 0) + elapsed;
        setCurrentTime(Math.min(current, duration));
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateTime);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration]);
  
  /**
   * Imposta il punto di inizio del loop
   */
  const setLoopStartPoint = useCallback(() => {
    if (isPlaying) {
      setLoopStart(currentTime);
    }
  }, [isPlaying, currentTime]);
  
  /**
   * Formatta il tempo in formato MM:SS
   */
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // Salva automaticamente lo stato nel localStorage
  usePersistedDeckState(deckId, {
    gain,
    eqLow,
    eqMid,
    eqHigh,
    eqLowKill,
    eqMidKill,
    eqHighKill,
    filterValue,
    bpm,
    detectedBPM,
    pitchValue, // Salva anche il pitch!
    currentTime,
    duration,
    loopEnabled,
    loopStart,
    loopLength,
    fileName,
    isLoaded,
    isPlaying
  });
  
  // Ripristina il file audio salvato quando l'app viene riaperta
  useEffect(() => {
    const restoreAudioFile = async () => {
      // Se c'è uno stato salvato con un fileName, prova a ripristinare il file
      if (savedState.current && savedState.current.fileName && !isRestoringAudio && !isLoaded) {
        setIsRestoringAudio(true);
        
        try {
          console.log(`🔄 Tentativo di ripristino file audio per Deck ${deckId}...`);
          const savedAudioData = await loadSavedAudioFile();
          
          if (savedAudioData && savedAudioData.file) {
            console.log(`📂 File trovato in IndexedDB: ${savedAudioData.metadata.fileName}`);
            
            // Inizializza l'AudioContext se necessario
            initAudioContext();
            
            // Carica il file salvato
            const arrayBuffer = await savedAudioData.file.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            audioBufferRef.current = audioBuffer;
            
            setIsLoaded(true);
            setFileName(savedAudioData.metadata.fileName);
            setDuration(savedAudioData.metadata.duration);
            
            // Ripristina il BPM salvato (non ricalcolare per velocità)
            if (savedState.current.detectedBPM) {
              setDetectedBPM(savedState.current.detectedBPM);
              setOriginalBPM(savedState.current.detectedBPM);
            }
            
            // Rileva i picchi della traccia ripristinata
            const detectedPeaks = detectPeaks(audioBuffer);
            peaksRef.current = detectedPeaks;
            
            // Ripristina la posizione salvata se presente
            if (savedState.current.currentTime) {
              startOffsetRef.current = savedState.current.currentTime;
              setCurrentTime(savedState.current.currentTime);
            }
            
            console.log(`✅ File audio ripristinato con successo per Deck ${deckId}!`);
          } else {
            console.log(`ℹ️ Nessun file audio salvato per Deck ${deckId}. Carica una traccia manualmente.`);
          }
        } catch (error) {
          console.error(`❌ Errore nel ripristino del file audio per Deck ${deckId}:`, error);
          console.log(`ℹ️ Carica manualmente la traccia per Deck ${deckId}`);
        } finally {
          setIsRestoringAudio(false);
        }
      }
    };
    
    restoreAudioFile();
  }, [deckId, initAudioContext, isLoaded, isRestoringAudio, loadSavedAudioFile, detectPeaks]);
  
  // Mostra un messaggio quando lo stato è stato ripristinato
  useEffect(() => {
    if (savedState.current && !stateRestored) {
      console.log(`✅ Stato del Deck ${deckId} ripristinato:`, {
        fileName: savedState.current.fileName,
        bpm: savedState.current.bpm,
        gain: savedState.current.gain
      });
      setStateRestored(true);
    }
  }, [deckId, stateRestored]);
  
  return {
    // Stato
    isPlaying,
    isLoaded,
    isRestoringAudio,
    currentTime,
    duration,
    fileName,
    bpm,
    detectedBPM,
    
    // Controlli riproduzione
    play,
    pause,
    loadAudioFile,
    seek,
    
    // EQ
    eqLow,
    setEqLow,
    eqMid,
    setEqMid,
    eqHigh,
    setEqHigh,
    eqLowKill,
    setEqLowKill,
    eqMidKill,
    setEqMidKill,
    eqHighKill,
    setEqHighKill,
    
    // Filtro
    filterValue,
    setFilterValue,
    
    // Gain
    gain,
    setGain,
    
    // Crossfader
    setCrossfaderGain,
    
    // BPM (solo valore di riferimento, non cambia la velocità!)
    setBPM,
    
    // Picchi per sincronizzazione
    peaks: peaksRef.current,
    
    // Pitch/Tempo (questo controlla la velocità reale!)
    pitchValue,
    setPitchValue,
    
    // Loop
    loopEnabled,
    setLoopEnabled,
    loopStart,
    setLoopStart,
    loopLength,
    setLoopLength,
    setLoopStartPoint,
    
    // Utilità
    formatTime,
    
    // Analyser per visualizzazioni future
    analyserNode: analyserNodeRef.current,
    
    // AudioBuffer per visualizzazione waveform completo
    audioBuffer: audioBufferRef.current
  };
}

