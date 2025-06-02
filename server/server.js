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
 * API alternativa para ejemplos en español - usando Tatoeba
 */
async function getExampleSpanish(word) {
  try {
    console.log(`Buscando ejemplo en español para: ${word}`);
    
    // Usar Tatoeba para español
    const url = `https://tatoeba.org/en/sentences/search?query=${encodeURIComponent(word)}&from=spa&to=spa`;
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    
    const sentences = await page.$$eval('div.sentence div.text', elements =>
      elements.map(el => el.textContent.trim())
    );
    
    await browser.close();
    
    // Buscar una oración que contenga la palabra y sea de buena longitud
    for (let sentence of sentences) {
      if (sentence.toLowerCase().includes(word.toLowerCase()) && 
          sentence.split(' ').length >= 4 && 
          sentence.split(' ').length <= 20) {
        console.log(`Ejemplo encontrado: ${sentence}`);
        return sentence;
      }
    }
    
  } catch (error) {
    console.error("Error obteniendo ejemplo en español:", error.message);
  }
  
  return "Ejemplo no encontrado";
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
        exampleEs = await getExampleSpanish(rawWord);
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