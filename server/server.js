console.log('Starting the server setup...');

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const ini = require('ini');
const multer = require('multer');
const cheerio   = require('cheerio');      // <— para getExampleFromLinguee
const puppeteer = require('puppeteer');    // <— para getExampleFromTatoeba
const googleTTS = require('google-tts-api');

// ============================================
//  Regex mínimos para validar “word” según idioma
// ============================================
const regexByLang = {
  en: /^[A-Za-z][A-Za-z'\-\s]*[A-Za-z]$|^[A-Za-z]$/,  // Permite espacios para frases cortas
  es: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-\s]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$|^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/
};

// Palabras comunes para detectar si una palabra podría pertenecer al idioma incorrecto
const commonWords = {
  en: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'],
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con', 'por', 'para', 'que', 'es', 'son']
};

/**
 * Valida si una palabra es apropiada para el idioma seleccionado
 */
function validateWordForLanguage(word, lang) {
  // Validación básica con regex
  if (!regexByLang[lang].test(word)) {
    return {
      valid: false,
      reason: `La palabra '${word}' contiene caracteres no válidos para ${lang === 'en' ? 'inglés' : 'español'}`
    };
  }
  
  // Detección cruzada: verificar si la palabra es claramente del otro idioma
  const otherLang = lang === 'en' ? 'es' : 'en';
  const wordLower = word.toLowerCase();
  
  if (commonWords[otherLang].includes(wordLower)) {
    return {
      valid: false,
      reason: `La palabra '${word}' parece ser del idioma ${otherLang === 'en' ? 'inglés' : 'español'}, pero tienes seleccionado ${lang === 'en' ? 'inglés' : 'español'}`
    };
  }
  
  return { valid: true };
}

// Create Express app
const app = express();

// CORS configuration: allow frontend origin
const corsOptions = {
  origin: '*', // change to '*' if needed for testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-anki-url']
};
app.use(cors(corsOptions));

// JSON body parsing
app.use(express.json());

// Load environment variables
require('dotenv').config();

// Intentamos obtener la ruta de media. Si falla, usamos un folder de respaldo.
let MEDIA_PATH;
try {
  const getAnkiBasePath = () => {
    const platform = process.platform;
    if (platform === 'win32') {
      if (!process.env.APPDATA) throw new Error('No APPDATA');
      return path.join(process.env.APPDATA, 'Anki2');
    } else if (platform === 'darwin') {
      return path.join(process.env.HOME, 'Library/Application Support/Anki2');
    } else {
      return path.join(process.env.HOME, '.local/share/Anki2');
    }
  };
  const base = process.env.ANKI_MEDIA_PATH || getAnkiBasePath();
  MEDIA_PATH = base;
  if (!fs.existsSync(MEDIA_PATH)) fs.mkdirSync(MEDIA_PATH, { recursive: true });
  console.log('MEDIA_PATH:', MEDIA_PATH);
} catch (e) {
  MEDIA_PATH = path.join(__dirname, 'media');
  if (!fs.existsSync(MEDIA_PATH)) fs.mkdirSync(MEDIA_PATH, { recursive: true });
  console.log('Fallback MEDIA_PATH:', MEDIA_PATH);
}

// Configuración de multer para manejar uploads
const upload = multer({ dest: MEDIA_PATH });  // <--- Definición de upload

// Serve media files statically
app.use('/media', express.static(MEDIA_PATH));

// ========== Routes ==========

// Ping
app.get('/ping', (req, res) => res.json({ message: 'pong' }));

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
 * Si se define la variable de entorno ANKI_MEDIA_PATH, se usará esa ruta.
 */
function getAnkiMediaPath() {
  // Si se ha definido una ruta personalizada mediante variable de entorno, úsala.
  if (process.env.ANKI_MEDIA_PATH) {
    const customPath = process.env.ANKI_MEDIA_PATH;
    if (!fs.existsSync(customPath)) {
      fs.mkdirSync(customPath, { recursive: true });
      console.log(`Se creó la carpeta personalizada ANKI_MEDIA_PATH: ${customPath}`);
    }
    return customPath;
  }
  
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

// HELPER: guarda la imagen remota en MEDIA_PATH, devuelve el nombre del archivo
async function saveImageToMedia(url, filename) {
  const resp = await axios({ url, method: 'GET', responseType: 'stream' });
  const filePath = path.join(MEDIA_PATH, filename);
  const writer = fs.createWriteStream(filePath);
  resp.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filename));
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
 * Versión mejorada que usa la API estándar de Wiktionary ES
 * Maneja mejor los errores y tiene fallback a diferentes endpoints
 */
