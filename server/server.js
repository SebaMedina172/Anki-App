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
const translate = require('@vitalets/google-translate-api');
const keywordExtractor = require('keyword-extractor');

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;


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
  origin: 'https://anki-app-sm.vercel.app', // change to '*' if needed for testing
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
 * Parser ultra robusto para Wiktionary ES
 * Maneja múltiples formatos y estructuras inconsistentes
 */
async function fetchWiktionaryEsRest(word) {
  try {
    console.log('Buscando palabra en Wiktionary ES:', word);
    
    const url = `https://es.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(word)}`;
    console.log('URL de búsqueda:', url);
    
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "AnkiApp/1.0 (educational-purposes@example.com)",
        "Accept": "text/html"
      },
      timeout: 15000
    });

    if (!response.data) {
      console.log('No hay data en la respuesta');
      return null;
    }

    const $ = cheerio.load(response.data);
    console.log('HTML cargado correctamente');

    // ===== EXTRAER IPA =====
    let ipa = extractIPA($);
    
    // ===== EXTRAER SIGNIFICADO CON NUEVO MÉTODO =====
    let meaning = extractMeaning($, word);
    
    console.log('Resultado extraído:', { 
      ipa, 
      meaning: meaning?.substring(0, 100) + (meaning?.length > 100 ? '...' : ''),
      meaningLength: meaning?.length
    });

    if (!meaning && !ipa) {
      console.log('No se encontró ni significado ni IPA');
      return null;
    }

    return {
      meaning: meaning || null,
      example: "Example not found", // Por ahora no extraemos ejemplos de Wiktionary
      ipa: ipa || null
    };

  } catch (err) {
    console.error("Error en fetchWiktionaryEsRest:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
    }
    return null;
  }
}

/**
 * Extrae IPA de múltiples ubicaciones posibles
 */
function extractIPA($) {
  console.log('Extrayendo IPA...');
  
  // Lista de selectores para buscar IPA, ordenados por prioridad
  const ipaSelectors = [
    // Tablas de pronunciación
    'table.pron-graf td',
    'table.wikitable td',
    '.pronunciación td',
    
    // Spans y elementos específicos
    '.IPA',
    'span[title*="AFI"]',
    'span[title*="IPA"]',
    
    // Búsqueda más amplia
    'td:contains("/")',
    'span:contains("/")',
    
    // Último recurso: buscar en cualquier elemento que contenga corchetes
    '*:contains("[")'
  ];
  
  for (const selector of ipaSelectors) {
    try {
      const elements = $(selector);
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements.eq(i);
        const text = element.text().trim();
        
        // Buscar patrones de IPA
        const ipaPatterns = [
          /\[([^\]]+)\]/,     // [ˈbos]
          /\/([^\/]+)\//,     // /ˈbos/
          /ˈ[^,\s]+/,         // ˈbos (sin delimitadores)
        ];
        
        for (const pattern of ipaPatterns) {
          const match = text.match(pattern);
          if (match) {
            let ipaText = match[1] || match[0];
            
            // Limpieza del IPA
            ipaText = ipaText.replace(/^ˈ?/, ''); // remover acento inicial si está solo
            
            // Validar que parece IPA (contiene símbolos fonéticos)
            if (/[ˈˌəɪʊɛɔaeiouθðʃʒtʃdʒŋɲɾrɣβ]/.test(ipaText)) {
              console.log(`IPA encontrado con selector "${selector}": /${ipaText}/`);
              return `/${ipaText}/`;
            }
          }
        }
      }
    } catch (e) {
      console.log(`Error con selector IPA "${selector}":`, e.message);
    }
  }
  
  console.log('No se encontró IPA');
  return null;
}

/**
 * Extrae significado siguiendo la estructura específica de Wiktionary ES:
 * section > h3/h4 (tipo de palabra) > dl > dd (definición)
 */
function extractMeaning($, word) {
  console.log('Extrayendo significado con nuevo método...');
  
  // Primero, buscar todas las secciones que contengan información de palabras
  const sections = $('section');
  console.log(`Encontradas ${sections.length} secciones`);
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections.eq(i);
    console.log(`\n--- Analizando sección ${i + 1} ---`);
    
    // Buscar headers h3 y h4 dentro de la sección
    const headers = section.find('h3, h4');
    console.log(`  Headers encontrados en sección: ${headers.length}`);
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers.eq(j);
      const headerText = header.text().trim();
      console.log(`    Analizando header: "${headerText}"`);
      
      // Verificar si es un tipo de palabra (sustantivo, verbo, etc.)
      if (isWordTypeHeader(headerText)) {
        console.log(`    ✓ Es un tipo de palabra válido`);
        
        // Buscar dl que sigue al header
        const meaning = extractDefinitionFromHeader($, header);
        if (meaning && meaning.length > 3) {
          console.log(`    ✓ Definición encontrada: "${meaning.substring(0, 100)}..."`);
          return meaning;
        }
      }
    }
  }
  
  // Si no encontramos nada en las secciones, hacer búsqueda alternativa
  console.log('\nBúsqueda alternativa fuera de secciones...');
  return extractMeaningAlternative($);
}

