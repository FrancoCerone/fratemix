/**
 * Servizio per recuperare file audio da Google Drive
 * Utilizza l'API pubblica di Google Drive senza autenticazione OAuth
 */

const API_KEY = 'AIzaSyCsKsvTqnlnDD94CYef0diL_M0jZ4HqjTk';
const FOLDER_ID = '1JdLjxDa8xNTDYJgUCGLurORSbW0pXUAn';

/**
 * Recupera la lista dei file audio dalla cartella Google Drive
 * @returns {Promise<Array>} Array di oggetti file con metadati
 */
export async function fetchAudioFilesFromDrive() {
  try {
    console.log('🔍 Recupero file audio da Google Drive...');
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&key=${API_KEY}&fields=files(id,name,mimeType,size,modifiedTime)`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
      // Filtra solo i file audio
      const audioFiles = data.files.filter(file =>
        file.mimeType === 'audio/mpeg' || 
        file.mimeType === 'audio/wav' ||
        file.mimeType === 'audio/ogg' ||
        file.mimeType === 'audio/mp3' ||
        file.mimeType.startsWith('audio/')
      );
      
      console.log(`✅ Trovati ${audioFiles.length} file audio`);
      return audioFiles;
    } else {
      console.warn('⚠️ Nessun file trovato nella cartella Google Drive');
      return [];
    }
  } catch (error) {
    console.error('❌ Errore durante il recupero dei file da Google Drive:', error);
    return [];
  }
}

/**
 * Ottiene l'URL di download diretto per un file di Google Drive
 * @param {string} fileId - ID del file su Google Drive
 * @returns {string} URL di download
 */
export function getDownloadUrl(fileId) {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
}

/**
 * Scarica un file audio da Google Drive
 * @param {string} fileId - ID del file
 * @param {string} fileName - Nome del file
 * @returns {Promise<File>} File object
 */
export async function downloadAudioFile(fileId, fileName) {
  try {
    console.log(`⬇️ Download in corso: ${fileName}`);
    
    const url = getDownloadUrl(fileId);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });
    
    console.log(`✅ Download completato: ${fileName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    return file;
  } catch (error) {
    console.error(`❌ Errore download ${fileName}:`, error);
    throw new Error(`Impossibile scaricare ${fileName}. Verifica la connessione.`);
  }
}

/**
 * Converte un file di Google Drive in un oggetto Track per l'app
 * @param {Object} driveFile - Oggetto file da Google Drive API
 * @returns {Object} Oggetto Track
 */
export function convertDriveFileToTrack(driveFile) {
  return {
    id: `gdrive_${driveFile.id}`,
    name: driveFile.name,
    fileId: driveFile.id,
    size: parseInt(driveFile.size) || 0,
    type: driveFile.mimeType,
    addedAt: new Date(driveFile.modifiedTime || Date.now()),
    isRemote: true,
    source: 'google-drive'
  };
}