async function fetchWiktionaryEsRest(word) {
  try {
    console.log('Buscando palabra en Wiktionary ES:', word);
    
    // Primero intentamos con la API de contenido normal
    let url = `https://es.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(word)}`;
    console.log('URL de búsqueda:', url);
    
    let response;
    try {
      response = await axios.get(url, {
        headers: {
          "User-Agent": "AnkiApp/1.0 (tu-email@dominio.com)",
          "Accept": "text/html"
        },
        timeout: 10000
      });
    } catch (err) {
      // Si falla la API REST, intentamos con web scraping directo
      console.log('API REST falló, intentando web scraping directo...');
      return await fetchWiktionaryEsWebScraping(word);
    }

    if (!response.data) {
      console.log('No hay data en la respuesta');
      return null;
    }

    const $ = cheerio.load(response.data);
    console.log('HTML cargado correctamente');

    // Extraer IPA
    let ipa = null;
    
    // Buscar en diferentes posibles ubicaciones del IPA
    const ipaSelectors = [
      'table.pron-graf td',
      '.IPA',
      '.pronunciación',
      'span[title*="AFI"]'
    ];
    
    for (const selector of ipaSelectors) {
      const elements = $(selector);
      elements.each((i, el) => {
        const text = $(el).text().trim();
        const match = text.match(/\[([^\]]+)\]/) || text.match(/\/([^\/]+)\//);
        if (match) {
          ipa = `/${match[1]}/`;
          return false; // break
        }
      });
      if (ipa) break;
    }

    // Extraer definición
    let meaning = null;
    
    // Buscar secciones de definición
    const definitionSections = [
      'h3[id*="Sustantivo"]',
      'h3[id*="Verbo"]',
      'h3[id*="Adjetivo"]',
      'h3[id*="Adverbio"]'
    ];
    
    for (const sectionSelector of definitionSections) {
      const section = $(sectionSelector).first();
      if (section.length) {
        // Buscar la definición después de la sección
        const nextElements = section.nextAll();
        
        // Intentar encontrar en <dl><dd>, <ol><li>, o <p>
        const definitionElement = nextElements.filter('dl').first().find('dd').first();
        if (definitionElement.length) {
          meaning = definitionElement.text().trim();
          break;
        }
        
        const listElement = nextElements.filter('ol').first().find('li').first();
        if (listElement.length) {
          meaning = listElement.text().trim();
          break;
        }
        
        const paragraphElement = nextElements.filter('p').first();
        if (paragraphElement.length) {
          meaning = paragraphElement.text().trim();
          break;
        }
      }
    }

    // Extraer ejemplo
    let example = "Example not found";
    if (meaning) {
      // Buscar ejemplos en elementos <ul><li> cercanos a la definición
      const exampleElement = $('ul li').filter((i, el) => {
        const text = $(el).text().toLowerCase();
        return text.includes(word.toLowerCase()) && text.length > word.length + 10;
      }).first();
      
      if (exampleElement.length) {
        example = exampleElement.text().trim();
      }
    }

    console.log('Resultado extraído:', { ipa, meaning: meaning?.substring(0, 50), example: example?.substring(0, 50) });

    if (!meaning && !ipa) {
      return null;
    }

    return {
      meaning: meaning || null,
      example,
      ipa: ipa || null
    };

  } catch (err) {
    console.error("Error en fetchWiktionaryEsRest:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Headers:", err.response.headers);
    }
    return null;
  }
}

/**
 * Fallback: Web scraping directo a la página de Wiktionary
 */
