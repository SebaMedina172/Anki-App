"use client"

import { translations, type Language } from "../constants/translations"

/**
 * Hook personalizado para manejar las traducciones
 * @param language - Idioma actual seleccionado
 */
export const useTranslation = (language: string) => {
  // Asegurar que el idioma sea válido, fallback a inglés
  const validLanguage = (language in translations ? language : "en") as Language

  /**
   * Función para obtener una traducción
   * @param key - Clave de la traducción
   * @param fallback - Texto de fallback si no se encuentra la traducción
   */
  const t = (key: string, fallback?: string): string => {
    const keys = key.split(".")
    let value: any = translations[validLanguage]

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        // Si no se encuentra la clave, usar inglés como fallback
        let englishValue: any = translations.en
        for (const k of keys) {
          if (englishValue && typeof englishValue === "object" && k in englishValue) {
            englishValue = englishValue[k]
          } else {
            return fallback || key
          }
        }
        return englishValue || fallback || key
      }
    }

    return typeof value === "string" ? value : fallback || key
  }

  return { t, language: validLanguage }
}
