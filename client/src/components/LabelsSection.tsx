import type React from "react"
import { Box, Typography } from "@mui/material"
import { LabelCard } from "./LabelCard"
import type { Label } from "../types"
import { useTranslation } from "../hooks/useTranslation"

interface LabelsSectionProps {
  labels: Label[]
  isProcessing: boolean
  processingLabelId: number | null
  loadingMessage: string
  selectedLanguage: string
  onApprove: (label: Label) => void
  onReject: (labelId: number) => void
  onEdit: (labelId: number) => void
  onFieldUpdate: (labelId: number, field: keyof Omit<Label, "id" | "text" | "isEditing">, value: string) => void
  onImageClick: (labelId: number) => void
}

/**
 * Componente para mostrar la sección de cola de etiquetas/palabras
 * Renderiza todas las tarjetas de palabras pendientes de procesar
 */
export const LabelsSection: React.FC<LabelsSectionProps> = ({
  labels,
  isProcessing,
  processingLabelId,
  loadingMessage,
  selectedLanguage,
  onApprove,
  onReject,
  onEdit,
  onFieldUpdate,
  onImageClick,
}) => {
  const { t } = useTranslation(selectedLanguage)

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h5" gutterBottom>
        {t("queueLabels")}
      </Typography>

      {/* Mensaje de carga debajo de la cabecera */}
      {loadingMessage && (
        <Typography variant="body2" sx={{ color: "gray", mb: 2 }}>
          {loadingMessage}
        </Typography>
      )}

      {labels.map((label) => (
        <LabelCard
          key={label.id}
          label={label}
          isProcessing={isProcessing}
          processingLabelId={processingLabelId}
          selectedLanguage={selectedLanguage}
          onApprove={onApprove}
          onReject={onReject}
          onEdit={onEdit}
          onFieldUpdate={onFieldUpdate}
          onImageClick={onImageClick}
        />
      ))}
    </Box>
  )
}
