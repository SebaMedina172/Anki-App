"use client"

import type React from "react"
import {
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import { useTranslation } from "../hooks/useTranslation"

interface ConfigurationSectionProps {
  deck: string
  setDeck: (deck: string) => void
  model: string
  setModel: (model: string) => void
  ankiConnectUrl: string
  setAnkiConnectUrl: (url: string) => void
  selectedLanguage: string
  setSelectedLanguage: (language: string) => void
  availableDecks: string[]
  availableModels: string[]
  isFetchingOptions: boolean
  ankiConnectError: string | null
  onSaveSettings: () => void
}

/**
 * Componente para la sección de configuración de la aplicación
 * Permite configurar deck, modelo, URL de AnkiConnect e idioma
 */
export const ConfigurationSection: React.FC<ConfigurationSectionProps> = ({
  deck,
  setDeck,
  model,
  setModel,
  ankiConnectUrl,
  setAnkiConnectUrl,
  selectedLanguage,
  setSelectedLanguage,
  availableDecks,
  availableModels,
  isFetchingOptions,
  ankiConnectError,
  onSaveSettings,
}) => {
  const { t } = useTranslation(selectedLanguage)

  return (
    <Box sx={{ mb: 4, width: "100%" }}>
      <Typography variant="h5" gutterBottom>
        {t("configuration")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "repeat(3, 1fr)",
          },
        }}
      >
        {/* Campo Deck */}
        <Box>
          <Autocomplete
            options={availableDecks}
            value={deck}
            onChange={(_, newValue) => {
              if (newValue) setDeck(newValue)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("deck")}
                variant="standard"
                helperText={
                  !ankiConnectUrl || ankiConnectError ? ankiConnectError || t("configureAnkiConnectFirst") : ""
                }
              />
            )}
            disabled={!ankiConnectUrl || isFetchingOptions || Boolean(ankiConnectError)}
            fullWidth
          />
        </Box>

        {/* Campo Model */}
        <Box>
          <Autocomplete
            options={availableModels}
            value={model}
            onChange={(_, newValue) => {
              if (newValue) setModel(newValue)
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("model")}
                variant="standard"
                helperText={
                  !ankiConnectUrl || ankiConnectError ? ankiConnectError || t("configureAnkiConnectFirst") : ""
                }
              />
            )}
            disabled={!ankiConnectUrl || isFetchingOptions || Boolean(ankiConnectError)}
            fullWidth
          />
        </Box>

        {/* Campo Idioma */}
        <Box>
          <FormControl fullWidth variant="standard">
            <InputLabel id="language-select-label">{t("language")}</InputLabel>
            <Select
              labelId="language-select-label"
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              label={t("language")}
            >
              <MenuItem value="en">{t("languages.english")}</MenuItem>
              <MenuItem value="es">{t("languages.spanish")}</MenuItem>
              
              {/*Falta logica para estos lenguajes  */}
              {/* <MenuItem value="de">{t("languages.german")}</MenuItem> */}
              {/* <MenuItem value="ja">{t("languages.japanese")}</MenuItem> */}
              {/* <MenuItem value="zh">{t("languages.chinese")}</MenuItem> */}
            </Select>
          </FormControl>
        </Box>

        {/* Campo Anki Connect URL */}
        <Box sx={{ gridColumn: { xs: "1fr", sm: "span 2", md: "span 2" } }}>
          <TextField
            label={t("ankiConnectUrl")}
            variant="standard"
            value={ankiConnectUrl}
            onChange={(e) => setAnkiConnectUrl(e.target.value)}
            fullWidth
          />
        </Box>

        {/* Botón Save Settings */}
        <Box
          sx={{
            gridColumn: { xs: "1fr", sm: "span 2", md: "span 1" },
            display: "flex",
            alignItems: "center",
          }}
        >
          <Button
            variant="contained"
            fullWidth
            startIcon={<SettingsIcon />}
            onClick={onSaveSettings}
            sx={{
              height: "100%",
              paddingY: 1.5,
              paddingX: 2,
            }}
          >
            {isFetchingOptions ? <CircularProgress size={20} /> : t("saveSettings")}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
