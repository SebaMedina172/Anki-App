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
 * Usa la REST API “mobile-html” de Wiktionary ES para extraer:
 *   • IPA (tabla .pron-graf)
 *   • Primera definición (sección “Sustantivo_masculino” o “Verbo” según corresponda)
 *   • Primer ejemplo anidado (si existe dentro de <ul><li> en la definición)
 *
 * Si la palabra no existe (404) o no se logra extraer, devuelve null.
 */
async function fetchWiktionaryEsRest(word) {
  try {
    // 1) Llamamos a mobile-html en Wiktionary ES
    const url = `https://es.wiktionary.org/api/rest_v1/page/mobile-html/${encodeURIComponent(
      word
    )}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "AnkiApp/1.0 (tu-email@dominio.com)"
      }
    });
    const data = response.data;

    // 2) La respuesta incluye `data.lead.html` (la parte superior, con pronunciación, etimología, etc.)
    //    y `data.remaining.html` (el resto de secciones). Concatenamos ambos fragmentos:
    const fullHtml = `${data.lead.html}${data.remaining.html || ""}`;
    const $ = cheerio.load(fullHtml);

    // 3) Extraer IPA de la tabla .pron-graf (la tabla de pronunciación que se ubica junto al título)
    //    Buscar <table class="pron-graf"> y dentro <span> o directamente el texto ['au.to'], etc.
    let ipa = null;
    const pronGraf = $("table.pron-graf");
    if (pronGraf.length) {
      // Dentro de la tabla, normalmente está en un <td> que contiene algo como "['au.to']"
      // Seleccionamos el primer <td> que siga al encabezado de AFI
      const textoIpa = pronGraf.find("td").filter((i, el) => {
        const t = $(el).text().trim();
        // Filtramos aquel <td> cuyo contenido parezca tener corchetes de IPA
        return /\[.+\]/.test(t);
      }).first().text().trim();

      if (textoIpa) {
        // Si viene algo como "['au.to']" o "[ˈar.bol]", nos quedamos solo con el interior
        const match = textoIpa.match(/\[([^\]]+)\]/);
        if (match && match[1]) {
          ipa = `/${match[1]}/`;
        }
      }
    }

    // 4) Extraer la primera definición:
    //    Buscamos la sección de “Sustantivo_masculino” primero. Si no existe, buscamos “Sustantivo_femenino” u otras.
    //    El HTML de cada sección tiene un <h3 id="Sustantivo_masculino"> y luego, generalmente, un <p> o un <dl><dt><dd>.
    let meaning = null;
    // Intentamos encontrar <h3 id="Sustantivo_masculino"> y extraer el primer <dd> de su lista <dl>
    let sección = $('h3[id="Sustantivo_masculino"]');
    if (!sección.length) {
      // Si no hay “Sustantivo_masculino”, quizá sea “Sustantivo_femenino” u otra categoría
      sección = $('h3[id^="Sustantivo"]').first();
    }
    if (sección.length) {
      // El siguiente <dl> inmediato contendrá <dt> (número de acepción) y <dd> (texto de definición)
      const dl = sección.nextAll("dl").first();
      if (dl.length) {
        // Tomamos el primer <dd> como la definición principal
        const primeraDd = dl.find("dd").first();
        if (primeraDd.length) {
          meaning = primeraDd.text().trim();
        }
      }
    }

    // 4.b) Si no encontramos nada en “Sustantivo…”, probamos otras categorías (“Verbo”, “Adjetivo”)
    if (!meaning) {
      const posibles = ["Verbo", "Adjetivo", "Adverbio", "Interjección"];
      for (const cat of posibles) {
        const hsec = $(`h3[id^="${cat}"]`).first();
        if (hsec.length) {
          const dl2 = hsec.nextAll("dl").first();
          if (dl2.length) {
            const dd2 = dl2.find("dd").first();
            if (dd2.length) {
              meaning = dd2.text().trim();
              break;
            }
          }
        }
      }
    }

    // 5) Extraer un ejemplo:
    //    - Si la definición (primer <dd>) tiene un <ul><li> anidado, tomamos el texto del primer <li>.
    let example = null;
    if (meaning) {
      // Ubicamos de nuevo la misma primera <dd>
      const primeraDD = sección.nextAll("dl").first().find("dd").first();
      // Vemos si hay un <ul><li> indenado
      const liEj = primeraDD.find("ul li").first();
      if (liEj.length) {
        example = liEj.text().trim();
      }
    }

    // Si no hallamos “example” dentro de la definición, lo dejamos como “Example not found”
    if (!example) {
      example = "Example not found";
    }

    // 6) Si no existe ni IPA ni definición, devolvemos null
    if (!meaning && !ipa) {
      return null;
    }

    // 7) Devolvemos el objeto final
    return {
      meaning: meaning || null,
      example,
      ipa: ipa || null
    };
  } catch (err) {
    // Si la página no existe (404), axios arroja error.response.status === 404
    if (err.response && err.response.status === 404) {
      return null;
    }
    console.error("Error en fetchWiktionaryEsRest:", err.message);
    return null;
  }
}

/**
 * Endpoint para buscar datos de una palabra y obtener IPA, definición y ejemplo multi-fuente.
 */
console.log('Defining routes...');
app.get("/search", async (req, res) => {
  // 1) Leer parámetros
  const rawWord = (req.query.word || "").trim();
  const lang = (req.query.lang || "en").trim().toLowerCase();

  // 2) Validaciones
  if (!rawWord) {
    return res.status(400).json({ error: "Missing word parameter" });
  }
  if (!["en", "es"].includes(lang)) {
    return res.status(400).json({ error: `Idioma '${lang}' no soportado. Solo 'en' y 'es'.` });
  }
  if (!regexByLang[lang].test(rawWord)) {
    return res.status(400).json({
      error: `La palabra '${rawWord}' no es válida para el idioma '${lang}'.`
    });
  }

  try {
    // 3A) Si es inglés: dictionaryapi.dev + getExampleMultiSource (igual que antes)
    if (lang === "en") {
      const responseEn = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(rawWord)}`
      );
      const dataEn = responseEn.data;              // array de resultados
      const parsedEn = parseDictionaryData(dataEn); // { ipa, meaning, example }
      if (!parsedEn) {
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en inglés.`
        });
      }
      let exampleEn = await getExampleMultiSource(parsedEn.example, rawWord);
      if (!exampleEn) exampleEn = "Example not found";

      return res.json({
        word: rawWord.toLowerCase(),
        ipa: parsedEn.ipa || "",
        meaning: parsedEn.meaning || "",
        example: exampleEn
      });
    }

    // 3B) Si es español: usamos fetchWiktionaryEsRest
    if (lang === "es") {
      const dataEs = await fetchWiktionaryEsRest(rawWord);
      if (!dataEs) {
        return res.status(404).json({
          error: `No se encontró información para '${rawWord}' en el diccionario de español (Wiktionary).`
        });
      }
      return res.json({
        word: rawWord.toLowerCase(),
        ipa: dataEs.ipa || "",
        meaning: dataEs.meaning || "",
        example: dataEs.example || "Example not found"
      });
    }
  } catch (error) {
    // 4) Manejo de errores: dictionaryapi.dev (404) o red
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: `La palabra '${rawWord}' no existe en el diccionario de ${lang}.`
      });
    }
    console.error(`Error en /search [${lang}]:`, error.message);
    return res.status(500).json({ error: error.toString() });
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