/**
 * Búsqueda alternativa cuando falla el método principal
 */
function extractMeaningAlternative($) {
  console.log('Aplicando método alternativo...');
  
  // Buscar cualquier dl > dd que contenga una definición válida
  const allDLs = $('dl');
  console.log(`  Total de elementos dl encontrados: ${allDLs.length}`);
  
  for (let i = 0; i < allDLs.length; i++) {
    const dl = allDLs.eq(i);
    const definition = extractFromDL($, dl);
    
    if (definition && definition.length > 10) {
      // Verificar que no sea metadata o información irrelevante
      if (!isMetadataText(definition)) {
        console.log(`  ✓ Definición alternativa encontrada: "${definition.substring(0, 50)}..."`);
        return definition;
      }
    }
  }
  
  // Último recurso: buscar en cualquier dd
  const allDDs = $('dd');
  console.log(`  Total de elementos dd encontrados: ${allDDs.length}`);
  
  for (let i = 0; i < allDDs.length; i++) {
    const dd = allDDs.eq(i);
    const text = extractTextFromDD($, dd);
    
    if (text && text.length > 10 && !isMetadataText(text)) {
      console.log(`  ✓ Definición en dd encontrada: "${text.substring(0, 50)}..."`);
      return text;
    }
  }
  
  return null;
}

/**
 * Verifica si un texto es metadata o información irrelevante
 */
function isMetadataText(text) {
  const metadataPatterns = [
    /mw-parser-output/i,
    /\{\{.*\}\}/,
    /^[A-Z][a-z]{0,3}\.?$/,
    /Referencias/i,
    /Véase también/i,
    /Etimología/i,
    /Pronunciación/i,
    /Sinónimos?:/i,
    /Antónimos?:/i,
    /Ejemplos?:/i,
    /^\s*\d+\.\s*$/, // Solo números
    /^[•·-]\s*$/ // Solo viñetas
  ];
  
  return metadataPatterns.some(pattern => pattern.test(text));
}

/**
 * Verifica si un header corresponde a un tipo de palabra
 */
function isWordTypeHeader(headerText) {
  const wordTypes = [
    // Sustantivos
    'sustantivo', 'sustantivo masculino', 'sustantivo femenino', 'sustantivo común',
    // Verbos  
    'verbo', 'verbo transitivo', 'verbo intransitivo', 'verbo pronominal',
    // Adjetivos
    'adjetivo', 'adjetivo calificativo', 'adjetivo relacional',
    // Otros
    'adverbio', 'pronombre', 'interjección', 'preposición', 'conjunción',
    'artículo', 'numeral', 'determinante'
  ];
  
  const lowerText = headerText.toLowerCase();
  return wordTypes.some(type => lowerText.includes(type));
}

/**
 * Extrae la definición siguiendo la estructura: header > dl > dd
 */
function extractDefinitionFromHeader($, header) {
  console.log(`      Buscando definición para header: "${header.text()}"`);
  
  // Estrategia 1: Buscar dl inmediatamente después del header
  let current = header.next();
  let attempts = 0;
  
  while (current.length && attempts < 5) {
    attempts++;
    console.log(`        Intento ${attempts}: Elemento actual: ${current.prop('tagName')}`);
    
    if (current.is('dl')) {
      const definition = extractFromDL($, current);
      if (definition) {
        console.log(`        ✓ Definición encontrada en dl directo`);
        return definition;
      }
    }
    
    // Si no es dl, buscar dl dentro del elemento actual
    const dlInside = current.find('dl');
    if (dlInside.length) {
      const definition = extractFromDL($, dlInside.first());
      if (definition) {
        console.log(`        ✓ Definición encontrada en dl interno`);
        return definition;
      }
    }
    
    current = current.next();
  }
  
  // Estrategia 2: Buscar en el mismo nivel o en elementos hermanos
  const parentSection = header.closest('section');
  if (parentSection.length) {
    const dlInSection = parentSection.find('dl');
    for (let i = 0; i < dlInSection.length; i++) {
      const dl = dlInSection.eq(i);
      const definition = extractFromDL($, dl);
      if (definition) {
        console.log(`        ✓ Definición encontrada en dl de sección`);
        return definition;
      }
    }
  }
  
  return null;
}

/**
 * Extrae texto de un elemento dl > dd
 */
function extractFromDL($, dlElement) {
  const ddElements = dlElement.find('dd');
  console.log(`          Elementos dd encontrados: ${ddElements.length}`);
  
  for (let i = 0; i < ddElements.length; i++) {
    const dd = ddElements.eq(i);
    let text = extractTextFromDD($, dd);
    
    if (text && text.length > 3) {
      console.log(`          ✓ Texto extraído de dd: "${text.substring(0, 50)}..."`);
      return text;
    }
  }
  
  return null;
}

