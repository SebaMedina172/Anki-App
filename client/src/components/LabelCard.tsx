"use client"

import type React from "react"
import { Box, Typography, TextField, Button, Stack } from "@mui/material"
import type { Label } from "../types"
import { useTranslation } from "../hooks/useTranslation"

interface LabelCardProps {
  label: Label
  isProcessing: boolean
  processingLabelId: number | null
  selectedLanguage: string
  onApprove: (label: Label) => void
  onReject: (labelId: number) => void
  onEdit: (labelId: number) => void
  onFieldUpdate: (labelId: number, field: keyof Omit<Label, "id" | "text" | "isEditing">, value: string) => void
  onImageClick: (labelId: number) => void
}

/**
 * Componente para mostrar una tarjeta individual de etiqueta/palabra
 * Permite editar, aprobar, rechazar y seleccionar imágenes
 */
export const LabelCard: React.FC<LabelCardProps> = ({
  label,
  isProcessing,
  processingLabelId,
  selectedLanguage,
  onApprove,
  onReject,
  onEdit,
  onFieldUpdate,
  onImageClick,
}) => {
  const { t } = useTranslation(selectedLanguage)

  return (
    <Box
      sx={{
        mt: 2,
        backgroundColor: (theme) => (theme.palette.mode === "dark" ? "#424242" : "#f0f0f0"),
        color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "#333"),
        padding: { xs: 1, sm: 2 },
        borderRadius: 4,
        boxShadow: "-3px 5px 12px rgba(0, 0, 0, 0.5)",
        width: { xs: "100%", sm: "95%" },
        overflowWrap: "break-word",
        whiteSpace: "normal",
        transition: "all 0.3s ease-in-out",
      }}
    >
      <Typography variant="h6">
        <b>{t("wordLabel")}:</b> {label.text}
      </Typography>

      {/* Campos editables o de solo lectura */}
      {label.isEditing ? (
        <Stack spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
          <TextField
            label={t("ipa")}
            variant="outlined"
            value={label.ipa}
            onChange={(e) => onFieldUpdate(label.id, "ipa", e.target.value)}
            fullWidth
          />
          <TextField
            label={t("meaning")}
            variant="outlined"
            value={label.meaning}
            onChange={(e) => onFieldUpdate(label.id, "meaning", e.target.value)}
            fullWidth
          />
          <TextField
            label={t("example")}
            variant="outlined"
            value={label.example}
            onChange={(e) => onFieldUpdate(label.id, "example", e.target.value)}
            fullWidth
          />
        </Stack>
      ) : (
        <>
          <Typography>
            <b>{t("ipa")}:</b> {label.ipa}
          </Typography>
          <Typography>
            <b>{t("meaning")}:</b> {label.meaning}
          </Typography>
          <Typography>
            <b>{t("example")}:</b> {label.example}
          </Typography>
        </>
      )}

      {/* Vista previa de la imagen */}
      <Box onClick={() => onImageClick(label.id)} sx={{ cursor: "pointer", mt: 1 }}>
        {label.selectedImage ? (
          <img
            src={label.selectedImage.previewURL || "/placeholder.svg"}
            alt={label.text}
            style={{ maxWidth: "100%", borderRadius: "4px" }}
          />
        ) : (
          <Typography variant="body2" color="textSecondary">
            {t("noImagesFound")}
          </Typography>
        )}
      </Box>

      {/* Botones de acción */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="success"
          disabled={isProcessing || label.isEditing}
          sx={{
            transition: "all 0.3s ease-in-out",
            color: (theme) => (theme.palette.mode === "dark" ? "#333" : "#fff"),
          }}
          onClick={() => onApprove(label)}
        >
          {processingLabelId === label.id ? t("processing") : t("approve")}
        </Button>
        <Button
          variant="contained"
          color="error"
          sx={{
            transition: "all 0.3s ease-in-out",
            color: (theme) => (theme.palette.mode === "dark" ? "#333" : "#fff"),
          }}
          disabled={label.isEditing}
          onClick={() => onReject(label.id)}
        >
          {t("reject")}
        </Button>
        <Button
          variant="contained"
          color={label.isEditing ? "primary" : "warning"}
          sx={{
            transition: "all 0.3s ease-in-out",
            color: (theme) => (theme.palette.mode === "dark" ? "#333" : "#fff"),
          }}
          onClick={() => onEdit(label.id)}
        >
          {label.isEditing ? t("done") : t("edit")}
        </Button>
      </Stack>
    </Box>
  )
}
