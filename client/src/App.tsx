"use client"
import { useState, useEffect } from "react"
import {
  Container,
  Box,
  Snackbar,
  Alert,
  IconButton,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Typography,
} from "@mui/material"
import Brightness4Icon from "@mui/icons-material/Brightness4"
import Brightness7Icon from "@mui/icons-material/Brightness7"
import { GlobalStyles } from "@mui/material"

// Importaciones de componentes
import HelpGuide from "./components/HelpGuide"
import { ConfigurationSection } from "./components/ConfigurationSection"
import { SearchSection } from "./components/SearchSection"
import { LabelsSection } from "./components/LabelsSection"
import { ImageModal } from "./components/ImageModal"

// Importaciones de hooks personalizados
import { useAnkiConnect } from "./hooks/useAnkiConnect"
import { useImageSearch } from "./hooks/useImageSearch"
import { useWordSearch } from "./hooks/useWordSearch"
import { useTranslation } from "./hooks/useTranslation"

// Importaciones de tipos y utilidades
import type { Label, SnackbarState, ImageSuggestion } from "./types"
import { getTTSUrl, loadConfigFromStorage, saveConfigToStorage, isBrowser, getApiUrl } from "./utils"
;<GlobalStyles
  styles={{
    body: {
      transition: "background-color 0.3s ease, color 0.3s ease",
    },
  }}
/>

/**
 * Componente principal de la aplicación Anki Card Generator
 * Gestiona el estado global y coordina todos los componentes
 */