/**
 * Extrae texto de un elemento dd, manejando links y spans internos
 */
function extractTextFromDD($, ddElement) {
  console.log('          Extrayendo texto de dd...');
  
  // Clonar el elemento para no modificar el original
  const ddClone = ddElement.clone();
  
  // Remover todas las listas (ul, ol) que contienen sinónimos, antónimos, ejemplos, etc.
  ddClone.find('ul, ol').remove();
  
  // También remover otros elementos que suelen contener información adicional
  ddClone.find('.mw-collapsible').remove(); // Secciones colapsables
  ddClone.find('.NavFrame').remove(); // Marcos de navegación
  ddClone.find('.ejemplo').remove(); // Ejemplos específicos
  ddClone.find('.sinonimos').remove(); // Sinónimos específicos
  ddClone.find('.antonimos').remove(); // Antónimos específicos
  
  // Obtener el texto limpio
  let text = ddClone.text().trim();
  
  // Si el texto resultante está vacío o muy corto, intentar estrategias alternativas
  if (!text || text.length < 3) {
    console.log('          Texto muy corto, intentando estrategias alternativas...');
    
    // Buscar en spans que no estén dentro de listas
    const spans = ddElement.find('span').filter(function() {
      return $(this).closest('ul, ol').length === 0;
    });
    
    for (let i = 0; i < spans.length; i++) {
      const spanText = spans.eq(i).text().trim();
      if (spanText && spanText.length > 3) {
        text = spanText;
        break;
      }
    }
    
    // Si aún no hay texto, buscar en elementos de texto directo (no en listas)
    if (!text || text.length < 3) {
      const directText = ddElement.contents().filter(function() {
        return this.nodeType === 3 && // Nodo de texto
               $(this).text().trim().length > 3;
      }).first().text().trim();
      
      if (directText) {
        text = directText;
      }
    }
  }
  
  // Limpiar el texto obtenido
  const cleanedText = cleanMeaningText(text);
  
  if (cleanedText) {
    console.log(`          ✓ Texto extraído (sin listas): "${cleanedText.substring(0, 50)}..."`);
  } else {
    console.log('          ✗ No se pudo extraer texto válido');
  }
  
  return cleanedText;
}


/**
 * Extrae significado de una sección específica
 */
function extractMeaningFromSection($, header) {
  // Buscar en los siguientes elementos después del header
  let current = header.next();
  let attempts = 0;
  
  while (current.length && attempts < 10) {
    attempts++;
    
    // Buscar en listas de definición
    if (current.is('dl')) {
      const dd = current.find('dd').first();
      if (dd.length) {
        const text = cleanMeaningText(dd.text());
        if (text && text.length > 3) return text;
      }
    }
    
    // Buscar en listas ordenadas/no ordenadas
    if (current.is('ol, ul')) {
      const li = current.find('li').first();
      if (li.length) {
        const text = cleanMeaningText(li.text());
        if (text && text.length > 3) return text;
      }
    }
    
    // Buscar en párrafos
    if (current.is('p')) {
      const text = cleanMeaningText(current.text());
      if (text && text.length > 3) return text;
    }
    
    // Buscar dentro de divs
    if (current.is('div')) {
      const dd = current.find('dd').first();
      if (dd.length) {
        const text = cleanMeaningText(dd.text());
        if (text && text.length > 3) return text;
      }
      
      const li = current.find('li').first();
      if (li.length) {
        const text = cleanMeaningText(li.text());
        if (text && text.length > 3) return text;
      }
    }
    
    current = current.next();
  }
  
  return null;
}

/**
 * Búsqueda amplia cuando no se encuentra con headers específicos
 */
function extractMeaningBroadSearch($) {
  // Buscar cualquier <dd> que contenga texto sustancial
  const allDDs = $('dd');
  for (let i = 0; i < allDDs.length; i++) {
    const dd = allDDs.eq(i);
    const text = cleanMeaningText(dd.text());
    if (text && text.length > 10 && !text.includes('mw-parser-output')) {
      console.log(`Definición encontrada en búsqueda amplia: "${text.substring(0, 50)}..."`);
      return text;
    }
  }
  
  // Buscar en <li> elementos
  const allLIs = $('li');
  for (let i = 0; i < allLIs.length; i++) {
    const li = allLIs.eq(i);
    const text = cleanMeaningText(li.text());
    if (text && text.length > 10 && !text.includes('mw-parser-output')) {
      console.log(`Definición encontrada en <li>: "${text.substring(0, 50)}..."`);
      return text;
    }
  }
  
  return null;
}

/**
 * Limpia el texto del significado
 */
