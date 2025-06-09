import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anki App',
  description: 'Auto-Anki Card Generator',
  icons: {
    icon: '/Anki-Logo-icon.png',
    shortcut: '/Anki-Logo-icon.png',
    apple: '/Anki-Logo-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
