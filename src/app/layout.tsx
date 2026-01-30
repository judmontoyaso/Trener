import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Trener - Tu Asistente de Entrenamiento',
  description: 'Gestiona tus entrenamientos y genera rutinas personalizadas con IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen bg-gym-darker">
          {children}
        </div>
      </body>
    </html>
  )
}
