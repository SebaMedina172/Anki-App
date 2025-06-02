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
  en: /^[A-Za-z'-]+$/,                             // sólo letras A-Z o apóstrofe/guión
  es: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]+$/                 // incluye vocales acentuadas y ñ
};

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
 * Consulta directamente la página HTML de Wiktionary en español y extrae:
 *   • El significado (primera <li> dentro de la primera <ol> en la sección Español)
 *   • Un ejemplo de uso (primer <li> dentro de un <ul> anidado, si lo hay)
 *   • La pronunciación IPA (primera <span class="IPA"> encontrada bajo “Pronunciación”)
 *
 * Si no encuentra nada de esto, devuelve null.
 */
async function fetchWiktionaryEs(word) {
  // Helper interno que toma la “forma exacta” del título (puede ser con 
  // mayúscula inicial o no) y parsea el HTML buscado.
  const _scrapeHtml = async (titulo) => {
    try {
      // 1) Descargamos el HTML completo de la página Wiktionary
      const url = `https://es.wiktionary.org/wiki/${encodeURIComponent(titulo)}`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "TuApp/1.0 (tunombre@ejemplo.com)" }
      });
      const html = response.data;
      const $ = cheerio.load(html);

      // 2) Localizamos el <h2> cuya clase .mw-headline sea exactamente "Español"
      const esHeader = $('h2 .mw-headline')
        .filter((i, el) => $(el).text().trim() === 'Español')
        .closest('h2');
      if (!esHeader.length) {
        return null;
      }

      // 3) Recorremos todos los hermanos inmediatos de esHeader hasta el siguiente <h2>
      let elem = esHeader.next();
      let meaning = null;
      let example = null;
      let ipa = null;

      while (elem.length && elem[0].name !== 'h2') {
        // 3.a) Si encontramos una <ol> y todavía no tenemos "meaning", lo tomamos de la primera <li>
        if (!meaning && elem[0].name === 'ol') {
          const primeraLi = elem.find('> li').first();
          if (primeraLi.length) {
            meaning = primeraLi.text().trim() || null;
            // 3.a.i) Dentro de esa misma <li>, si hay un <ul><li> (lista de ejemplos),
            //          tomamos el primer <li> como ejemplo.
            const ejemploLi = primeraLi.find('ul li').first();
            if (ejemploLi.length) {
              example = ejemploLi.text().trim() || null;
            }
          }
        }

        // 3.b) Si encontramos un <h3> cuyo texto sea "Pronunciación" 
        //      (puede ser el encabezado para IPA), buscamos ahí la primera .IPA
        if (!ipa && elem[0].name === 'h3') {
          const headline = elem.find('.mw-headline').text().trim();
          if (headline === 'Pronunciación') {
            // Vamos caminando hermanos hasta el próximo <h2> o <h3>, en busca de <span class="IPA">
            let subElem = elem.next();
            while (subElem.length && subElem[0].name !== 'h2' && subElem[0].name !== 'h3') {
              const ipaSpan = subElem.find('span.IPA').first();
              if (ipaSpan.length) {
                ipa = ipaSpan.text().trim() || null;
                break;
              }
              subElem = subElem.next();
            }
          }
        }

        elem = elem.next();
      }

      return {
        meaning: meaning || null,
        example: example || null,
        ipa: ipa || null
      };
    } catch (err) {
      console.error("Error en _scrapeHtml (Wiktionary ES):", err.message);
      return null;
    }
  };

  // 4) Intentamos primero con la palabra tal cual (minúsculas)
  let resultado = await _scrapeHtml(word);
  if (resultado) {
    return resultado;
  }

  // 5) Si no apareció, intentamos con la primera letra en mayúscula (p. ej. "Auto")
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  if (capitalized !== word) {
    resultado = await _scrapeHtml(capitalized);
    if (resultado) {
      return resultado;
    }
  }

  // 6) Si aun así no hay nada, devolvemos null
  return null;
}




/**
 * Endpoint para buscar datos de una palabra y obtener IPA, definición y ejemplo multi-fuente.
 */
console.log('Defining routes...');
app.get('/search', async (req, res) => {
  // 1) Leer parámetros
  const rawWord = (req.query.word || '').trim();
  const lang = (req.query.lang || 'en').trim().toLowerCase();

  // 2) Validar entrada mínima
  if (!rawWord) {
    return res.status(400).json({ error: 'Missing word parameter' });
  }
  if (!['en', 'es'].includes(lang)) {
    return res.status(400).json({
      error: `Idioma '${lang}' no soportado. Por ahora solo 'en' y 'es'.`
    });
  }
  if (!regexByLang[lang].test(rawWord)) {
    return res.status(400).json({
      error: `La palabra '${rawWord}' no es válida para el idioma '${lang}'.`
    });
  }

  try {
    let parsed = null;
    // 3) Si es inglés, usamos dictionaryapi.dev + getExampleMultiSource
    if (lang === 'en') {
      // Llamada a DictionaryAPI en inglés
      const responseEn = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(rawWord)}`
      );
      const dataEn = responseEn.data;                   // Array de resultados
      parsed = parseDictionaryData(dataEn);             // { ipa, meaning, example }
      if (!parsed) {
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en inglés.`
        });
      }

      // Ejemplo multi-fuente (API → Linguee → Tatoeba)
      let exampleEn = await getExampleMultiSource(parsed.example, rawWord);
      if (!exampleEn) exampleEn = 'Example not found';

      return res.json({
        word: rawWord.toLowerCase(),
        ipa: parsed.ipa || '',
        meaning: parsed.meaning || '',
        example: exampleEn
      });
    }

    // 4) Si es español, usamos Wiktionary
    if (lang === 'es') {
      const wikiData = await fetchWiktionaryEs(rawWord);
      if (!wikiData || (!wikiData.meaning && !wikiData.example && !wikiData.ipa)) {
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en el diccionario de español.`
        });
      }
      // Aseguramos que al menos vengan campos vacíos, nunca undefined
      return res.json({
        word: rawWord.toLowerCase(),
        ipa: wikiData.ipa || '',
        meaning: wikiData.meaning || '',
        example: wikiData.example || 'Example not found'
      });
    }
  } catch (error) {
    // 5) Manejo de errores puntuales
    //    - Si dictionaryapi.dev devolvió 404
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: `La palabra '${rawWord}' no existe en el diccionario de ${lang}.`
      });
    }
    console.error(`Error en /search [${lang}]:`, error.message);
    return res.status(500).json({ error: error.toString() });
  }
});


// ======= Preview endpoint: Retorna 5 imagenes con su URL's =======
app.get('/search-image', async (req, res) => {
  const query = (req.query.query || '').trim();
  const lang = (req.query.lang || 'en').trim().toLowerCase();

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  if (!['en', 'es'].includes(lang)) {
    return res.status(400).json({
      error: `Idioma '${lang}' no soportado para búsqueda de imágenes.`
    });
  }

  try {
    const apiKey = process.env.PIXABAY_API_KEY;
    // Nota: podrías traducir el query (“perro” → “dog”) si quisieras resultados en 
    // inglés, pero aquí dejamos la palabra tal cual
    const resp = await axios.get("https://pixabay.com/api/", {
      params: { key: apiKey, q: query, per_page: 5, image_type: "photo", safesearch: true }
    });
    const images = resp.data.hits.map((hit) => ({
      id: hit.id,
      previewURL: hit.previewURL,
      fullURL: hit.largeImageURL || hit.webformatURL,
    }));
    res.json({ images });
  } catch (error) {
    console.error("Error in GET /search-image:", error.message);
    res.status(500).json({ error: error.toString() });
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