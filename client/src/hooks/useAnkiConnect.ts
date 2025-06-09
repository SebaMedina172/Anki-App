"use client"

import { useState } from "react"
import { useTranslation } from "./useTranslation"

/**
 * Hook personalizado para manejar la conexión con AnkiConnect
 * Gestiona la obtención de decks y modelos disponibles
 */
export const useAnkiConnect = (selectedLanguage: string) => {
  const [availableDecks, setAvailableDecks] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isFetchingOptions, setIsFetchingOptions] = useState(false)
  const [ankiConnectError, setAnkiConnectError] = useState<string | null>(null)
  const { t } = useTranslation(selectedLanguage)

  /**
   * Obtiene la lista de decks y modelos disponibles desde AnkiConnect
   * @param url - URL del servidor AnkiConnect
   */
  const fetchDecksAndModels = async (url: string) => {
    setIsFetchingOptions(true)
    try {
      setAnkiConnectError(null)

      // Obtener decks disponibles
      const deckResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deckNames", version: 6 }),
      })
      const deckData = await deckResponse.json()
      if (deckData.error) throw new Error(deckData.error)
      const decks = deckData.result

      // Obtener modelos disponibles
      const modelResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "modelNames", version: 6 }),
      })
      const modelData = await modelResponse.json()
      if (modelData.error) throw new Error(modelData.error)
      const models = modelData.result

      setAvailableDecks(decks)
      setAvailableModels(models)
    } catch (error) {
      console.error("Error al obtener decks/modelos:", error)
      const errMsg = error instanceof Error ? error.message : String(error)
      setAnkiConnectError(errMsg.includes("ECONNREFUSED") ? t("ankiNotOpen") : t("ankiConnectNotResponding"))
      setAvailableDecks([])
      setAvailableModels([])
    } finally {
      setIsFetchingOptions(false)
    }
  }

  return {
    availableDecks,
    availableModels,
    isFetchingOptions,
    ankiConnectError,
    fetchDecksAndModels,
  }
}
