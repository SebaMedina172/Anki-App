"use client"

import type React from "react"

import { useState } from "react"
import type { Label, ImageSuggestion } from "../types"
import { extractKeywords, getApiUrl } from "../utils"

/**
 * Hook personalizado para manejar la búsqueda de imágenes
 */
export const useImageSearch = () => {
  const [openImageModalLabelId, setOpenImageModalLabelId] = useState<number | null>(null)

  /**
   * Busca imágenes para una etiqueta específica usando el backend
   * @param labelId - ID de la etiqueta
   * @param word - Palabra a buscar
   * @param example - Ejemplo de uso
   * @param meaning - Significado de la palabra
   * @param lang - Idioma para filtrar keywords
   * @param page - Página de resultados
   * @param setLabels - Función para actualizar el estado de labels
   */
  const fetchImageSuggestionsForLabel = async (
    labelId: number,
    word: string,
    example: string,
    meaning: string,
    lang = "en",
    page = 1,
    setLabels: React.Dispatch<React.SetStateAction<Label[]>>,
  ) => {
    try {
      const apiUrl = getApiUrl()
      console.log("[useImageSearch] 🌐 apiUrl =", apiUrl);

      // Determina el texto base para la búsqueda
      const baseText = example.toLowerCase().includes("example not found")
        ? extractKeywords(meaning, lang)
        : extractKeywords(example, lang)
      const query = `${word} ${baseText}`.trim()

      // Helper para realizar peticiones al backend
      const doFetch = async (q: string) => {
        const randomParam = Math.random().toString(36).substring(2, 8)
        const url = `${apiUrl}/search-image?query=${encodeURIComponent(q)}&page=${page}&r=${randomParam}`
        console.log("[useImageSearch] 👉 URL de fetch:", url);
        const resp = await fetch(url)
        return resp.json()
      }

      // Intento principal de búsqueda
      let data = await doFetch(query)

      // Fallback a búsqueda de iconos
      if (data.error || !data.images?.length) {
        data = await doFetch(`${word} icon`)
      }

      // Fallback a búsqueda de ilustraciones
      if (data.error || !data.images?.length) {
        data = await doFetch(`${word} illustration`)
      }

      // Fallback a placeholder si no se encuentran imágenes
      if (data.error || !data.images?.length) {
        data = {
          images: [
            {
              previewURL: `https://via.placeholder.com/300x200?text=${encodeURIComponent(word)}`,
              fullURL: `https://via.placeholder.com/300x200?text=${encodeURIComponent(word)}`,
            },
          ],
        }
      }

      const suggestions: ImageSuggestion[] = data.images

      // Actualiza el estado con las sugerencias de imágenes
      setLabels((prev) =>
        prev.map((lbl) =>
          lbl.id === labelId
            ? {
                ...lbl,
                imageSuggestions: suggestions,
                selectedImage: suggestions[0] || null,
              }
            : lbl,
        ),
      )
    } catch (e) {
      console.error("Error fetching images:", e)
      setLabels((prev) =>
        prev.map((lbl) => (lbl.id === labelId ? { ...lbl, imageSuggestions: [], selectedImage: null } : lbl)),
      )
    }
  }

  return {
    openImageModalLabelId,
    setOpenImageModalLabelId,
    fetchImageSuggestionsForLabel,
  }
}
