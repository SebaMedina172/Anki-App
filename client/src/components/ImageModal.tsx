"use client"

import type React from "react"
import { Box, Typography } from "@mui/material"
import type { Label, ImageSuggestion } from "../types"
import { useTranslation } from "../hooks/useTranslation"

interface ImageModalProps {
  isOpen: boolean
  currentLabel: Label | null
  selectedLanguage: string
  onClose: () => void
  onImageSelect: (image: ImageSuggestion) => void
}

/**
 * Modal para seleccionar imágenes para una etiqueta específica
 * Muestra sugerencias de imágenes y permite subir una imagen personalizada
 */
export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  currentLabel,
  selectedLanguage,
  onClose,
  onImageSelect,
}) => {
  const { t } = useTranslation(selectedLanguage)

  if (!isOpen || !currentLabel) return null

  /**
   * Maneja la subida de una imagen personalizada
   * @param file - Archivo de imagen seleccionado
   */
  const handleCustomImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const imageObj: ImageSuggestion = { previewURL: dataUrl, fullURL: dataUrl }
      onImageSelect(imageObj)
    }
    reader.readAsDataURL(file)
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1500,
      }}
      onClick={onClose}
    >
      <Box
        sx={(theme) => ({
          backgroundColor: theme.palette.mode === "dark" ? "#424242" : "white",
          padding: 2,
          borderRadius: 2,
          width: "90%",
          maxWidth: 600,
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {t("selectImageFor")} "{currentLabel.text}"
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
          }}
        >
          {/* Sugerencias de imágenes */}
          {currentLabel.imageSuggestions && currentLabel.imageSuggestions.length > 0 ? (
            currentLabel.imageSuggestions.map((img, index) => (
              <Box key={index} sx={{ cursor: "pointer" }} onClick={() => onImageSelect(img)}>
                <img
                  src={img.previewURL || "/placeholder.svg"}
                  alt={`suggestion-${index}`}
                  style={{
                    width: "100%",
                    borderRadius: "4px",
                    border: currentLabel.selectedImage?.previewURL === img.previewURL ? "2px solid blue" : "none",
                  }}
                />
              </Box>
            ))
          ) : (
            <Typography variant="body2">{t("noImagesFoundModal")}</Typography>
          )}

          {/* Opción para subir imagen personalizada */}
          <Box
            sx={{
              cursor: "pointer",
              border: "2px dashed gray",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 100,
            }}
          >
            <label style={{ cursor: "pointer", textAlign: "center" }}>
              {t("uploadImage")}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleCustomImageUpload(file)
                  }
                }}
              />
            </label>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