async function fetchWiktionaryEsWebScraping(word) {
  try {
    console.log('Intentando web scraping directo para:', word);
    
    const url = `https://es.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extraer IPA de la tabla de pronunciación
    let ipa = null;
    $('.wikitable tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const firstCell = $(cells[0]).text().trim();
        const secondCell = $(cells[1]).text().trim();
        
        if (firstCell.includes('AFI') || firstCell.includes('IPA')) {
          const match = secondCell.match(/\[([^\]]+)\]/);
          if (match) {
            ipa = `/${match[1]}/`;
          }
        }
      }
    });
    
    // Extraer definición
    let meaning = null;
    const meaningSelectors = [
      '#Sustantivo_masculino',
      '#Sustantivo_femenino', 
      '#Verbo',
      '#Adjetivo'
    ];
    
    for (const selector of meaningSelectors) {
      const header = $(selector);
      if (header.length) {
        let nextElement = header.parent().next();
        while (nextElement.length && !meaning) {
          if (nextElement.is('dl')) {
            meaning = nextElement.find('dd').first().text().trim();
            break;
          } else if (nextElement.is('ol')) {
            meaning = nextElement.find('li').first().text().trim();
            break;
          }
          nextElement = nextElement.next();
        }
        if (meaning) break;
      }
    }
    
    return {
      meaning: meaning || null,
      example: "Example not found",
      ipa: ipa || null
    };
    
  } catch (err) {
    console.error("Error en web scraping:", err.message);
    return null;
  }
}

/**
 * Endpoint para buscar datos de una palabra y obtener IPA, definición y ejemplo multi-fuente.
 */
console.log('Defining routes...');
app.get("/search", async (req, res) => {
  console.log('=== INICIO DE BÚSQUEDA ===');
  
  // 1) Leer parámetros
  const rawWord = (req.query.word || "").trim();
  const lang = (req.query.lang || "en").trim().toLowerCase();
  
  console.log(`Parámetros recibidos: word="${rawWord}", lang="${lang}"`);

  // 2) Validaciones básicas
  if (!rawWord) {
    return res.status(400).json({ error: "Falta el parámetro 'word'" });
  }
  
  if (!["en", "es"].includes(lang)) {
    return res.status(400).json({ 
      error: `Idioma '${lang}' no soportado. Solo se admiten 'en' (inglés) y 'es' (español).` 
    });
  }

  // 3) Validación específica del idioma
  const validation = validateWordForLanguage(rawWord, lang);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  try {
    console.log(`Procesando búsqueda para "${rawWord}" en idioma "${lang}"`);

    // 4A) Procesamiento para inglés
    if (lang === "en") {
      console.log('Buscando en diccionario de inglés...');
      
      const responseEn = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(rawWord)}`,
        { timeout: 10000 }
      );
      
      const dataEn = responseEn.data;
      const parsedEn = parseDictionaryData(dataEn);
      
      if (!parsedEn) {
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en el diccionario de inglés.`
        });
      }

      console.log('Datos extraídos del diccionario inglés:', { 
        ipa: parsedEn.ipa, 
        meaning: parsedEn.meaning?.substring(0, 50) 
      });

      // Obtener ejemplo de múltiples fuentes
      let exampleEn = await getExampleMultiSource(parsedEn.example, rawWord);
      if (!exampleEn) exampleEn = "Example not found";

      console.log('=== BÚSQUEDA COMPLETADA (EN) ===');
      return res.json({
        word: rawWord.toLowerCase(),
        ipa: parsedEn.ipa || "",
        meaning: parsedEn.meaning || "",
        example: exampleEn,
        language: "en"
      });
    }

    // 4B) Procesamiento para español
    if (lang === "es") {
      console.log('Buscando en Wiktionary español...');
      
      const dataEs = await fetchWiktionaryEsRest(rawWord);
      
      if (!dataEs || (!dataEs.meaning && !dataEs.ipa)) {
        console.log('No se encontró información en Wiktionary ES');
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en el diccionario de español.`
        });
      }

      console.log('Datos extraídos de Wiktionary ES:', { 
        ipa: dataEs.ipa, 
        meaning: dataEs.meaning?.substring(0, 50) 
      });

      console.log('=== BÚSQUEDA COMPLETADA (ES) ===');
      return res.json({
        word: rawWord.toLowerCase(),
        ipa: dataEs.ipa || "",
        meaning: dataEs.meaning || "",
        example: dataEs.example || "Example not found",
        language: "es"
      });
    }

  } catch (error) {
    console.error(`=== ERROR EN BÚSQUEDA [${lang}] ===`);
    console.error('Mensaje de error:', error.message);
    
    if (error.response) {
      console.error('Status de respuesta:', error.response.status);
      console.error('URL solicitada:', error.config?.url);
    }

    // Manejo específico de errores 404
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: `La palabra '${rawWord}' no existe en el diccionario de ${lang === 'en' ? 'inglés' : 'español'}.`
      });
    }

    // Error de timeout o conexión
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(408).json({
        error: `Timeout al consultar el diccionario. Intenta de nuevo en unos momentos.`
      });
    }

    return res.status(500).json({ 
      error: `Error interno del servidor: ${error.message}` 
    });
  }
});

// ======= Descarga las imagens seleccionadas, en MEDIA PATH =======
app.post('/save-image', upload.single('file'), async (req, res) => {
  try {
    let filename;
    if (req.file) {
      // user-uploaded image
      filename = req.file.filename;
    } else {
      // download from remote URL
      const imageUrl = req.body.url;
      if (!imageUrl) return res.status(400).json({ error: 'Missing url in body' });
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      filename = `${Date.now()}${ext}`;
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const dest = fs.createWriteStream(path.join(MEDIA_PATH, filename));
      response.data.pipe(dest);
      await new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', reject);
      });
    }
    res.json({ filename });
  } catch (error) {
    console.error('Error in POST /save-image:', error.message);
    res.status(500).json({ error: error.toString() });
  }
});

// async function noteExists(deck, model, normalizedWord, ankiConnectUrl) {
//   // Este ejemplo asume que el campo 'Word' es el que se verifica.
//   const query = `deck:"${deck}" note:"${model}" Word:"${normalizedWord}"`;
//   const payload = { action: 'findNotes', version: 6, params: { query } };
//   try {
//     const response = await axios.post(ankiConnectUrl, payload, {
//       headers: { 'Content-Type': 'application/json' }
//     });
//     // Si se encontraron notas, retorna true
//     return response.data.result && response.data.result.length > 0;
//   } catch (error) {
//     console.error("Error al buscar nota:", error.message);
//     return false;
//   }
// }

