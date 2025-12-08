# Anki Card Generator

Automatiza la creación de tarjetas de Anki con definiciones, pronunciación (IPA), ejemplos, audio y imágenes en un solo flujo.

---

## 💡 Características

- **Búsqueda de palabra**: Obtiene definición, IPA y ejemplo de uso desde APIs de diccionario y fuentes secundarias (Linguee, Tatoeba).
- **Audio TTS**: Genera pronunciación, definición y ejemplo mediante Google TTS.
- **Sugerencias de imágenes**: Muestra miniaturas de Pixabay y permite subir tu propia imagen.
- **Integración con AnkiConnect**: Envía tarjetas automáticamente al mazo y modelo elegidos.
- **Modo oscuro / claro**: Se adapta al tema del sistema.
- **Configuración dinámica**: Guarda tus preferencias (deck, modelo, URL de AnkiConnect, idioma) en localStorage.

---

## 🚀 Demo en vivo

https://anki-app-sm.vercel.app/

---

## 📋 Cómo usar

1. **Configura AnkiConnect**:  
   - Instala Anki y el complemento [AnkiConnect](https://ankiweb.net/shared/info/2055492159).  
   - Modifica el archivo `meta.json` de AnkiConnect para incluir:  
     ```json
     "webCorsOriginList": [
       "https://anki-app.netlify.app",
       "http://localhost"
     ]
     ```
   - Reinicia Anki.

2. **Usa la app**:  
   - Abre la app en [https://anki-app.netlify.app](https://anki-app.netlify.app).  
   - Ve a **Configuración** e introduce tu **AnkiConnect URL** (`http://127.0.0.1:8765`).  
   - Selecciona tu **Deck** y **Model**, y guarda los cambios.  
   - Busca palabras, ajusta los datos si es necesario, y crea tarjetas fácilmente.

---

## 🛠️ Resolución de problemas

- **No aparecen decks o modelos**:  
  - Asegúrate de que Anki está abierto y la URL de AnkiConnect es correcta.  
  - Revisa que configuraste el CORS en el archivo `meta.json`.

- **Error CORS en navegador**:  
  - Verifica el header `Access-Control-Allow-Origin` en la respuesta de AnkiConnect.  
  - Permite contenido "inseguro" si usas la app desde HTTPS mientras AnkiConnect está en HTTP.

- **Imágenes no se muestran**:  
  - Comprueba que las imágenes se guardaron correctamente en `collection.media`.  
  - Asegúrate de que tu modelo de Anki utiliza el campo `Image` para renderizar imágenes.

---

## 🤝 Contribuciones

¡Tu ayuda es bienvenida! Si encuentras un bug o tienes sugerencias:

1. Haz un fork del proyecto.  
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`).  
3. Realiza tus cambios y haz commit (`git commit -m 'Añade nueva funcionalidad'`).  
4. Sube a tu fork (`git push origin feature/nueva-funcionalidad`).  
5. Abre un Pull Request.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---
