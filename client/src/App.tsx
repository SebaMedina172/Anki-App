import React, { useState, useEffect } from 'react';
import {
  Container,
  Stack,
  Typography,
  TextField,
  Button,
  Box,
  Snackbar,
  Alert,
  CircularProgress,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  CssBaseline,
  createTheme,
  ThemeProvider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import RefreshIcon from '@mui/icons-material/Refresh';
import { GlobalStyles } from '@mui/material';
import * as stopword from 'stopword';

<GlobalStyles styles={{
  body: {
    transition: 'background-color 0.3s ease, color 0.3s ease',
  },
  // Puedes incluir aquí otras propiedades que quieras que tengan transición global
}} />

interface Label {
  id: number;
  text: string;
  ipa: string;
  meaning: string;
  example: string;
  isEditing: boolean;
  imageSuggestions?: string[];  // URLs sugeridas para esta etiqueta
  selectedImage?: string | null; // URL de la imagen elegida para esta etiqueta
  refreshPage?: number;          // Página actual para la búsqueda de imágenes
}

function App() {
  // Estados de configuración (se cargan de localStorage si existen)
  const [deck, setDeck] = useState(localStorage.getItem('deck') || '');
  const [model, setModel] = useState(localStorage.getItem('model') || '');
  const [ankiConnectUrl, setAnkiConnectUrl] = useState(localStorage.getItem('ankiConnectUrl') || '');
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('selectedLanguage') || 'en');
  const [ankiConnectError, setAnkiConnectError] = useState<string | null>(null);

  // Nuevos estados para decks y modelos disponibles
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  const [searchWord, setSearchWord] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabelId, setProcessingLabelId] = useState<number | null>(null);

  //Estados para busqueda y seleccion de imagenes
  // const [imageSuggestions, setImageSuggestions] = useState<string[]>([]);
  // const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [openImageModalLabelId, setOpenImageModalLabelId] = useState<number | null>(null);


  const [darkMode, setDarkMode] = useState(false);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      background: {
        default: darkMode ? '#212121' : '#f7f7f7',
        paper: darkMode ? '#424242' : '#dbdbdb',
      },
      primary: {
        main: '#1976d2',
      },
    },
  });

  const getTTSUrl = (text: string, lang: string = 'en') => {
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  };
  

  // Función para obtener decks y modelos desde AnkiConnect directamente
  const fetchDecksAndModels = async (url: string) => {
    setIsFetchingOptions(true);
    try {
      // Reiniciamos el error en cada intento
      setAnkiConnectError(null);
  
      // Obtener decks desde AnkiConnect
      const deckResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deckNames', version: 6 }),
      });
      const deckData = await deckResponse.json();
      if (deckData.error) {
        throw new Error(deckData.error);
      }
      const decks = deckData.result;
  
      // Obtener modelos desde AnkiConnect
      const modelResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'modelNames', version: 6 }),
      });
      const modelData = await modelResponse.json();
      if (modelData.error) {
        throw new Error(modelData.error);
      }
      const models = modelData.result;
  
      setAvailableDecks(decks);
      setAvailableModels(models);
      setAnkiConnectError(null);
    } catch (error) {
      console.error('Error al obtener decks/modelos:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('ECONNREFUSED')) {
        setAnkiConnectError('Anki no está abierto. Por favor, abre la aplicación Anki.');
      } else {
        setAnkiConnectError('URL incorrecta o Anki Connect no responde.');
      }
      setAvailableDecks([]);
      setAvailableModels([]);
      setSnackbar({ open: true, message: `Error: ${ankiConnectError || errMsg}`, severity: 'error' });
    } finally {
      setIsFetchingOptions(false);
    }
  };

  // Al cargar la app, si ya hay URL, intenta cargar decks y modelos
  useEffect(() => {
    if (ankiConnectUrl) {
      fetchDecksAndModels(ankiConnectUrl);
    }
  }, [ankiConnectUrl]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchWord(event.target.value);
    setSearchError(false);
  };

  
  const extractKeywords = (text: string, lang: string = 'en'): string => {
    // Divide el texto en palabras
    const words = text.split(' ');
    // Obtiene la lista de stopwords para el idioma solicitado.
    // La librería stopword tiene propiedades para "en", "es", etc.
    // Si no existe para el idioma, por defecto se usa 'en'.
    const stopwords = stopword[lang as keyof typeof stopword] || stopword.eng;
    const customStopwords: string[] = stopwords as string[];
    // Filtra y retorna un string con las palabras clave.
    return stopword.removeStopwords(words, customStopwords).join(' ');
  };

  // Función para buscar imágenes para una etiqueta específica
  const fetchImageSuggestionsForLabel = async (
    labelId: number,
    word: string,
    example: string,
    meaning: string,
    lang: string = 'en',
    page: number = 1
  ) => {
    try {
      let query: string;
      let data: any;
  
      // Primer intento: Usa el ejemplo si es válido; de lo contrario, usa el significado
      const baseText = example.toLowerCase().includes("example not found")
        ? extractKeywords(meaning, lang)
        : extractKeywords(example, lang);
      query = `${word} ${baseText}`.trim();
      
      // Incluir el parámetro "page" en la URL de la solicitud
      let response = await fetch(`${import.meta.env.VITE_API_URL}/search-image?query=${encodeURIComponent(query)}&page=${page}`);
      data = await response.json();
  
      // Segundo intento: Si no hay imágenes, usa "icon"
      if (data.error || !data.images || data.images.length === 0) {
        query = `${word} icon`;
        response = await fetch(`${import.meta.env.VITE_API_URL}/search-image?query=${encodeURIComponent(query)}&page=${page}`);
        data = await response.json();
      }
  
      // Tercer intento: Si aún no hay, usa "illustration"
      if (data.error || !data.images || data.images.length === 0) {
        query = `${word} illustration`;
        response = await fetch(`${import.meta.env.VITE_API_URL}/search-image?query=${encodeURIComponent(query)}&page=${page}`);
        data = await response.json();
      }
  
      // Fallback definitivo: Si nada retorna, usar una imagen por defecto
      if (data.error || !data.images || data.images.length === 0) {
        const defaultImage = `https://via.placeholder.com/300x200?text=${encodeURIComponent(word)}`;
        data = { images: [defaultImage] };
      }
  
      // Actualiza la etiqueta correspondiente en el estado, guardando también la página usada
      setLabels(prevLabels =>
        prevLabels.map(label =>
          label.id === labelId
            ? {
                ...label,
                imageSuggestions: data.images,
                selectedImage: data.images[0],
                refreshPage: page,
              }
            : label
        )
      );
    } catch (error) {
      console.error('Error al buscar imágenes para label:', error);
      setLabels(prevLabels =>
        prevLabels.map(label =>
          label.id === labelId ? { ...label, imageSuggestions: [], selectedImage: null } : label
        )
      );
    }
  };

  const refreshImageSuggestionsForLabel = async (
    labelId: number,
    word: string,
    example: string,
    meaning: string,
    lang: string = 'en'
  ) => {
    // Buscar la etiqueta para obtener la página actual
    const label = labels.find(l => l.id === labelId);
    const currentPage = label?.refreshPage || 1;
    const newPage = currentPage + 1;
    await fetchImageSuggestionsForLabel(labelId, word, example, meaning, lang, newPage);
  };

  // Función para buscar la palabra en el backend (GET /search)
  // Se mantiene igual ya que sigue llamando al backend para búsqueda en el diccionario
  const handleSearch = async () => {
    if (!searchWord.trim()) {
      setSearchError(true);
      return;
    }
    setSearchError(false);
    setLoadingMessage('Buscando textos...');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/search?word=${encodeURIComponent(searchWord)}`);
      const data = await response.json();
      if (data.error) {
        setLoadingMessage('');
        setSnackbar({ open: true, message: data.error, severity: 'error' });
        return;
      }
      // Verifica duplicados (ignorando mayúsculas)
      const exists = labels.some(
        (label) => label.text.toLowerCase() === data.word.toLowerCase()
      );
      if (exists) {
        setLoadingMessage('');
        setSnackbar({ open: true, message: 'La palabra ya está en la cola.', severity: 'error' });
        return;
      }
      // Crear la nueva etiqueta inicializada con propiedades de imagen vacías
      const newLabel: Label = {
        id: Date.now(),
        text: data.word,
        ipa: data.ipa,
        meaning: data.meaning,
        example: data.example,
        isEditing: false,
        imageSuggestions: [],
        selectedImage: null,
      };
      // Agregar la etiqueta al estado
      setLabels((prev) => [newLabel, ...prev]);
      // Llamar a la función para buscar imágenes para esta etiqueta
      fetchImageSuggestionsForLabel(newLabel.id, newLabel.text, newLabel.example, newLabel.meaning);
      setLoadingMessage('');
    } catch (error) {
      console.error('Error al buscar la palabra:', error);
      setLoadingMessage('');
      const errMsg = error instanceof Error ? error.message : String(error);
      setSnackbar({ open: true, message: `Error al buscar la palabra: ${errMsg}`, severity: 'error' });
    }
  };

  // Función para aprobar la tarjeta y enviarla directamente a AnkiConnect (con audio)
const handleApprove = async (label: Label) => {
  setIsProcessing(true);
  setProcessingLabelId(label.id);
  try {
    // Construimos la nota incluyendo audio para cada campo.
    // Asumimos que el modelo de nota tiene campos: Word, IPA, Meaning, Example,
    // y que se usarán los campos Sound, Sound_Meaning y Sound_Example para reproducir el audio.
    const note = {
      deckName: deck,
      modelName: model,
      fields: {
        Word: label.text.toLowerCase(),
        IPA: label.ipa.trim(),
        Meaning: label.meaning.trim(),
        Example: label.example.trim(),
        Image: label.selectedImage || '',
      },
      // Incluimos audio: se le indicará a AnkiConnect que descargue los archivos desde estas URLs.
      audio: [
        {
          url: getTTSUrl(label.text, selectedLanguage),
          filename: `${label.text.toLowerCase()}_word.mp3`,
          fields: ["Sound"] 
        },
        {
          url: getTTSUrl(label.meaning, selectedLanguage),
          filename: `${label.text.toLowerCase()}_meaning.mp3`,
          fields: ["Sound_Meaning"]
        },
        {
          url: getTTSUrl(label.example, selectedLanguage),
          filename: `${label.text.toLowerCase()}_example.mp3`,
          fields: ["Sound_Example"]
        }
      ],
      options: {
        allowDuplicate: false,
      },
    };

    const payload = { action: 'addNote', version: 6, params: { note } };

    const response = await fetch(ankiConnectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    setSnackbar({ open: true, message: 'Tarjeta creada con éxito', severity: 'success' });
    setLabels((prev) => prev.filter((l) => l.id !== label.id));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error al aprobar la tarjeta:', errMsg);
    setSnackbar({ open: true, message: `Error al crear la tarjeta: ${errMsg}`, severity: 'error' });
  } finally {
    setIsProcessing(false);
    setProcessingLabelId(null);
  }
};

  // Guarda la configuración en localStorage y recupera decks/modelos si la URL es válida
  const handleSaveSettings = () => {
    localStorage.setItem('deck', deck);
    localStorage.setItem('model', model);
    localStorage.setItem('ankiConnectUrl', ankiConnectUrl);
    localStorage.setItem('selectedLanguage', selectedLanguage); // Guarda el idioma
    setSnackbar({ open: true, message: 'Configuración guardada', severity: 'success' });
    if (ankiConnectUrl) {
      fetchDecksAndModels(ankiConnectUrl);
    }
  };

  const toggleEditLabel = (id: number) => {
    setLabels((prev) =>
      prev.map((label) =>
        label.id === id ? { ...label, isEditing: !label.isEditing } : label
      )
    );
  };

  const updateLabelField = (
    id: number,
    field: keyof Omit<Label, 'id' | 'text' | 'isEditing'>,
    value: string
  ) => {
    setLabels((prev) =>
      prev.map((label) =>
        label.id === id ? { ...label, [field]: value } : label
      )
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          minHeight: 451,
          transition: 'all 0.5s ease-in-out',
          flexDirection: {
            xs: 'column',
            sm: 'row',
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
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
            padding: {
              xs: 2,
              sm: 3,
            },
            boxSizing: 'border-box',
            margin: '0 auto',
            width: "100%"
          }}
        >
          {/* Botón para alternar modo oscuro */}
          <IconButton
            onClick={() => setDarkMode(!darkMode)}
            sx={{
              position: 'fixed',
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
            Anki Card Generator
          </Typography>

          {/* Sección de configuración */}
          <Box sx={{ mb: 4, width:"100%" }}>
            <Typography variant="h5" gutterBottom>
              Configuración
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: 'repeat(3, 1fr)',
                },
              }}
            >
              {/* Campo Deck */}
              <Box>
                <Autocomplete
                  options={availableDecks}
                  value={deck}
                  onChange={(_, newValue) => {
                    if (newValue) setDeck(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Deck"
                      variant="standard"
                      helperText={
                        (!ankiConnectUrl || ankiConnectError)
                          ? ankiConnectError || 'Configura la URL de Anki Connect primero'
                          : ''
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
                    if (newValue) setModel(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Model"
                      variant="standard"
                      helperText={
                        (!ankiConnectUrl || ankiConnectError)
                          ? ankiConnectError || 'Configura la URL de Anki Connect primero'
                          : ''
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
                  <InputLabel id="language-select-label">Idioma</InputLabel>
                  <Select
                    labelId="language-select-label"
                    id="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    label="Idioma"
                  >
                    <MenuItem value="en">Inglés</MenuItem>
                    <MenuItem value="es">Español</MenuItem>
                    <MenuItem value="de">Alemán</MenuItem>
                    <MenuItem value="ja">Japonés</MenuItem>
                    <MenuItem value="zh">Chino</MenuItem>
                    {/* Agrega más idiomas si lo deseas */}
                  </Select>
                </FormControl>
              </Box>
              {/* Segunda fila: Campo Anki Connect URL */}
              <Box sx={{ gridColumn: { xs: '1fr', sm: 'span 2', md: 'span 2' } }}>
                <TextField
                  label="Anki Connect URL"
                  variant="standard"
                  value={ankiConnectUrl}
                  onChange={(e) => setAnkiConnectUrl(e.target.value)}
                  fullWidth
                />
              </Box>
              {/* Segunda fila: Botón Save Settings */}
              <Box
                sx={{
                  gridColumn: { xs: '1fr', sm: 'span 2', md: 'span 1' },
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<SettingsIcon />}
                  onClick={handleSaveSettings}
                  sx={{
                    height: '100%',
                    paddingY: 1.5,
                    paddingX: 2,
                  }}
                >
                  {isFetchingOptions ? <CircularProgress size={20} /> : 'Save Settings'}
                </Button>
              </Box>
            </Box>  
          </Box>

          {/* Sección de búsqueda */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom>
              Buscar Palabra
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Palabra"
                variant="standard"
                value={searchWord}
                onChange={handleSearchChange}
                error={searchError}
                helperText={searchError ? 'Debe introducir una palabra' : ''}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={<SearchIcon />}
                onClick={handleSearch}
                sx={{
                  height: '100%',
                  minWidth: {
                    xs: '120px',
                    sm: '150px',
                    md: 'auto',
                  },
                  paddingX: 2,
                }}
              >
                Search
              </Button>
            </Stack>
          </Box>

          {/* Sección de Labels */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" gutterBottom>
              Queue de Labels
            </Typography>

            {loadingMessage && (
              <Typography variant="body2" sx={{ color: 'gray', mb: 2 }}>
                {loadingMessage}
              </Typography>
            )}

            {labels.map((label) => (
              <Box
                key={label.id}
                sx={{
                  mt: 2,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark' ? '#424242' : '#f0f0f0',
                  color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : '#333'),
                  padding: { xs: 1, sm: 2 },
                  borderRadius: 4,
                  boxShadow: '-3px 5px 12px rgba(0, 0, 0, 0.5)',
                  width: { xs: '100%', sm: '95%' },
                  overflowWrap: 'break-word',
                  whiteSpace: 'normal',
                  transition: 'all 0.3s ease-in-out',
                }}
              >
                <Typography variant="h6">
                  <b>Word:</b> {label.text}
                </Typography>

                {label.isEditing ? (
                  <Stack spacing={2} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    <TextField
                      label="IPA"
                      variant="outlined"
                      value={label.ipa}
                      onChange={(e) =>
                        updateLabelField(label.id, 'ipa', e.target.value)
                      }
                      fullWidth
                    />
                    <TextField
                      label="Meaning"
                      variant="outlined"
                      value={label.meaning}
                      onChange={(e) =>
                        updateLabelField(label.id, 'meaning', e.target.value)
                      }
                      fullWidth
                    />
                    <TextField
                      label="Example"
                      variant="outlined"
                      value={label.example}
                      onChange={(e) =>
                        updateLabelField(label.id, 'example', e.target.value)
                      }
                      fullWidth
                    />
                  </Stack>
                ) : (
                  <>
                    <Typography>
                      <b>IPA:</b> {label.ipa}
                    </Typography>
                    <Typography>
                      <b>Meaning:</b> {label.meaning}
                    </Typography>
                    <Typography>
                      <b>Example:</b> {label.example}
                    </Typography>
                  </>
                )}

                {/* Vista previa de la imagen para esta etiqueta */}
                <Box
                  onClick={() => setOpenImageModalLabelId(label.id)}
                  sx={{ cursor: 'pointer', mt: 1 }}
                >
                  {label.selectedImage ? (
                    <img
                      src={label.selectedImage}
                      alt={label.text}
                      style={{ maxWidth: '100%', borderRadius: '4px' }}
                    />
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No se encontraron imágenes. (Click para intentar)
                    </Typography>
                  )}
                </Box>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ mt: 2, flexWrap: 'wrap' }}
                >
                  <Button
                    variant="contained"
                    color="success"
                    disabled={isProcessing || label.isEditing}
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? '#333' : '#fff',
                    }}
                    onClick={() => handleApprove(label)}
                  >
                    {processingLabelId === label.id ? 'Procesando...' : 'Aprobar'}
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? '#333' : '#fff',
                    }}
                    disabled={label.isEditing}
                    onClick={() =>
                      setLabels((prev) => prev.filter((l) => l.id !== label.id))
                    }
                  >
                    Rechazar
                  </Button>
                  <Button
                    variant="contained"
                    color={label.isEditing ? 'primary' : 'warning'}
                    sx={{
                      transition: 'all 0.3s ease-in-out',
                      color: (theme) =>
                        theme.palette.mode === 'dark' ? '#333' : '#fff',
                    }}
                    onClick={() => toggleEditLabel(label.id)}
                  >
                    {label.isEditing ? 'Hecho' : 'Editar'}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Box>

          import RefreshIcon from '@mui/icons-material/Refresh';

        {/* Modal para selección de imágenes para la etiqueta actual */}
        {openImageModalLabelId && (() => {
          const currentLabel = labels.find((l) => l.id === openImageModalLabelId);
          if (!currentLabel) return null;
          return (
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1500,
              }}
              onClick={() => setOpenImageModalLabelId(null)}
            >
              <Box
                sx={(theme) => ({
                  backgroundColor: theme.palette.mode === 'dark' ? '#424242' : 'white',
                  padding: 2,
                  borderRadius: 2,
                  width: '90%',
                  maxWidth: 600,
                })}
                onClick={(e) => e.stopPropagation()}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 1,
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Selecciona una imagen para "{currentLabel.text}"
                  </Typography>
                  <IconButton
                    onClick={() =>
                      refreshImageSuggestionsForLabel(
                        currentLabel.id,
                        currentLabel.text,
                        currentLabel.example,
                        currentLabel.meaning
                      )
                    }
                    size="small"
                  >
                    <RefreshIcon />
                  </IconButton>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                  }}
                >
                  {currentLabel.imageSuggestions && currentLabel.imageSuggestions.length > 0 ? (
                    currentLabel.imageSuggestions.map((imgUrl, index) => (
                      <Box
                        key={index}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          setLabels((prevLabels) =>
                            prevLabels.map((l) =>
                              l.id === currentLabel.id
                                ? { ...l, selectedImage: imgUrl }
                                : l
                            )
                          );
                          setOpenImageModalLabelId(null);
                        }}
                      >
                        <img
                          src={imgUrl}
                          alt={`suggestion-${index}`}
                          style={{
                            width: '100%',
                            borderRadius: '4px',
                            border: currentLabel.selectedImage === imgUrl ? '2px solid blue' : 'none',
                          }}
                        />
                      </Box>
                    ))
                  ) : (
                    <Typography variant="body2">
                      No se encontraron imágenes.
                    </Typography>
                  )}
                  {/* Opción para subir imagen personalizada */}
                  <Box
                    sx={{
                      cursor: 'pointer',
                      border: '2px dashed gray',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 100,
                    }}
                  >
                    <label style={{ cursor: 'pointer', textAlign: 'center' }}>
                      Subir imagen
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setLabels((prevLabels) =>
                                prevLabels.map((l) =>
                                  l.id === currentLabel.id
                                    ? { ...l, selectedImage: event.target?.result as string }
                                    : l
                                )
                              );
                              setOpenImageModalLabelId(null);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })()}
        </Container>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          <Alert
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            severity={snackbar.severity as 'success' | 'error'}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
