"use client"

import type React from "react"
import { Box, Typography, TextField, Button, Stack } from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import { useTranslation } from "../hooks/useTranslation"

interface SearchSectionProps {
  searchWord: string
  searchError: boolean
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSearch: () => void
  selectedLanguage: string
}

/**
 * Componente para la sección de búsqueda de palabras
 * Permite al usuario introducir una palabra y buscarla en el diccionario
 */
export const SearchSection: React.FC<SearchSectionProps> = ({
  searchWord,
  searchError,
  onSearchChange,
  onSearch,
  selectedLanguage,
}) => {
  const { t } = useTranslation(selectedLanguage)

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" gutterBottom>
        {t("searchWord")}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label={t("word")}
          variant="standard"
          value={searchWord}
          onChange={onSearchChange}
          error={searchError}
          helperText={searchError ? t("mustEnterWord") : ""}
          fullWidth
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<SearchIcon />}
          onClick={onSearch}
          sx={{
            height: "100%",
            minWidth: {
              xs: "120px",
              sm: "150px",
              md: "auto",
            },
            paddingX: 2,
          }}
        >
          {t("search")}
        </Button>
      </Stack>
    </Box>
  )
}