function cleanMeaningText(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Limpiezas básicas
  text = text.trim();
  
  // Remover patrones específicos de información adicional
  text = text.replace(/Sinónimos?:.*$/gi, ''); // Remover sinónimos al final
  text = text.replace(/Antónimos?:.*$/gi, ''); // Remover antónimos al final
  text = text.replace(/Ejemplos?:.*$/gi, ''); // Remover ejemplos al final
  text = text.replace(/Véase también:.*$/gi, ''); // Remover "véase también"
  text = text.replace(/Relacionados?:.*$/gi, ''); // Remover relacionados
  
  // Cortar en el primer indicador de información adicional
  const cutOffPatterns = [
    /\bSinónimos?\b/i,
    /\bAntónimos?\b/i,
    /\bEjemplos?\b/i,
    /\bVéase también\b/i,
    /\bRelacionados?\b/i,
    /\bDerivados?\b/i,
    /\bCompuestos?\b/i
  ];
  
  for (const pattern of cutOffPatterns) {
    const match = text.search(pattern);
    if (match !== -1) {
      text = text.substring(0, match).trim();
      break;
    }
  }
  
  // Limpiezas generales (como ya tenías)
  text = text.replace(/\.mw-parser-output[^.]*\./g, '');
  text = text.replace(/\{\{[^}]*\}\}/g, '');
  text = text.replace(/\[[^\]]*\]/g, '');
  text = text.replace(/Sus\./g, '');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/^\d+\.?\s*/, '');
  
  // Limpiar caracteres extraños
  text = text.replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ.,;:()¿?¡!-]/g, '');
  
  // Si es muy corto o contiene patrones problemáticos, descartarlo
  if (text.length < 5 || isMetadataText(text)) {
    return null;
  }
  
  return text.trim();
}

/**
 * Función mejorada para obtener ejemplos en español - más estricta
 */
async function getExampleSpanishImproved(word) {
  try {
    console.log(`=== Iniciando búsqueda ESTRICTA de ejemplo para: ${word} ===`);
    
    // Intentar obtener ejemplo real de las fuentes principales
    let example = await getExampleSpanishStrict(word);
    
    // Si no se encontró ejemplo real, devolver mensaje claro
    if (!example) {
      console.log(`No se encontró ejemplo real para: ${word}`);
      return "Ejemplo no encontrado";
    }
    
    console.log(`=== Ejemplo real encontrado para ${word}: ${example} ===`);
    return example;
    
  } catch (error) {
    console.error('Error en getExampleSpanishImproved:', error.message);
    return "Ejemplo no encontrado";
  }
}

/**
 * Búsqueda estricta de ejemplos - solo devuelve ejemplos reales
 */
async function getExampleSpanishStrict(word) {
  console.log(`Buscando ejemplo REAL en español para: ${word}`);
  
  // Intentar múltiples fuentes en orden de prioridad
  const sources = [
    () => getExampleFromTatoebaApi(word),
    () => getExampleFromTatoebaScraping(word),
    () => getExampleFromSpanishDict(word),
    () => getExampleFromLingueeSpanish(word),
    () => getExampleFromRAE(word), // Nueva fuente: RAE
    () => getExampleFromWordReference(word) // Nueva fuente: WordReference
  ];
  
  for (const getExample of sources) {
    try {
      const example = await getExample();
      if (example && isValidRealExample(example, word)) {
        console.log(`Ejemplo REAL encontrado: ${example}`);
        return example;
      }
    } catch (error) {
      console.log(`Error en una fuente de ejemplos: ${error.message}`);
      continue;
    }
  }
  
  return null; // No devolver ejemplos artificiales
}

/**
 * Nueva fuente: Ejemplos del Diccionario de la RAE
 */
async function getExampleFromRAE(word) {
  try {
    console.log(`Intentando RAE para: ${word}`);
    
    // Delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    
    const url = `https://dle.rae.es/${encodeURIComponent(word)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // Acepta códigos de estado menores a 500
      }
    });
    
    // Si obtenemos 403, intentar con un approach diferente
    if (response.status === 403) {
      console.log("403 detectado, intentando método alternativo");
      return await getExampleFromRAEAlternative(word);
    }
    
    const $ = cheerio.load(response.data);
    
    // Buscar ejemplos en la RAE con selectores más específicos
    const exampleSelectors = [
      '.ejemplo',
      '.ej',
      'span[title="ejemplo"]',
      '.ejemplo-texto',
      '.u.ejemplo',
      'em.u',
      '.articulo .ejemplo',
      'p .ejemplo'
    ];
    
    for (const selector of exampleSelectors) {
      const examples = $(selector);
      
      for (let i = 0; i < examples.length; i++) {
        const example = examples.eq(i).text().trim();
        
        if (example && 
            example.toLowerCase().includes(word.toLowerCase()) && 
            example.split(' ').length >= 4 && 
            example.split(' ').length <= 20 &&
            !example.includes('Ver definición') &&
            !example.includes('Diccionario')) {
          // Limpiar comillas y caracteres extraños
          const cleanExample = example.replace(/[""'']/g, '"').trim();
          return cleanExample;
        }
      }
    }
    
  } catch (error) {
    console.log("Error en RAE:", error.message);
    
    // Si hay error de conexión o timeout, intentar método alternativo
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return await getExampleFromRAEAlternative(word);
    }
  }
  
  return null;
}

/**
 * Método alternativo para RAE cuando el principal falla
 */
async function getExampleFromRAEAlternative(word) {
  try {
    console.log(`Intentando RAE método alternativo para: ${word}`);
    
    // Delay más largo
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Intentar con la URL de búsqueda en lugar de directa
    const searchUrl = `https://dle.rae.es/srv/search?m=30&w=${encodeURIComponent(word)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-es',
        'Referer': 'https://dle.rae.es/',
        'Connection': 'keep-alive'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar en los resultados de búsqueda
    const examples = $('.resultado .ejemplo, .resultado em.u');
    
    for (let i = 0; i < examples.length; i++) {
      const example = examples.eq(i).text().trim();
      
      if (example && 
          example.toLowerCase().includes(word.toLowerCase()) && 
          example.split(' ').length >= 4 && 
          example.split(' ').length <= 20) {
        return example.replace(/[""'']/g, '"').trim();
      }
    }
    
  } catch (error) {
    console.log("Error en RAE alternativo:", error.message);
  }
  
  return null;
}

