"use client"

import type React from "react"

import { useState } from "react"
import type { Label, SnackbarState } from "../types"
import { getApiUrl } from "../utils"
import { useTranslation } from "./useTranslation"

/**
 * Hook personalizado para manejar la búsqueda de palabras
 */
export const useWordSearch = (selectedLanguage: string) => {
  const [searchWord, setSearchWord] = useState("")
  const [searchError, setSearchError] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState("")
  const { t } = useTranslation(selectedLanguage)

  /**
   * Maneja el cambio en el campo de búsqueda
   * @param event - Evento del input
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchWord(event.target.value)
    setSearchError(false)
  }

  /**
   * Busca una palabra en el backend y crea una nueva etiqueta
   * @param labels - Lista actual de etiquetas
   * @param setLabels - Función para actualizar las etiquetas
   * @param setSnackbar - Función para mostrar notificaciones
   * @param fetchImageSuggestionsForLabel - Función para buscar imágenes
   */
  const handleSearch = async (
    labels: Label[],
    setLabels: React.Dispatch<React.SetStateAction<Label[]>>,
    setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>,
    fetchImageSuggestionsForLabel: (
      labelId: number,
      word: string,
      example: string,
      meaning: string,
      lang?: string,
      page?: number,
      setLabels?: React.Dispatch<React.SetStateAction<Label[]>>,
    ) => Promise<void>,
  ) => {
    if (!searchWord.trim()) {
      setSearchError(true)
      return
    }

    setSearchError(false)
    setLoadingMessage(t("searchingTexts"))

    try {
      const apiUrl = getApiUrl()
      console.log("[useWordSearch] 🌐 apiUrl =", apiUrl);

      const response = await fetch(`${apiUrl}/search?word=${encodeURIComponent(searchWord)}&lang=${selectedLanguage}`)
      const data = await response.json()

      if (data.error) {
        setLoadingMessage("")
        setSnackbar({ open: true, message: data.error, severity: "error" })
        return
      }

      // Verifica si la palabra ya existe (ignorando mayúsculas)
      const exists = labels.some((label) => label.text.toLowerCase() === data.word.toLowerCase())
      if (exists) {
        setLoadingMessage("")
        setSnackbar({ open: true, message: t("wordAlreadyInQueue"), severity: "error" })
        return
      }

      // Crear nueva etiqueta
      const newLabel: Label = {
        id: Date.now(),
        text: data.word,
        ipa: data.ipa,
        meaning: data.meaning,
        example: data.example,
        isEditing: false,
        imageSuggestions: [],
        selectedImage: null,
      }

      // Agregar la etiqueta al estado
      setLabels((prev) => [newLabel, ...prev])

      // Buscar imágenes para la nueva etiqueta
      await fetchImageSuggestionsForLabel(
        newLabel.id,
        newLabel.text,
        newLabel.example,
        newLabel.meaning,
        "en",
        1,
        setLabels,
      )

      setLoadingMessage("")
    } catch (error) {
      console.error("Error al buscar la palabra:", error)
      setLoadingMessage("")
      const errMsg = error instanceof Error ? error.message : String(error)
      setSnackbar({ open: true, message: `${t("errorSearchingWord")}: ${errMsg}`, severity: "error" })
    }
  }

  return {
    searchWord,
    searchError,
    loadingMessage,
    handleSearchChange,
    handleSearch,
  }
}
