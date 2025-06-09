/**
 * Interfaz para las sugerencias de imágenes
 */
export interface ImageSuggestion {
  previewURL: string
  fullURL: string
}

/**
 * Interfaz para las etiquetas/labels de palabras
 */
export interface Label {
  id: number
  text: string
  ipa: string
  meaning: string
  example: string
  isEditing: boolean
  imageSuggestions: ImageSuggestion[]
  selectedImage: ImageSuggestion | null
  refreshPage?: number
}

/**
 * Interfaz para el estado del snackbar
 */
export interface SnackbarState {
  open: boolean
  message: string
  severity: "success" | "error"
}

/**
 * Interfaz para la configuración de la aplicación
 */
export interface AppConfig {
  deck: string
  model: string
  ankiConnectUrl: string
  selectedLanguage: string
}