/**
 * Nueva fuente: WordReference español
 */
async function getExampleFromWordReference(word) {
  try {
    console.log(`Intentando WordReference para: ${word}`);
    
    const url = `https://www.wordreference.com/definicion/${encodeURIComponent(word)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar ejemplos en WordReference
    const exampleSelectors = [
      '.example',
      '.FrEx',
      'td[style*="font-style:italic"]',
      '.exemple'
    ];
    
    for (const selector of exampleSelectors) {
      const examples = $(selector);
      
      for (let i = 0; i < examples.length; i++) {
        const example = examples.eq(i).text().trim();
        
        if (example && 
            example.toLowerCase().includes(word.toLowerCase()) && 
            example.split(' ').length >= 4 && 
            example.split(' ').length <= 25) {
          return example.replace(/[""'']/g, '"').trim();
        }
      }
    }
    
  } catch (error) {
    console.log("Error en WordReference:", error.message);
  }
  
  return null;
}


/**
 * Valida que un ejemplo sea real y de calidad
 */
function isValidRealExample(example, word) {
  if (!example || typeof example !== 'string') return false;
  
  const cleanExample = example.trim().toLowerCase();
  const cleanWord = word.trim().toLowerCase();
  
  // Debe contener la palabra
  if (!cleanExample.includes(cleanWord)) return false;
  
  // Debe tener longitud mínima y máxima razonable
  const wordCount = example.split(' ').length;
  if (wordCount < 4 || wordCount > 25) return false;
  
  // No debe ser una plantilla obvia
  const templatePatterns = [
    /la palabra .* es/i,
    /necesito usar .* en/i,
    /conoces el significado de/i,
    /la definición de .* es/i,
    /el término .* se usa/i
  ];
  
  for (const pattern of templatePatterns) {
    if (pattern.test(example)) {
      console.log(`Ejemplo rechazado por ser plantilla: ${example}`);
      return false;
    }
  }
  
  // No debe contener URLs o elementos extraños
  if (cleanExample.includes('http') || 
      cleanExample.includes('@') || 
      cleanExample.includes('www.')) {
    return false;
  }
  
  return true;
}

/**
 * API alternativa para ejemplos en español - usando múltiples fuentes
 */
async function getExampleSpanish(word) {
  console.log(`Buscando ejemplo en español para: ${word}`);
  
  // Intentar múltiples fuentes en orden de prioridad
  const sources = [
    () => getExampleFromTatoebaApi(word),
    () => getExampleFromTatoebaScraping(word),
    () => getExampleFromSpanishDict(word),
    () => getExampleFromLingueeSpanish(word)
  ];
  
  for (const getExample of sources) {
    try {
      const example = await getExample();
      if (example && example !== "Ejemplo no encontrado") {
        console.log(`Ejemplo encontrado: ${example}`);
        return example;
      }
    } catch (error) {
      console.log(`Error en una fuente de ejemplos: ${error.message}`);
      continue;
    }
  }
  
  return "Ejemplo no encontrado";
}

/**
 * Obtener ejemplos de Tatoeba usando su API directa (más confiable)
 */
async function getExampleFromTatoebaApi(word) {
  try {
    console.log(`Intentando API de Tatoeba mejorada para: ${word}`);
    
    // Probar diferentes endpoints de Tatoeba
    const urls = [
      `https://tatoeba.org/en/api_v0/search?from=spa&to=spa&query=${encodeURIComponent(word)}`,
      `https://tatoeba.org/es/api_v0/search?from=spa&to=spa&query=${encodeURIComponent(word)}`
    ];
    
    for (const searchUrl of urls) {
      try {
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 8000
        });
        
        if (response.data && response.data.results) {
          // Ordenar por relevancia (los que contienen la palabra exacta primero)
          const sortedResults = response.data.results.sort((a, b) => {
            const aExact = a.text.toLowerCase().split(' ').includes(word.toLowerCase());
            const bExact = b.text.toLowerCase().split(' ').includes(word.toLowerCase());
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return 0;
          });
          
          for (const result of sortedResults) {
            if (result.text && isValidRealExample(result.text, word)) {
              return result.text.trim();
            }
          }
        }
      } catch (urlError) {
        console.log(`Error con URL ${searchUrl}:`, urlError.message);
        continue;
      }
    }
    
  } catch (error) {
    console.log("Error en API de Tatoeba mejorada:", error.message);
  }
  
  return null;
}

