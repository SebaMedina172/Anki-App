import { stopword } from "../constants/stopwords"

/**
 * Obtiene la URL de la API desde las variables de entorno
 * Soporta tanto Vite como Next.js
 */
export const getApiUrl = (): string => {
  // Para Next.js (producción y desarrollo)
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  // Para Vite (desarrollo local)
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // Fallback para desarrollo local
  return "http://localhost:3001"
}

/**
 * Genera la URL para el servicio de Text-to-Speech de Google
 * @param text - Texto a convertir a audio
 * @param lang - Código del idioma (por defecto 'en')
 * @returns URL del servicio TTS
 */
export const getTTSUrl = (text: string, lang = "en"): string => {
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`
}

/**
 * Extrae palabras clave de un texto removiendo stopwords
 * @param text - Texto del cual extraer keywords
 * @param lang - Idioma para seleccionar stopwords apropiados
 * @returns String con las palabras clave separadas por espacios
 */
export const extractKeywords = (text: string, lang = "en"): string => {
  // Divide el texto en palabras
  const words = text.split(" ")
  // Obtiene la lista de stopwords para el idioma solicitado
  const stopwords = stopword[lang as keyof typeof stopword] || stopword.eng
  // Filtra y retorna un string con las palabras clave
  return stopword.removeStopwords(words, stopwords).join(" ")
}

/**
 * Verifica si el código se está ejecutando en el navegador
 */
export const isBrowser = typeof window !== "undefined"

/**
 * Carga configuración desde localStorage de forma segura
 * @returns Objeto con la configuración de la aplicación
 */
export const loadConfigFromStorage = () => {
  if (!isBrowser) {
    return {
      deck: "",
      model: "",
      ankiConnectUrl: "",
      selectedLanguage: "en",
    }
  }

  return {
    deck: localStorage.getItem("deck") || "",
    model: localStorage.getItem("model") || "",
    ankiConnectUrl: localStorage.getItem("ankiConnectUrl") || "",
    selectedLanguage: localStorage.getItem("selectedLanguage") || "en",
  }
}

/**
 * Guarda configuración en localStorage de forma segura
 * @param config - Configuración a guardar
 */
export const saveConfigToStorage = (config: {
  deck: string
  model: string
  ankiConnectUrl: string
  selectedLanguage: string
}) => {
  if (!isBrowser) return

  localStorage.setItem("deck", config.deck)
  localStorage.setItem("model", config.model)
  localStorage.setItem("ankiConnectUrl", config.ankiConnectUrl)
  localStorage.setItem("selectedLanguage", config.selectedLanguage)
}