function App() {
  // Estados de configuración inicializados con valores por defecto
  const [deck, setDeck] = useState("")
  const [model, setModel] = useState("")
  const [ankiConnectUrl, setAnkiConnectUrl] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("en")

  // Estados principales de la aplicación
  const [labels, setLabels] = useState<Label[]>([])
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: "", severity: "success" })
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingLabelId, setProcessingLabelId] = useState<number | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  // Hooks personalizados
  const { availableDecks, availableModels, isFetchingOptions, ankiConnectError, fetchDecksAndModels } =
    useAnkiConnect(selectedLanguage)
  const { openImageModalLabelId, setOpenImageModalLabelId, fetchImageSuggestionsForLabel } = useImageSearch()
  const { searchWord, searchError, loadingMessage, handleSearchChange, handleSearch } = useWordSearch(selectedLanguage)
  const { t } = useTranslation(selectedLanguage)

  // Cargar configuración desde localStorage solo en el cliente
  useEffect(() => {
    if (isBrowser) {
      const config = loadConfigFromStorage()
      setDeck(config.deck)
      setModel(config.model)
      setAnkiConnectUrl(config.ankiConnectUrl)
      setSelectedLanguage(config.selectedLanguage)
    }
  }, [])

  // Configuración del tema
  const theme = createTheme({
    palette: {
      mode: darkMode ? "dark" : "light",
      background: {
        default: darkMode ? "#212121" : "#f7f7f7",
        paper: darkMode ? "#424242" : "#dbdbdb",
      },
      primary: {
        main: "#1976d2",
      },
    },
  })

  // Efecto para cargar decks y modelos al cambiar la URL de AnkiConnect
  useEffect(() => {
    if (ankiConnectUrl) {
      fetchDecksAndModels(ankiConnectUrl)
    }
  }, [ankiConnectUrl])

  /**
   * Guarda la configuración en localStorage y actualiza decks/modelos
   */
  const handleSaveSettings = () => {
    saveConfigToStorage({ deck, model, ankiConnectUrl, selectedLanguage })
    setSnackbar({ open: true, message: t("configurationSaved"), severity: "success" })
    if (ankiConnectUrl) {
      fetchDecksAndModels(ankiConnectUrl)
    }
  }

  /**
   * Procesa y envía una tarjeta a Anki
   * @param label - Etiqueta a procesar
   */
  const handleApprove = async (label: Label) => {
    setIsProcessing(true)
    setProcessingLabelId(label.id)

    try {
      const apiUrl = getApiUrl()

      // Guardar imagen si está seleccionada
      let filename: string | null = null
      if (label.selectedImage) {
        const resp = await fetch(`${apiUrl}/save-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: label.selectedImage.fullURL }),
        })
        const json = await resp.json()
        if (json.error) throw new Error(json.error)
        filename = json.filename
      }

      // Almacenar imagen en Anki si existe
      if (filename) {
        await fetch(ankiConnectUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anki-url": ankiConnectUrl,
          },
          body: JSON.stringify({
            action: "storeMediaFile",
            version: 6,
            params: {
              filename,
              url: `${apiUrl}/media/${filename}`,
            },
          }),
        })
      }

      // Preparar campos de la nota
      const fields: any = {
        Word: label.text.toLowerCase(),
        IPA: label.ipa.trim(),
        Meaning: label.meaning.trim(),
        Example: label.example.trim(),
        Image: filename ? `<img src="${filename}">` : "",
      }

      // Preparar archivos de audio
      const audio = [
        {
          url: getTTSUrl(label.text, selectedLanguage),
          filename: `${label.text.toLowerCase()}_word.mp3`,
          fields: ["Sound"],
        },
        {
          url: getTTSUrl(label.meaning, selectedLanguage),
          filename: `${label.text.toLowerCase()}_meaning.mp3`,
          fields: ["Sound_Meaning"],
        },
        {
          url: getTTSUrl(label.example, selectedLanguage),
          filename: `${label.text.toLowerCase()}_example.mp3`,
          fields: ["Sound_Example"],
        },
      ]

      // Crear nota en Anki
      const note: any = {
        deckName: deck,
        modelName: model,
        fields,
        options: { allowDuplicate: false },
        audio,
      }

      const addResp = await fetch(ankiConnectUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anki-url": ankiConnectUrl,
        },
        body: JSON.stringify({
          action: "addNote",
          version: 6,
          params: { note },
        }),
      })
      const addJson = await addResp.json()
      if (addJson.error) throw new Error(addJson.error)

      setSnackbar({ open: true, message: t("cardCreatedSuccessfully"), severity: "success" })
      setLabels((prev) => prev.filter((l) => l.id !== label.id))
    } catch (err: any) {
      console.error("Error al aprobar la tarjeta:", err)
      setSnackbar({ open: true, message: `${t("error")}: ${err.message}`, severity: "error" })
    } finally {
      setIsProcessing(false)
      setProcessingLabelId(null)
    }
  }

  /**
   * Alterna el modo de edición de una etiqueta
   * @param id - ID de la etiqueta
   */
  const toggleEditLabel = (id: number) => {
    setLabels((prev) =>
      prev.map((label) => {
        if (label.id === id) {
          const newEditingState = !label.isEditing
          // Si se termina de editar, buscar nuevas imágenes
          if (label.isEditing && !newEditingState) {
            fetchImageSuggestionsForLabel(label.id, label.text, label.example, label.meaning, "en", 1, setLabels)
          }
          return { ...label, isEditing: newEditingState }
        }
        return label
      }),
    )
  }

  /**
   * Actualiza un campo específico de una etiqueta
   * @param id - ID de la etiqueta
   * @param field - Campo a actualizar
   * @param value - Nuevo valor
   */
  const updateLabelField = (id: number, field: keyof Omit<Label, "id" | "text" | "isEditing">, value: string) => {
    setLabels((prev) => prev.map((label) => (label.id === id ? { ...label, [field]: value } : label)))
  }

  /**
   * Elimina una etiqueta de la cola
   * @param labelId - ID de la etiqueta a eliminar
   */
  const handleRejectLabel = (labelId: number) => {
    setLabels((prev) => prev.filter((l) => l.id !== labelId))
  }

  /**
   * Maneja la selección de una imagen en el modal
   * @param image - Imagen seleccionada
   */
  const handleImageSelect = (image: ImageSuggestion) => {
    if (openImageModalLabelId) {
      setLabels((prev) => prev.map((l) => (l.id === openImageModalLabelId ? { ...l, selectedImage: image } : l)))
      setOpenImageModalLabelId(null)
    }
  }

  // Buscar etiqueta actual para el modal de imágenes
  const currentLabel = labels.find((l) => l.id === openImageModalLabelId) || null

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Componente de ayuda fijo */}
      <HelpGuide selectedLanguage={selectedLanguage} />

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          minHeight: 451,
          transition: "all 0.5s ease-in-out",
          flexDirection: {
            xs: "column",
            sm: "row",
          },
          padding: {
            xs: 2,
            sm: 3,
          },
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "stretch",
            padding: {
              xs: 2,
              sm: 3,
            },
            boxSizing: "border-box",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Botón para alternar modo oscuro */}
          <IconButton
            onClick={() => setDarkMode(!darkMode)}
            sx={{
              position: "fixed",
              bottom: 16,
              right: 16,
              zIndex: 1300,
              width: (theme) => theme.spacing(8),
              height: (theme) => theme.spacing(8),
            }}
          >
            {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          <Typography variant="h2" gutterBottom>
            {t("appTitle")}
          </Typography>

          {/* Sección de configuración */}
          <ConfigurationSection
            deck={deck}
            setDeck={setDeck}
            model={model}
            setModel={setModel}
            ankiConnectUrl={ankiConnectUrl}
            setAnkiConnectUrl={setAnkiConnectUrl}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            availableDecks={availableDecks}
            availableModels={availableModels}
            isFetchingOptions={isFetchingOptions}
            ankiConnectError={ankiConnectError}
            onSaveSettings={handleSaveSettings}
          />

          {/* Sección de búsqueda */}
          <SearchSection
            searchWord={searchWord}
            searchError={searchError}
            selectedLanguage={selectedLanguage}
            onSearchChange={handleSearchChange}
            onSearch={() => handleSearch(labels, setLabels, setSnackbar, fetchImageSuggestionsForLabel)}
          />

          {/* Sección de etiquetas */}
          <LabelsSection
            labels={labels}
            isProcessing={isProcessing}
            processingLabelId={processingLabelId}
            loadingMessage={loadingMessage}
            selectedLanguage={selectedLanguage}
            onApprove={handleApprove}
            onReject={handleRejectLabel}
            onEdit={toggleEditLabel}
            onFieldUpdate={updateLabelField}
            onImageClick={setOpenImageModalLabelId}
          />
        </Container>

        {/* Modal de selección de imágenes */}
        <ImageModal
          isOpen={!!openImageModalLabelId}
          currentLabel={currentLabel}
          selectedLanguage={selectedLanguage}
          onClose={() => setOpenImageModalLabelId(null)}
          onImageSelect={handleImageSelect}
        />

        {/* Snackbar para notificaciones */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  )
}

export default App