/**
 * Scraping de Tatoeba usando Cheerio (sin Puppeteer)
 */
async function getExampleFromTatoebaScraping(word) {
  try {
    console.log(`Intentando scraping de Tatoeba para: ${word}`);
    
    const url = `https://tatoeba.org/en/sentences/search?query=${encodeURIComponent(word)}&from=spa&to=spa`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar diferentes selectores posibles para las oraciones
    const selectors = [
      '.sentence .text',
      '.sentence-text',
      '.text',
      '[data-sentence-text]',
      '.sentence div:not(.meta)'
    ];
    
    for (const selector of selectors) {
      const sentences = $(selector);
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences.eq(i).text().trim();
        
        if (sentence && 
            sentence.toLowerCase().includes(word.toLowerCase()) && 
            sentence.split(' ').length >= 4 && 
            sentence.split(' ').length <= 20 &&
            !sentence.includes('http') &&
            !sentence.includes('@')) {
          return sentence;
        }
      }
    }
    
  } catch (error) {
    console.log("Error en scraping de Tatoeba:", error.message);
  }
  
  return null;
}

/**
 * Obtener ejemplos de SpanishDict
 */
async function getExampleFromSpanishDict(word) {
  try {
    console.log(`Intentando SpanishDict para: ${word}`);
    
    const url = `https://www.spanishdict.com/translate/${encodeURIComponent(word)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar ejemplos en SpanishDict
    const exampleSelectors = [
      '.example .text',
      '.example-sentence',
      '.example p',
      '.examples .text'
    ];
    
    for (const selector of exampleSelectors) {
      const examples = $(selector);
      
      for (let i = 0; i < examples.length; i++) {
        const example = examples.eq(i).text().trim();
        
        if (example && 
            example.toLowerCase().includes(word.toLowerCase()) && 
            example.split(' ').length >= 4 && 
            example.split(' ').length <= 25) {
          // Limpiar el ejemplo
          const cleanExample = example.replace(/[""'']/g, '"').trim();
          return cleanExample;
        }
      }
    }
    
  } catch (error) {
    console.log("Error en SpanishDict:", error.message);
  }
  
  return null;
}

/**
 * Obtener ejemplos de Linguee para español
 */
async function getExampleFromLingueeSpanish(word) {
  try {
    console.log(`Intentando Linguee español para: ${word}`);
    
    const url = `https://www.linguee.com/spanish-english/search?source=auto&query=${encodeURIComponent(word)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Buscar ejemplos en Linguee
    const exampleDivs = $(".example_lines .line");
    
    exampleDivs.each((i, el) => {
      const text = $(el).text().trim();
      if (text && 
          text.split(' ').length >= 4 && 
          text.toLowerCase().includes(word.toLowerCase()) &&
          !text.includes('http')) {
        return text;
      }
    });
    
  } catch (error) {
    console.log("Error en Linguee español:", error.message);
  }
  
  return null;
}

/**
 * Construye una query inteligente para búsquedas en español
 */
async function buildSmartSpanishQuery(spanishQuery) {
  try {
    console.log(`Construyendo query inteligente para: "${spanishQuery}"`);
    
    // 1. Detectar si es una sola palabra o frase
    const words = spanishQuery.trim().split(/\s+/);
    
    if (words.length === 1) {
      // Una sola palabra: traducir directamente
      const singleWord = words[0];
      const translated = await translateWithContext(singleWord, 'es', 'en');
      console.log(`Palabra única traducida: ${singleWord} -> ${translated}`);
      return translated;
    }
    
    // 2. Para frases: estrategia híbrida
    return await buildHybridQuery(spanishQuery, words);
    
  } catch (error) {
    console.error('Error construyendo query inteligente:', error);
    // Fallback: traducir toda la frase
    try {
      const fallback = await translate(spanishQuery, { to: 'en' });
      return fallback.text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    } catch (e) {
      return spanishQuery; // Último recurso
    }
  }
}

/**
 * Traduce con mejor contexto usando sinónimos y alternativas
 */
