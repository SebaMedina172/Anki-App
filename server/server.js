const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const googleTTS = require('google-tts-api');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const cors = require('cors');
const ini = require('ini');

const app = express();
app.use(express.json());
app.use(cors());

// Determina la ruta base de Anki según el sistema operativo
function getAnkiBasePath() {
  const platform = process.platform;
  if (platform === 'win32') {
    if (!process.env.APPDATA) throw new Error('No se encontró APPDATA en Windows.');
    return path.join(process.env.APPDATA, 'Anki2');
  } else if (platform === 'darwin') {
    return path.join(process.env.HOME, 'Library', 'Application Support', 'Anki2');
  } else {
    // Suponemos Linux
    return path.join(process.env.HOME, '.local', 'share', 'Anki2');
  }
}

/**
 * Retorna la ruta a collection.media del perfil actual de Anki.
 *
 * Primero intenta usar profiles.ini; si no existe, utiliza la fecha de modificación
 * del archivo collection.anki2 para seleccionar el perfil más reciente (presumiblemente activo).
 */
function getAnkiMediaPath() {
  const ankiBasePath = getAnkiBasePath();
  if (!fs.existsSync(ankiBasePath)) {
    throw new Error(`No se encontró la carpeta Anki2 en: ${ankiBasePath}`);
  }

  // Intentar usar profiles.ini si existe
  const profilesIniPath = path.join(ankiBasePath, 'profiles.ini');
  if (fs.existsSync(profilesIniPath)) {
    const iniContent = fs.readFileSync(profilesIniPath, 'utf-8');
    const profiles = ini.parse(iniContent);
    let currentProfile = null;
    for (const key in profiles) {
      if (typeof profiles[key] === 'object' && profiles[key].isCurrent === 'true') {
        currentProfile = profiles[key].name;
        break;
      }
    }
    if (currentProfile) {
      const mediaPath = path.join(ankiBasePath, currentProfile, 'collection.media');
      if (fs.existsSync(mediaPath)) return mediaPath;
    }
  }

  // Si no hay profiles.ini o no se encontró un perfil válido, se busca el perfil cuyo
  // archivo collection.anki2 tenga la fecha de modificación más reciente.
  const items = fs.readdirSync(ankiBasePath, { withFileTypes: true });
  const profileDirs = items.filter(dirent => {
    if (!dirent.isDirectory()) return false;
    // Consideramos únicamente carpetas que tengan el archivo collection.anki2
    const collectionFile = path.join(ankiBasePath, dirent.name, 'collection.anki2');
    return fs.existsSync(collectionFile);
  });

  if (profileDirs.length === 0) {
    throw new Error(`No se encontró ningún perfil con collection.anki2 en: ${ankiBasePath}`);
  }

  let selectedProfile = profileDirs[0];
  let selectedMTime = fs.statSync(path.join(ankiBasePath, selectedProfile.name, 'collection.anki2')).mtime;
  for (let dir of profileDirs) {
    const collectionPath = path.join(ankiBasePath, dir.name, 'collection.anki2');
    const stat = fs.statSync(collectionPath);
    if (stat.mtime > selectedMTime) {
      selectedProfile = dir;
      selectedMTime = stat.mtime;
    }
  }
  return path.join(ankiBasePath, selectedProfile.name, 'collection.media');
}

let MEDIA_PATH;
try {
  MEDIA_PATH = getAnkiMediaPath();
  console.log('Ruta detectada de collection.media:', MEDIA_PATH);
} catch (error) {
  console.error('Error al detectar la ruta de collection.media:', error.message);
  process.exit(1);
}

const ANKI_CONNECT_URL = "http://localhost:8765";

/**
 * Crea un archivo de audio a partir de un texto usando google-tts-api.
 */
