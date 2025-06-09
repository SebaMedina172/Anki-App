"use client"

import dynamic from "next/dynamic"

// Importar App dinámicamente con SSR desactivado
const App = dynamic(() => import("../src/App"), { ssr: false })

export default function Page() {
  return <App />
}
