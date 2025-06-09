"use client"

import type React from "react"
import { useState } from "react"
import ReactDOM from "react-dom"
import { useTheme } from "@mui/material/styles"
import { DialogContent, Typography, Button } from "@mui/material"
import { useTranslation } from "../hooks/useTranslation"

export function Modal({
  children,
  isOpen,
  onClose,
}: {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
}) {
  const theme = useTheme()
  if (!isOpen) return null

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1300,
  }

  const modalStyle: React.CSSProperties = {
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    borderRadius: 8,
    width: "80%",
    maxWidth: 800,
    maxHeight: "80vh",
    overflowY: "auto",
    padding: 24,
    position: "relative",
    boxShadow: theme.shadows[5],
  }

  const closeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: 8,
    right: 8,
    background: "transparent",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
    color: theme.palette.text.primary,
  }

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtnStyle} onClick={onClose} aria-label="Close">
          ×
        </button>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

interface HelpGuideProps {
  selectedLanguage?: string
}

export default function HelpGuide({ selectedLanguage = "en" }: HelpGuideProps) {
  const theme = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useTranslation(selectedLanguage)
  const toggle = () => setIsOpen((o) => !o)

  const helpBtnStyle: React.CSSProperties = {
    position: "fixed",
    top: 16,
    right: 16,
    zIndex: 1200,
    background: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "50%",
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    cursor: "pointer",
    boxShadow: theme.shadows[2],
  }

  return (
    <>
      <button onClick={toggle} aria-label="Ayuda" style={helpBtnStyle}>
        ❔
      </button>

      <Modal isOpen={isOpen} onClose={toggle}>
        <h2>{t("helpGuide.title")}</h2>
        <DialogContent dividers>
          {/* Sección 1: Instalar y preparar AnkiConnect */}
          <Typography variant="h6" gutterBottom>
            <b>{t("helpGuide.installAnkiConnect")}</b>
          </Typography>
          <Typography variant="body2">
            {t("helpGuide.downloadAnki")}{" "}
            <a href="https://apps.ankiweb.net" target="_blank" rel="noopener noreferrer">
              apps.ankiweb.net
            </a>
            .
          </Typography>
          <Typography variant="body2">
            {t("helpGuide.installAnkiConnectSteps")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.openAnkiTools")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.pasteCode")}
          </Typography>
          <Typography variant="body2">
            {t("helpGuide.configureCors")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.goToAnkiTools")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.selectAnkiConnect")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.replaceWebCors")}
            <pre
              style={{
                background: theme.palette.background.paper,
                color: theme.palette.text.primary,
                padding: "8px",
                borderRadius: "4px",
                border: `1px solid ${theme.palette.divider}`,
                overflowX: "auto",
              }}
            >
              {`"webCorsOriginList": [
          "https://anki-app.netlify.app",
          "http://localhost"
        ]`}
            </pre>
            &nbsp;&nbsp;– {t("helpGuide.saveAndRestart")}
          </Typography>

          {/* Sección 2: Note Type recomendado */}
          <Typography variant="h6" gutterBottom>
            <b>{t("helpGuide.recommendedNoteType")}</b>
          </Typography>
          <Typography variant="body2">{t("helpGuide.linkAllData")}</Typography>
          <ul>
            {["Word", "Sound", "IPA", "Meaning", "Example", "Sound_Meaning", "Sound_Example", "Image"].map((field) => (
              <li key={field}>
                <Typography variant="body2">{field}</Typography>
              </li>
            ))}
          </ul>

          {/* A) Usar modelo pre-configurado */}
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            <b>{t("helpGuide.usePreConfigured")}</b>
          </Typography>
          <Typography variant="body2">{t("helpGuide.downloadImportPackage")}</Typography>
          <Button
            variant="outlined"
            component="a"
            href="/client/public/Export-Model.apkg"
            download="AnkiCustomModel.apkg"
          >
            {t("helpGuide.downloadModel")}
          </Button>

          {/* B) Crear tu propio modelo */}
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            <b>{t("helpGuide.createYourOwn")}</b>
          </Typography>
          <Typography variant="body2" component="div">
            <ol>
              <li>{t("helpGuide.createOwnSteps")}</li>
              <li>{t("helpGuide.addFieldsTab")}</li>
              <ul>
                {["Word", "Sound", "IPA", "Meaning", "Example", "Sound_Meaning", "Sound_Example", "Image"].map(
                  (field) => (
                    <li key={field}>
                      <Typography variant="body2">{field}</Typography>
                    </li>
                  ),
                )}
              </ul>
              <li>{t("helpGuide.insertTemplates")}</li>
              <pre
                style={{
                  background: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  padding: "8px",
                  borderRadius: "4px",
                  border: `1px solid ${theme.palette.divider}`,
                  overflowX: "auto",
                }}
              >
                {`                <div>
                  {{Word}} {{Sound}}
                  <div>{{IPA}}</div>
                  <div>{{Meaning}} {{Sound_Meaning}}</div>
                  <div>{{Example} {{Sound_Example}}}</div>
                  <img src="{{Image}}" alt="Imagen"/>
                </div>`}
              </pre>
              <li>{t("helpGuide.saveModel")}</li>
            </ol>
          </Typography>

          {/* Sección 3: Configurar tu instancia de la web app */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            <b>{t("helpGuide.configureWebApp")}</b>
          </Typography>

          <Typography variant="body2">
            {t("helpGuide.inConfiguration")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.selectDeck")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.chooseModel")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.enterUrl")}
            <br />
            &nbsp;&nbsp;– {t("helpGuide.clickSave")}
          </Typography>
          <br />
          <Typography variant="caption" display="block" color="textSecondary">
            {t("helpGuide.confirmErrors")}
          </Typography>
        </DialogContent>
      </Modal>
    </>
  )
}