async function createAudio(text, filename) {
  const url = googleTTS.getAudioUrl(text, {
    lang: 'en',
    slow: false,
    host: 'https://translate.google.com'
  });
  console.log("Audio URL:", url);
  
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  const filePath = path.join(MEDIA_PATH, filename);
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

/**
 * Envía la tarjeta a Anki mediante AnkiConnect.
 */
async function addCardToAnki(deck, model, fields, ankiConnectUrl) {
  const note = { deckName: deck, modelName: model, fields };
  const payload = { action: 'addNote', version: 6, params: { note } };
  const response = await axios.post(ankiConnectUrl, payload);
  return response.data;
}

/**
 * Extrae IPA, definición y ejemplo (si existe) de la respuesta de la API.
 */
function parseDictionaryData(data) {
  try {
    const ipa = (data[0].phonetics.find(p => p.text) || {}).text || '';
    let meaning_raw = data[0].meanings[0].definitions[0].definition;
    const meaning = meaning_raw.split(/example:/i)[0].trim();
    let example = data[0].meanings[0].definitions[0].example;
    return { ipa, meaning, example };
  } catch (e) {
    return null;
  }
}

/**
 * Valida el ejemplo obtenido de la API.
 */
async function getExampleFromAPI(apiExample) {
  if (apiExample && apiExample.split(' ').length > 3) {
    return apiExample;
  }
  return null;
}

function cleanExample(example) {
  if (!example || typeof example !== 'string') return null;
  if (example.includes('—')) {
    example = example.split('—')[0].trim();
  }
  if (example.includes(' - ')) {
    example = example.split(' - ')[0].trim();
  }
  example = example.replace(/�/g, '').trim();
  const spanishIndicators = ['el ', 'la ', 'de ', 'que ', 'en '];
  let spanishCount = 0;
  spanishIndicators.forEach(ind => {
    if (example.toLowerCase().includes(ind)) spanishCount++;
  });
  if (spanishCount > 1) return null;
  return example;
}

/**
 * Extrae ejemplo de Linguee usando Cheerio.
 */
async function getExampleFromLinguee(word) {
  try {
    const url = `https://www.linguee.com/english-spanish/search?source=auto&query=${word}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    const exampleDivs = $(".example_lines .line");
    let example = null;
    exampleDivs.each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.split(' ').length > 3 && text.toLowerCase().includes(word.toLowerCase())) {
        example = text;
        return false;
      }
    });
    return example;
  } catch (error) {
    console.error("Error en Linguee:", error.message);
    return null;
  }
}

/**
 * Extrae ejemplo de Tatoeba usando Puppeteer.
 */
async function getExampleFromTatoeba(word) {
  try {
    const url = `https://tatoeba.org/en/sentences/search?query=${word}&from=eng&to=eng`;
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const sentences = await page.$$eval('div.sentence div.text', elements =>
      elements.map(el => el.textContent.trim())
    );
    await browser.close();
    for (let sentence of sentences) {
      if (sentence.split(' ').length > 3 && sentence.toLowerCase().includes(word.toLowerCase())) {
        return sentence;
      }
    }
  } catch (error) {
    console.error("Error en Tatoeba:", error.message);
    return null;
  }
  return null;
}

/**
 * Orquesta la obtención del ejemplo desde múltiples fuentes.
 */
async function getExampleMultiSource(apiExample, word) {
  let example = await getExampleFromAPI(apiExample);
  if (example) {
    example = cleanExample(example);
    if (example) {
      console.log("Ejemplo limpio obtenido de API:", example);
      return example;
    }
  }
  example = await getExampleFromLinguee(word);
  if (example) {
    example = cleanExample(example);
    if (example) {
      console.log("Ejemplo limpio obtenido de Linguee:", example);
      return example;
    }
  }
  example = await getExampleFromTatoeba(word);
  if (example) {
    example = cleanExample(example);
    if (example) {
      console.log("Ejemplo limpio obtenido de Tatoeba:", example);
      return example;
    }
  }
  console.log("No se encontró un ejemplo válido, se usará 'Example not found'.");
  return "Example not found";
}

/**
 * Endpoint para buscar datos de una palabra y obtener IPA, definición y ejemplo multi-fuente.
 */
app.get('/search', async (req, res) => {
  const word = req.query.word;
  if (!word) {
    return res.status(400).json({ error: 'Missing word parameter' });
  }
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = response.data;
    const parsed = parseDictionaryData(data);
    if (!parsed) {
      return res.status(404).json({ error: 'No valid data found for the word' });
    }
    const example = await getExampleMultiSource(parsed.example, word);
    res.json({
      word: word.toLowerCase(),
      ipa: parsed.ipa,
      meaning: parsed.meaning,
      example
    });
  } catch (error) {
    console.error('Error en /search:', error.message);
    res.status(500).json({ error: error.toString() });
  }
});

/**
 * Endpoint para crear la tarjeta en Anki.
 */
app.post('/create-card', async (req, res) => {
  try {
    const { deck, model, ankiConnectUrl, word, ipa, meaning, example } = req.body;
    if (!deck || !model || !ankiConnectUrl || !word || !ipa || !meaning || !example) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const audioWordFilename = `${word}_pronunciation.mp3`;
    const audioMeaningFilename = `${word}_definition.mp3`;
    const audioExampleFilename = `${word}_example.mp3`;

    await createAudio(word, audioWordFilename);
    await createAudio(meaning, audioMeaningFilename);
    await createAudio(example, audioExampleFilename);

    const fields = {
      Word: word,
      Sound: `[sound:${audioWordFilename}]`,
      IPA: ipa,
      Meaning: meaning,
      Example: example,
      Sound_Meaning: `[sound:${audioMeaningFilename}]`,
      Sound_Example: `[sound:${audioExampleFilename}]`
    };

    const result = await addCardToAnki(deck, model, fields, ankiConnectUrl);
    res.json(result);
  } catch (error) {
    console.error('Error en /create-card:', error.message);
    res.status(500).json({ error: error.toString() });
  }
});

// Endpoint para obtener los decks desde AnkiConnect
app.post('/anki/decks', async (req, res) => {
  const { ankiConnectUrl } = req.body;
  if (!ankiConnectUrl) {
    return res.status(400).json({ error: 'Falta ankiConnectUrl' });
  }
  try {
    const deckResponse = await axios.post(ankiConnectUrl, {
      action: 'deckNames',
      version: 6,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(deckResponse.data);
  } catch (error) {
    console.error('Error al obtener decks:', error.message);
    res.status(500).json({ error: error.toString() });
  }
});

// Endpoint para obtener los modelos desde AnkiConnect
app.post('/anki/models', async (req, res) => {
  const { ankiConnectUrl } = req.body;
  if (!ankiConnectUrl) {
    return res.status(400).json({ error: 'Falta ankiConnectUrl' });
  }
  try {
    const modelResponse = await axios.post(ankiConnectUrl, {
      action: 'modelNames',
      version: 6,
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json(modelResponse.data);
  } catch (error) {
    console.error('Error al obtener modelos:', error.message);
    res.status(500).json({ error: error.toString() });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