// /**
//  * Endpoint para crear la tarjeta en Anki.
//  */
// app.post('/create-card', async (req, res) => {
//   try {
//     const { deck, model, ankiConnectUrl, word, ipa, meaning, example } = req.body;
//     if (!deck || !model || !ankiConnectUrl || !word || !ipa || !meaning || !example) {
//       return res.status(400).json({ error: 'Missing required fields' });
//     }

//     const normalizedWord = word.trim().toLowerCase();

//     // Verificar si ya existe la nota
//     const exists = await noteExists(deck, model, normalizedWord, ankiConnectUrl);
//     if (exists) {
//       return res.status(400).json({ error: 'La palabra ya existe en el deck.' });
//     }

//     const audioWordFilename = `${normalizedWord}_pronunciation.mp3`;
//     const audioMeaningFilename = `${normalizedWord}_definition.mp3`;
//     const audioExampleFilename = `${normalizedWord}_example.mp3`;

//     await createAudio(word, audioWordFilename);
//     await createAudio(meaning, audioMeaningFilename);
//     await createAudio(example, audioExampleFilename);

//     const fields = {
//       Word: normalizedWord,
//       Sound: `[sound:${audioWordFilename}]`,
//       IPA: ipa.trim(),
//       Meaning: meaning.trim(),
//       Example: example.trim(),
//       Sound_Meaning: `[sound:${audioMeaningFilename}]`,
//       Sound_Example: `[sound:${audioExampleFilename}]`
//     };

//     const result = await addCardToAnki(deck, model, fields, ankiConnectUrl);
//     res.json(result);
//   } catch (error) {
//     console.error('Error en /create-card:', error.message);
//     res.status(500).json({ error: error.toString() });
//   }
// });

// // Endpoint para obtener los decks desde AnkiConnect
// app.post('/anki/decks', async (req, res) => {
//   const { ankiConnectUrl } = req.body;
//   if (!ankiConnectUrl) {
//     return res.status(400).json({ error: 'Falta ankiConnectUrl' });
//   }
//   try {
//     const deckResponse = await axios.post(ankiConnectUrl, {
//       action: 'deckNames',
//       version: 6,
//     }, {
//       headers: { 'Content-Type': 'application/json' }
//     });
//     res.json(deckResponse.data);
//   } catch (error) {
//     console.error('Error al obtener decks:', error.message);
//     res.status(500).json({ error: error.toString() });
//   }
// });

// // Endpoint para obtener los modelos desde AnkiConnect
// app.post('/anki/models', async (req, res) => {
//   const { ankiConnectUrl } = req.body;
//   if (!ankiConnectUrl) {
//     return res.status(400).json({ error: 'Falta ankiConnectUrl' });
//   }
//   try {
//     const modelResponse = await axios.post(ankiConnectUrl, {
//       action: 'modelNames',
//       version: 6,
//     }, {
//       headers: { 'Content-Type': 'application/json' }
//     });
//     res.json(modelResponse.data);
//   } catch (error) {
//     console.error('Error al obtener modelos:', error.message);
//     res.status(500).json({ error: error.toString() });
//   }
// });

// CORS preflight for Anki proxy
app.options('/anki-proxy', cors(corsOptions));

// // /**
// //  * Proxy seguro para AnkiConnect.
// //  * - El cuerpo debe traer: { action, version, params }
// //  * - La URL de AnkiConnect se pasa en un header custom 'x-anki-url'
// //  * - Valida que sea localhost o 127.0.0.1 para prevenir SSRF
// //  */
// app.post('/anki-proxy', async (req, res) => {
//   try {
//     const ankiUrl = req.get('x-anki-url');
//     if (!ankiUrl) return res.status(400).json({ error: 'Falta header x-anki-url' });

//     const { hostname, protocol, port } = new URL(ankiUrl);
//     if (!['http:','https:'].includes(protocol) ||
//         !['localhost','127.0.0.1'].includes(hostname) ||
//         (port && port !== '8765')) {
//       return res.status(400).json({ error: 'URL de AnkiConnect no permitida' });
//     }

//     const response = await axios.post(
//       ankiUrl,
//       {
//         action:  req.body.action,
//         version: req.body.version,
//         params:  req.body.params || {}
//       },
//       { headers: { 'Content-Type': 'application/json' } }
//     );
//     res.json(response.data);
//   } catch (e) {
//     console.error('Error proxying to AnkiConnect:', e.message);
//     res.status(500).json({ error: e.toString() });
//   }
// });

console.log('Attempting to listen on the port...');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});