async function translateWithContext(word, from, to) {
  try {
    // Diccionario de traducciones específicas para mejorar resultados visuales
    const visualTranslations = {
      'gato': 'cat',
      'perro': 'dog',
      'casa': 'house home',
      'niño': 'child boy',
      'niña': 'child girl',
      'bebé': 'baby',
      'familia': 'family',
      'comida': 'food meal',
      'coche': 'car automobile',
      'árbol': 'tree',
      'flor': 'flower',
      'agua': 'water',
      'fuego': 'fire',
      'sol': 'sun',
      'luna': 'moon',
      'montaña': 'mountain',
      'playa': 'beach',
      'ciudad': 'city urban',
      'campo': 'countryside field',
      'trabajo': 'work office job',
      'escuela': 'school classroom',
      'hospital': 'hospital medical',
      'restaurante': 'restaurant dining',
      'amor': 'love couple romance',
      'feliz': 'happy joy smile',
      'triste': 'sad crying',
      'grande': 'big large',
      'pequeño': 'small little',
      'rápido': 'fast speed',
      'lento': 'slow',
      'nuevo': 'new modern',
      'viejo': 'old vintage'
    };
    
    const lowerWord = word.toLowerCase();
    if (visualTranslations[lowerWord]) {
      console.log(`Traducción visual específica: ${word} -> ${visualTranslations[lowerWord]}`);
      return visualTranslations[lowerWord];
    }
    
    // Traducción estándar
    const result = await translate(word, { from, to });
    return result.text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
  } catch (error) {
    console.error(`Error traduciendo "${word}":`, error);
    return word;
  }
}

/**
 * Construye query híbrida para frases en español
 */
async function buildHybridQuery(originalQuery, words) {
  try {
    // 1. Extraer palabras clave importantes
    const extractorConfig = {
      language: 'spanish',
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: true,
    };
    
    const keywords = keywordExtractor.extract(originalQuery, extractorConfig);
    const importantWords = keywords.slice(0, 3); // Máximo 3 palabras clave
    
    console.log(`Palabras clave extraídas: ${importantWords.join(', ')}`);
    
    // 2. Traducir palabras clave individualmente con contexto
    const translatedKeywords = [];
    for (const word of importantWords) {
      const translated = await translateWithContext(word, 'es', 'en');
      if (translated && translated !== word) {
        translatedKeywords.push(translated);
      }
    }
    
    // 3. También obtener traducción de la frase completa como respaldo
    let fullTranslation = '';
    try {
      const fullResult = await translate(originalQuery, { to: 'en' });
      fullTranslation = fullResult.text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    } catch (e) {
      console.log('No se pudo traducir la frase completa');
    }
    
    // 4. Combinar estratégicamente
    let finalQuery = '';
    if (translatedKeywords.length > 0) {
      finalQuery = translatedKeywords.join(' ');
      
      // Si la traducción completa es muy diferente y corta, agregarla
      if (fullTranslation && 
          fullTranslation.length < 30 && 
          !translatedKeywords.join(' ').includes(fullTranslation)) {
        finalQuery += ' ' + fullTranslation;
      }
    } else {
      finalQuery = fullTranslation || originalQuery;
    }
    
    console.log(`Query híbrida construida: "${finalQuery}"`);
    return finalQuery.trim();
    
  } catch (error) {
    console.error('Error en buildHybridQuery:', error);
    return originalQuery;
  }
}


/**
 * Busca imágenes con múltiples intentos y fallbacks
 */
async function searchImagesWithFallback(primaryQuery, originalQuery, lang) {
  try {
    console.log(`Buscando imágenes para: "${primaryQuery}"`);
    
    // Intento 1: Query principal
    let images = await searchPixabayImages(primaryQuery);
    
    if (images.length > 0 && !areImagesPlaceholders(images)) {
      console.log(`✓ Imágenes encontradas con query principal`);
      return images;
    }
    
    // Intento 2: Si es español, probar con traducción más simple
    if (lang === 'es' && originalQuery !== primaryQuery) {
      console.log(`Probando con traducción simple...`);
      try {
        const simpleTranslation = await translate(originalQuery, { to: 'en' });
        const simplifiedQuery = simpleTranslation.text
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .split(' ')
          .slice(0, 2)
          .join(' ');
        
        images = await searchPixabayImages(simplifiedQuery);
        if (images.length > 0 && !areImagesPlaceholders(images)) {
          console.log(`✓ Imágenes encontradas con traducción simple: "${simplifiedQuery}"`);
          return images;
        }
      } catch (e) {
        console.log('Error en traducción simple:', e.message);
      }
    }
    
    // Intento 3: Query más genérica (primera palabra clave)
    const firstWord = primaryQuery.split(' ')[0];
    if (firstWord && firstWord !== primaryQuery) {
      console.log(`Probando con primera palabra: "${firstWord}"`);
      images = await searchPixabayImages(firstWord);
      if (images.length > 0 && !areImagesPlaceholders(images)) {
        console.log(`✓ Imágenes encontradas con primera palabra`);
        return images;
      }
    }
    
    // Último recurso: placeholder personalizado
    console.log(`No se encontraron imágenes relevantes, usando placeholder`);
    return createCustomPlaceholder(originalQuery);
    
  } catch (error) {
    console.error('Error en searchImagesWithFallback:', error);
    return createCustomPlaceholder(originalQuery);
  }
}

