import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useTheme } from '@mui/material/styles';
import {
  DialogContent,
  Typography,
  Button
} from '@mui/material';

export function Modal({ children, isOpen, onClose }: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1300,
  };

  const modalStyle: React.CSSProperties = {
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    borderRadius: 8,
    width: '80%',        
    maxWidth: 800,       
    maxHeight: '80vh',   
    overflowY: 'auto',   
    padding: 24,
    position: 'relative',
    boxShadow: theme.shadows[5],
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: theme.palette.text.primary,
  };

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtnStyle} onClick={onClose} aria-label="Close">
          ×
        </button>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function HelpGuide() {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen((o) => !o);

  const helpBtnStyle: React.CSSProperties = {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 1200,
    background: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    cursor: 'pointer',
    boxShadow: theme.shadows[2],
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-label="Ayuda"
        style={helpBtnStyle}
      >
        ❔
      </button>

      <Modal isOpen={isOpen} onClose={toggle}>
        <h2>Cómo usar la app</h2>
        <DialogContent dividers>
          {/* Sección 1: Instalar y preparar AnkiConnect */}
          <Typography variant="h6" gutterBottom>
            <b>1. Instalar y preparar AnkiConnect</b>
          </Typography>
          <Typography variant="body2">
            • Descarga e instala Anki desde{" "}
            <a href="https://apps.ankiweb.net" target="_blank" rel="noopener noreferrer">
              apps.ankiweb.net
            </a>.
          </Typography>
          <Typography variant="body2">
            • Instala AnkiConnect:
            <br />
            &nbsp;&nbsp;– Abre <b>Anki → Herramientas → Complementos → Obtener complementos…</b>
            <br />
            &nbsp;&nbsp;– Pega el código <b>2055492159</b> y pulsa Instalar.
          </Typography>
          <Typography variant="body2">
            • Configura CORS en AnkiConnect:
            <br />
            &nbsp;&nbsp;– Dirigete nuevamente a <b>Anki → Herramientas → Complementos</b>.
            <br />
            &nbsp;&nbsp;– Selecciona <b>AnkiConnect</b> y haz click en <b>Configuracion</b>
            <br />
            &nbsp;&nbsp;– Sustituye la sección <code>webCorsOriginList</code> por:
            <pre style={{
              background: theme.palette.background.paper,   // mismo papel que el modal
              color: theme.palette.text.primary,             // texto legible en ambos modos
              padding: '8px',
              borderRadius: '4px',
              border: `1px solid ${theme.palette.divider}`,  // un sutil borde
              overflowX: 'auto'                              // scroll horizontal si hace falta
            }}>
        {`"webCorsOriginList": [
          "https://anki-app.netlify.app",
          "http://localhost"
        ]`}
            </pre>
            &nbsp;&nbsp;– Guarda y reinicia Anki.
          </Typography>

          {/* Sección 2: Note Type recomendado */}
            <Typography variant="h6" gutterBottom>
              <b>2. Note Type (Modelo) recomendado</b>
            </Typography>
            <Typography variant="body2">
              Para que la app vincule correctamente todos los datos (palabra, audio, IPA, significado,
              ejemplo, TTS y foto), tu modelo de Anki debe incluir exactamente estos campos:
            </Typography>
            <ul>
              {['Word', 'Sound', 'IPA', 'Meaning', 'Example', 'Sound_Meaning', 'Sound_Example', 'Image']
                .map((field) => (
                  <li key={field}>
                    <Typography variant="body2">{field}</Typography>
                  </li>
                ))}
            </ul>

            {/* A) Usar modelo pre-configurado */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              <b>A) Usar mi modelo pre-configurado</b>
            </Typography>
            <Typography variant="body2">
              Descarga e importa el paquete de modelo listo para usar en Anki:
            </Typography>
            <Button
                variant="outlined"
                component="a"
                href="/client/public/Export-Model.apkg"
                download="AnkiCustomModel.apkg"
              >
              Descargar modelo (.apkg)
            </Button>

            {/* B) Crear tu propio modelo */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              <b>B) Crear tu propio modelo</b>
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>En Anki, ve a <b>Herramientas → Gestionar modelos → Añadir</b> y crea o duplica un modelo.</li>
                <li>En la pestaña <b>Campos</b>, añade estos campos EXACTAMENTE con estos nombres:</li>
                <ul>
                  {['Word', 'Sound', 'IPA', 'Meaning', 'Example', 'Sound_Meaning', 'Sound_Example', 'Image']
                    .map((field) => (
                      <li key={field}>
                        <Typography variant="body2">{field}</Typography>
                      </li>
                    ))}
                </ul>
                <li>En <b>Plantillas</b>, inserta los campos donde quieras:</li>
                <pre style={{
                  background: theme.palette.background.paper,   // mismo papel que el modal
                  color: theme.palette.text.primary,             // texto legible en ambos modos
                  padding: '8px',
                  borderRadius: '4px',
                  border: `1px solid ${theme.palette.divider}`,  // un sutil borde
                  overflowX: 'auto'                              // scroll horizontal si hace falta
                }}>
                {`                <div>
                  {{Word}} {{Sound}}
                  <div>{{IPA}}</div>
                  <div>{{Meaning}} {{Sound_Meaning}}</div>
                  <div>{{Example} {{Sound_Example}}}</div>
                  <img src="{{Image}}" alt="Imagen"/>
                </div>`}
                      </pre>
                <li>Guarda el modelo. Luego aparecerá en la lista de “Model” dentro de la app.</li>
              </ol>
            </Typography>

          {/* Sección 3: Configurar tu instancia de la web app */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            <b>3. Configurar la web app</b>
          </Typography>

          <Typography variant="body2">
            • En “Configuración”:
            <br />
            &nbsp;&nbsp;– <b>Deck:</b> selecciona tu mazo destino.
            <br />
            &nbsp;&nbsp;– <b>Model:</b> elige el modelo de nota.
            <br />
            &nbsp;&nbsp;– <b>Anki Connect URL:</b> introduce tu URL del complemento. Por defecto es: <b>http://localhost:8765</b>
            <br />
            &nbsp;&nbsp;– Haz clic en <b>Save Settings</b> para guardar la configuracion.
          </Typography>
          <br />
          <Typography variant="caption" display="block" color="textSecondary">
            Si al guardar ves errores, confirma que AnkiConnect esté abierto y la URL coincida
            con tu configuración de CORS.
          </Typography>
        </DialogContent>
      </Modal>
    </>
  );
}
