/**
 * Sistema de traducciones para la aplicación
 * Contiene todos los textos de la interfaz en múltiples idiomas
 */
export const translations = {
  en: {
    // Título principal
    appTitle: "Anki Card Generator",

    // Sección de configuración
    configuration: "Configuration",
    deck: "Deck",
    model: "Model",
    language: "Language",
    ankiConnectUrl: "Anki Connect URL",
    saveSettings: "Save Settings",
    configurationSaved: "Configuration saved",
    configureAnkiConnectFirst: "Configure Anki Connect URL first",
    ankiNotOpen: "Anki is not open. Please open Anki.",
    ankiConnectNotResponding: "Incorrect URL or AnkiConnect not responding.",

    // Idiomas
    languages: {
      english: "English",
      spanish: "Spanish",
      german: "German",
      japanese: "Japanese",
      chinese: "Chinese",
    },

    // Sección de búsqueda
    searchWord: "Search Word",
    word: "Word",
    search: "Search",
    mustEnterWord: "You must enter a word",
    searchingTexts: "Searching texts...",

    // Sección de labels
    queueLabels: "Labels Queue",
    wordLabel: "Word",
    ipa: "IPA",
    meaning: "Meaning",
    example: "Example",
    noImagesFound: "No images found. (Click to try)",
    approve: "Approve",
    reject: "Reject",
    edit: "Edit",
    done: "Done",
    processing: "Processing...",

    // Modal de imágenes
    selectImageFor: "Select an image for",
    uploadImage: "Upload image",
    noImagesFoundModal: "No images found.",

    // Mensajes de éxito/error
    cardCreatedSuccessfully: "Card created successfully",
    wordAlreadyInQueue: "The word is already in the queue.",
    errorSearchingWord: "Error searching word",
    error: "Error",

    // Guía de ayuda
    helpGuide: {
      title: "How to use the app",
      installAnkiConnect: "1. Install and prepare AnkiConnect",
      downloadAnki: "• Download and install Anki from",
      installAnkiConnectSteps: "• Install AnkiConnect:",
      openAnkiTools: "– Open Anki → Tools → Add-ons → Get Add-ons…",
      pasteCode: "– Paste the code 2055492159 and click Install.",
      configureCors: "• Configure CORS in AnkiConnect:",
      goToAnkiTools: "– Go again to Anki → Tools → Add-ons.",
      selectAnkiConnect: "– Select AnkiConnect and click Configuration",
      replaceWebCors: "– Replace the webCorsOriginList section with:",
      saveAndRestart: "– Save and restart Anki.",

      recommendedNoteType: "2. Recommended Note Type (Model)",
      linkAllData:
        "For the app to correctly link all data (word, audio, IPA, meaning, example, TTS and photo), your Anki model must include exactly these fields:",

      usePreConfigured: "A) Use my pre-configured model",
      downloadImportPackage: "Download and import the ready-to-use model package in Anki:",
      downloadModel: "Download model (.apkg)",

      createYourOwn: "B) Create your own model",
      createOwnSteps: "1. In Anki, go to Tools → Manage Note Types → Add and create or duplicate a model.",
      addFieldsTab: "2. In the Fields tab, add these fields EXACTLY with these names:",
      insertTemplates: "3. In Templates, insert the fields where you want:",
      saveModel: "4. Save the model. Then it will appear in the 'Model' list within the app.",

      configureWebApp: "3. Configure the web app",
      inConfiguration: "• In 'Configuration':",
      selectDeck: "– Deck: select your destination deck.",
      chooseModel: "– Model: choose the note model.",
      enterUrl: "– Anki Connect URL: enter your add-on URL. By default it is: http://localhost:8765",
      clickSave: "– Click Save Settings to save the configuration.",
      confirmErrors:
        "If you see errors when saving, confirm that AnkiConnect is open and the URL matches your CORS configuration.",
    },
  },
  es: {
    // Título principal
    appTitle: "Generador de Tarjetas Anki",

    // Sección de configuración
    configuration: "Configuración",
    deck: "Mazo",
    model: "Modelo",
    language: "Idioma",
    ankiConnectUrl: "URL de Anki Connect",
    saveSettings: "Guardar Configuración",
    configurationSaved: "Configuración guardada",
    configureAnkiConnectFirst: "Configura la URL de Anki Connect primero",
    ankiNotOpen: "Anki no está abierto. Por favor, abre Anki.",
    ankiConnectNotResponding: "URL incorrecta o AnkiConnect no responde.",

    // Idiomas
    languages: {
      english: "Inglés",
      spanish: "Español",
      german: "Alemán",
      japanese: "Japonés",
      chinese: "Chino",
    },

    // Sección de búsqueda
    searchWord: "Buscar Palabra",
    word: "Palabra",
    search: "Buscar",
    mustEnterWord: "Debe introducir una palabra",
    searchingTexts: "Buscando textos...",

    // Sección de labels
    queueLabels: "Cola de Etiquetas",
    wordLabel: "Palabra",
    ipa: "IPA",
    meaning: "Significado",
    example: "Ejemplo",
    noImagesFound: "No se encontraron imágenes. (Click para intentar)",
    approve: "Aprobar",
    reject: "Rechazar",
    edit: "Editar",
    done: "Hecho",
    processing: "Procesando...",

    // Modal de imágenes
    selectImageFor: "Selecciona una imagen para",
    uploadImage: "Subir imagen",
    noImagesFoundModal: "No se encontraron imágenes.",

    // Mensajes de éxito/error
    cardCreatedSuccessfully: "Tarjeta creada con éxito",
    wordAlreadyInQueue: "La palabra ya está en la cola.",
    errorSearchingWord: "Error al buscar la palabra",
    error: "Error",

    // Guía de ayuda
    helpGuide: {
      title: "Cómo usar la app",
      installAnkiConnect: "1. Instalar y preparar AnkiConnect",
      downloadAnki: "• Descarga e instala Anki desde",
      installAnkiConnectSteps: "• Instala AnkiConnect:",
      openAnkiTools: "– Abre Anki → Herramientas → Complementos → Obtener complementos…",
      pasteCode: "– Pega el código 2055492159 y pulsa Instalar.",
      configureCors: "• Configura CORS en AnkiConnect:",
      goToAnkiTools: "– Dirigete nuevamente a Anki → Herramientas → Complementos.",
      selectAnkiConnect: "– Selecciona AnkiConnect y haz click en Configuracion",
      replaceWebCors: "– Sustituye la sección webCorsOriginList por:",
      saveAndRestart: "– Guarda y reinicia Anki.",

      recommendedNoteType: "2. Note Type (Modelo) recomendado",
      linkAllData:
        "Para que la app vincule correctamente todos los datos (palabra, audio, IPA, significado, ejemplo, TTS y foto), tu modelo de Anki debe incluir exactamente estos campos:",

      usePreConfigured: "A) Usar mi modelo pre-configurado",
      downloadImportPackage: "Descarga e importa el paquete de modelo listo para usar en Anki:",
      downloadModel: "Descargar modelo (.apkg)",

      createYourOwn: "B) Crear tu propio modelo",
      createOwnSteps: "1. En Anki, ve a Herramientas → Gestionar modelos → Añadir y crea o duplica un modelo.",
      addFieldsTab: "2. En la pestaña Campos, añade estos campos EXACTAMENTE con estos nombres:",
      insertTemplates: "3. En Plantillas, inserta los campos donde quieras:",
      saveModel: "4. Guarda el modelo. Luego aparecerá en la lista de 'Modelo' dentro de la app.",

      configureWebApp: "3. Configurar la web app",
      inConfiguration: "• En 'Configuración':",
      selectDeck: "– Deck: selecciona tu mazo destino.",
      chooseModel: "– Modelo: elige el modelo de nota.",
      enterUrl: "– Anki Connect URL: introduce tu URL del complemento. Por defecto es: http://localhost:8765",
      clickSave: "– Haz clic en Save Settings para guardar la configuración.",
      confirmErrors:
        "Si al guardar ves errores, confirma que AnkiConnect esté abierto y la URL coincida con tu configuración de CORS.",
    },
  },
  de: {
    // Título principal
    appTitle: "Anki Karten Generator",

    // Sección de configuración
    configuration: "Konfiguration",
    deck: "Stapel",
    model: "Modell",
    language: "Sprache",
    ankiConnectUrl: "Anki Connect URL",
    saveSettings: "Einstellungen Speichern",
    configurationSaved: "Konfiguration gespeichert",
    configureAnkiConnectFirst: "Konfigurieren Sie zuerst die Anki Connect URL",
    ankiNotOpen: "Anki ist nicht geöffnet. Bitte öffnen Sie Anki.",
    ankiConnectNotResponding: "Falsche URL oder AnkiConnect antwortet nicht.",

    // Idiomas
    languages: {
      english: "Englisch",
      spanish: "Spanisch",
      german: "Deutsch",
      japanese: "Japanisch",
      chinese: "Chinesisch",
    },

    // Sección de búsqueda
    searchWord: "Wort Suchen",
    word: "Wort",
    search: "Suchen",
    mustEnterWord: "Sie müssen ein Wort eingeben",
    searchingTexts: "Texte suchen...",

    // Sección de labels
    queueLabels: "Etiketten Warteschlange",
    wordLabel: "Wort",
    ipa: "IPA",
    meaning: "Bedeutung",
    example: "Beispiel",
    noImagesFound: "Keine Bilder gefunden. (Klicken zum Versuchen)",
    approve: "Genehmigen",
    reject: "Ablehnen",
    edit: "Bearbeiten",
    done: "Fertig",
    processing: "Verarbeitung...",

    // Modal de imágenes
    selectImageFor: "Wählen Sie ein Bild für",
    uploadImage: "Bild hochladen",
    noImagesFoundModal: "Keine Bilder gefunden.",

    // Mensajes de éxito/error
    cardCreatedSuccessfully: "Karte erfolgreich erstellt",
    wordAlreadyInQueue: "Das Wort ist bereits in der Warteschlange.",
    errorSearchingWord: "Fehler beim Suchen des Wortes",
    error: "Fehler",

    // Guía de ayuda (simplified for German)
    helpGuide: {
      title: "Wie man die App benutzt",
      installAnkiConnect: "1. AnkiConnect installieren und vorbereiten",
      downloadAnki: "• Laden Sie Anki herunter und installieren Sie es von",
      installAnkiConnectSteps: "• AnkiConnect installieren:",
      openAnkiTools: "– Öffnen Sie Anki → Extras → Add-ons → Add-ons abrufen…",
      pasteCode: "– Fügen Sie den Code 2055492159 ein und klicken Sie auf Installieren.",
      configureCors: "• CORS in AnkiConnect konfigurieren:",
      goToAnkiTools: "– Gehen Sie erneut zu Anki → Extras → Add-ons.",
      selectAnkiConnect: "– Wählen Sie AnkiConnect und klicken Sie auf Konfiguration",
      replaceWebCors: "– Ersetzen Sie den Abschnitt webCorsOriginList durch:",
      saveAndRestart: "– Speichern und Anki neu starten.",

      recommendedNoteType: "2. Empfohlener Notiztyp (Modell)",
      linkAllData: "Damit die App alle Daten korrekt verknüpft, muss Ihr Anki-Modell genau diese Felder enthalten:",

      usePreConfigured: "A) Mein vorkonfiguriertes Modell verwenden",
      downloadImportPackage: "Laden Sie das gebrauchsfertige Modellpaket herunter und importieren Sie es in Anki:",
      downloadModel: "Modell herunterladen (.apkg)",

      createYourOwn: "B) Eigenes Modell erstellen",
      createOwnSteps:
        "1. Gehen Sie in Anki zu Extras → Notiztypen verwalten → Hinzufügen und erstellen oder duplizieren Sie ein Modell.",
      addFieldsTab: "2. Fügen Sie auf der Registerkarte Felder diese Felder GENAU mit diesen Namen hinzu:",
      insertTemplates: "3. Fügen Sie in Vorlagen die Felder ein, wo Sie möchten:",
      saveModel: "4. Speichern Sie das Modell. Dann erscheint es in der 'Modell'-Liste in der App.",

      configureWebApp: "3. Web-App konfigurieren",
      inConfiguration: "• In 'Konfiguration':",
      selectDeck: "– Stapel: Wählen Sie Ihren Zielstapel.",
      chooseModel: "– Modell: Wählen Sie das Notizmodell.",
      enterUrl: "– Anki Connect URL: Geben Sie Ihre Add-on-URL ein. Standardmäßig ist es: http://localhost:8765",
      clickSave: "– Klicken Sie auf Einstellungen speichern, um die Konfiguration zu speichern.",
      confirmErrors:
        "Wenn beim Speichern Fehler auftreten, bestätigen Sie, dass AnkiConnect geöffnet ist und die URL mit Ihrer CORS-Konfiguration übereinstimmt.",
    },
  },
  ja: {
    // Título principal
    appTitle: "Ankiカードジェネレーター",

    // Sección de configuración
    configuration: "設定",
    deck: "デッキ",
    model: "モデル",
    language: "言語",
    ankiConnectUrl: "Anki Connect URL",
    saveSettings: "設定を保存",
    configurationSaved: "設定が保存されました",
    configureAnkiConnectFirst: "最初にAnki Connect URLを設定してください",
    ankiNotOpen: "Ankiが開いていません。Ankiを開いてください。",
    ankiConnectNotResponding: "URLが間違っているかAnkiConnectが応答していません。",

    // Idiomas
    languages: {
      english: "英語",
      spanish: "スペイン語",
      german: "ドイツ語",
      japanese: "日本語",
      chinese: "中国語",
    },

    // Sección de búsqueda
    searchWord: "単語を検索",
    word: "単語",
    search: "検索",
    mustEnterWord: "単語を入力してください",
    searchingTexts: "テキストを検索中...",

    // Sección de labels
    queueLabels: "ラベルキュー",
    wordLabel: "単語",
    ipa: "IPA",
    meaning: "意味",
    example: "例",
    noImagesFound: "画像が見つかりません。（クリックして試す）",
    approve: "承認",
    reject: "拒否",
    edit: "編集",
    done: "完了",
    processing: "処理中...",

    // Modal de imágenes
    selectImageFor: "画像を選択してください",
    uploadImage: "画像をアップロード",
    noImagesFoundModal: "画像が見つかりません。",

    // Mensajes de éxito/error
    cardCreatedSuccessfully: "カードが正常に作成されました",
    wordAlreadyInQueue: "その単語は既にキューにあります。",
    errorSearchingWord: "単語の検索エラー",
    error: "エラー",

    // Guía de ayuda (simplified for Japanese)
    helpGuide: {
      title: "アプリの使い方",
      installAnkiConnect: "1. AnkiConnectのインストールと準備",
      downloadAnki: "• Ankiをダウンロードしてインストールしてください",
      installAnkiConnectSteps: "• AnkiConnectをインストール:",
      openAnkiTools: "– Anki → ツール → アドオン → アドオンを取得…を開く",
      pasteCode: "– コード2055492159を貼り付けてインストールをクリック。",
      configureCors: "• AnkiConnectでCORSを設定:",
      goToAnkiTools: "– 再びAnki → ツール → アドオンに移動。",
      selectAnkiConnect: "– AnkiConnectを選択して設定をクリック",
      replaceWebCors: "– webCorsOriginListセクションを次のように置き換える:",
      saveAndRestart: "– 保存してAnkiを再起動。",

      recommendedNoteType: "2. 推奨ノートタイプ（モデル）",
      linkAllData:
        "アプリがすべてのデータを正しくリンクするために、Ankiモデルには正確にこれらのフィールドが含まれている必要があります:",

      usePreConfigured: "A) 事前設定済みモデルを使用",
      downloadImportPackage: "すぐに使えるモデルパッケージをダウンロードしてAnkiにインポート:",
      downloadModel: "モデルをダウンロード (.apkg)",

      createYourOwn: "B) 独自のモデルを作成",
      createOwnSteps: "1. Ankiで、ツール → ノートタイプを管理 → 追加に移動し、モデルを作成または複製します。",
      addFieldsTab: "2. フィールドタブで、これらのフィールドを正確にこれらの名前で追加:",
      insertTemplates: "3. テンプレートで、必要な場所にフィールドを挿入:",
      saveModel: "4. モデルを保存。その後、アプリ内の「モデル」リストに表示されます。",

      configureWebApp: "3. ウェブアプリの設定",
      inConfiguration: "• 「設定」で:",
      selectDeck: "– デッキ: 目的のデッキを選択。",
      chooseModel: "– モデル: ノートモデルを選択。",
      enterUrl: "– Anki Connect URL: アドオンのURLを入力。デフォルトは: http://localhost:8765",
      clickSave: "– 設定を保存をクリックして設定を保存。",
      confirmErrors:
        "保存時にエラーが表示される場合は、AnkiConnectが開いていて、URLがCORS設定と一致していることを確認してください。",
    },
  },
  zh: {
    // Título principal
    appTitle: "Anki卡片生成器",

    // Sección de configuración
    configuration: "配置",
    deck: "牌组",
    model: "模型",
    language: "语言",
    ankiConnectUrl: "Anki Connect URL",
    saveSettings: "保存设置",
    configurationSaved: "配置已保存",
    configureAnkiConnectFirst: "请先配置Anki Connect URL",
    ankiNotOpen: "Anki未打开。请打开Anki。",
    ankiConnectNotResponding: "URL错误或AnkiConnect无响应。",

    // Idiomas
    languages: {
      english: "英语",
      spanish: "西班牙语",
      german: "德语",
      japanese: "日语",
      chinese: "中文",
    },

    // Sección de búsqueda
    searchWord: "搜索单词",
    word: "单词",
    search: "搜索",
    mustEnterWord: "您必须输入一个单词",
    searchingTexts: "搜索文本中...",

    // Sección de labels
    queueLabels: "标签队列",
    wordLabel: "单词",
    ipa: "IPA",
    meaning: "含义",
    example: "例子",
    noImagesFound: "未找到图片。（点击尝试）",
    approve: "批准",
    reject: "拒绝",
    edit: "编辑",
    done: "完成",
    processing: "处理中...",

    // Modal de imágenes
    selectImageFor: "为以下内容选择图片",
    uploadImage: "上传图片",
    noImagesFoundModal: "未找到图片。",

    // Mensajes de éxito/error
    cardCreatedSuccessfully: "卡片创建成功",
    wordAlreadyInQueue: "该单词已在队列中。",
    errorSearchingWord: "搜索单词时出错",
    error: "错误",

    // Guía de ayuda (simplified for Chinese)
    helpGuide: {
      title: "如何使用应用",
      installAnkiConnect: "1. 安装和准备AnkiConnect",
      downloadAnki: "• 从以下网址下载并安装Anki",
      installAnkiConnectSteps: "• 安装AnkiConnect:",
      openAnkiTools: "– 打开Anki → 工具 → 插件 → 获取插件…",
      pasteCode: "– 粘贴代码2055492159并点击安装。",
      configureCors: "• 在AnkiConnect中配置CORS:",
      goToAnkiTools: "– 再次转到Anki → 工具 → 插件。",
      selectAnkiConnect: "– 选择AnkiConnect并点击配置",
      replaceWebCors: "– 将webCorsOriginList部分替换为:",
      saveAndRestart: "– 保存并重启Anki。",

      recommendedNoteType: "2. 推荐的笔记类型（模型）",
      linkAllData: "为了让应用正确链接所有数据，您的Anki模型必须包含这些确切的字段:",

      usePreConfigured: "A) 使用我的预配置模型",
      downloadImportPackage: "下载并导入即用型模型包到Anki:",
      downloadModel: "下载模型 (.apkg)",

      createYourOwn: "B) 创建您自己的模型",
      createOwnSteps: "1. 在Anki中，转到工具 → 管理笔记类型 → 添加并创建或复制模型。",
      addFieldsTab: "2. 在字段选项卡中，添加这些字段，名称必须完全一致:",
      insertTemplates: "3. 在模板中，在您想要的位置插入字段:",
      saveModel: "4. 保存模型。然后它将出现在应用内的「模型」列表中。",

      configureWebApp: "3. 配置网络应用",
      inConfiguration: "• 在「配置」中:",
      selectDeck: "– 牌组: 选择您的目标牌组。",
      chooseModel: "– 模型: 选择笔记模型。",
      enterUrl: "– Anki Connect URL: 输入您的插件URL。默认为: http://localhost:8765",
      clickSave: "– 点击保存设置来保存配置。",
      confirmErrors: "如果保存时看到错误，请确认AnkiConnect已打开且URL与您的CORS配置匹配。",
    },
  },
} as const

export type Language = keyof typeof translations
export type TranslationKey = keyof (typeof translations)["en"]