/**
 * Busca imágenes en Pixabay con configuración optimizada
 */
async function searchPixabayImages(query) {
  try {
    const response = await axios.get('https://pixabay.com/api/', {
      params: {
        key: PIXABAY_API_KEY,
        q: query,
        per_page: 8, // Buscar más para filtrar mejor
        image_type: 'photo',
        safesearch: true,
        lang: 'en',
        min_width: 300,
        min_height: 200,
        category: 'backgrounds,fashion,nature,places,animals,industry,computer,food,sports,transportation,travel,buildings,business,music'
      },
      timeout: 10000
    });
    
    const hits = response.data.hits || [];
    
    if (hits.length === 0) {
      return [];
    }
    
    // Filtrar y seleccionar las mejores imágenes
    const filteredHits = hits
      .filter(hit => hit.previewURL && hit.largeImageURL)
      .slice(0, 5); // Solo las primeras 5
    
    return filteredHits.map(hit => ({
      id: hit.id,
      previewURL: hit.previewURL,
      fullURL: hit.largeImageURL || hit.webformatURL,
    }));
    
  } catch (error) {
    console.error('Error buscando en Pixabay:', error);
    return [];
  }
}

/**
 * Verifica si las imágenes son placeholders
 */
function areImagesPlaceholders(images) {
  return images.length === 1 && images[0].id === -1;
}

/**
 * Crea placeholder personalizado más atractivo
 */
function createCustomPlaceholder(query) {
  const encodedQuery = encodeURIComponent(query);
  return [
    {
      id: -1,
      previewURL: `https://via.placeholder.com/300x200/4a90e2/ffffff?text=${encodedQuery}`,
      fullURL: `https://via.placeholder.com/600x400/4a90e2/ffffff?text=${encodedQuery}`,
    },
  ];
}

/**
 * Endpoint para buscar datos de una palabra y obtener IPA, definición y ejemplo multi-fuente.
 */
console.log('Defining routes...');
app.get("/search", async (req, res) => {
  console.log('=== INICIO DE BÚSQUEDA ===');
  
  const rawWord = (req.query.word || "").trim();
  const lang = (req.query.lang || "en").trim().toLowerCase();
  
  console.log(`Parámetros recibidos: word="${rawWord}", lang="${lang}"`);

  // Validaciones básicas
  if (!rawWord) {
    return res.status(400).json({ error: "Falta el parámetro 'word'" });
  }
  
  if (!["en", "es"].includes(lang)) {
    return res.status(400).json({ 
      error: `Idioma '${lang}' no soportado. Solo se admiten 'en' (inglés) y 'es' (español).` 
    });
  }

  // Validación específica del idioma
  const validation = validateWordForLanguage(rawWord, lang);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  try {
    console.log(`Procesando búsqueda para "${rawWord}" en idioma "${lang}"`);

    // INGLÉS - Sin cambios
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

      // Obtener ejemplo de múltiples fuentes (como antes)
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

    // ESPAÑOL - Mejorado
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

      // Para ejemplos en español, usar Tatoeba específicamente
      let exampleEs = "Ejemplo no encontrado";
      try {
        console.log('Buscando ejemplo en español...');
        exampleEs = await getExampleSpanishImproved(rawWord);
      } catch (error) {
        console.error('Error obteniendo ejemplo en español:', error.message);
      }

      console.log('=== BÚSQUEDA COMPLETADA (ES) ===');
      return res.json({
        word: rawWord.toLowerCase(),
        ipa: dataEs.ipa || "",
        meaning: dataEs.meaning || "",
        example: exampleEs,
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

// ======= Preview endpoint: Retorna 5 imagenes con su URL's =======
app.get('/search-image', async (req, res) => {
  let query = (req.query.query || '').trim();   
  const lang = (req.query.lang || 'en').trim().toLowerCase();

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  if (!['en', 'es'].includes(lang)) {
    return res
      .status(400)
      .json({ error: `Idioma '${lang}' no soportado.` });
  }

  try {
    let finalQuery = '';
    
    if (lang === 'es') {
      finalQuery = await buildSmartSpanishQuery(query);
    } else {
      const extractorConfig = {
        language: 'english',
        remove_digits: true,
        return_changed_case: true,
        remove_duplicates: true,
      };
      const allKeywords = keywordExtractor.extract(query, extractorConfig);
      finalQuery = allKeywords.slice(0, 4).join(' ');
    }

    console.log('[search-image] Query final para Pixabay:', finalQuery);

    // Llamar a Pixabay con múltiples intentos si no hay buenos resultados
    let images = await searchImagesWithFallback(finalQuery, query, lang);

    return res.json({ images });
  } catch (error) {
    console.error('Error en /search-image:', error);
    return res.status(500).json({ error: 'Internal error fetching images' });
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

// CORS preflight for Anki proxy
app.options('/anki-proxy', cors(corsOptions));

console.log('Attempting to listen on the port...');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});