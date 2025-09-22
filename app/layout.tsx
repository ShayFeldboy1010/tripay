import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { RootClient } from '@/app/RootClient'
import { AIChatProvider } from '@/components/AIChatStore'
import { AIChatWidget } from '@/components/AIChatWidget'

export const metadata: Metadata = {
  title: 'Trip Expenses',
  description: 'Share expenses with friends instantly',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trip Expenses',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0B1020" />
      </head>
      <body className="antialiased touch-manipulation pb-[env(safe-area-inset-bottom)] min-h-screen app-bg">
        <RootClient>
          <ThemeProvider>
            <AIChatProvider>
              {children}
              <AIChatWidget />
            </AIChatProvider>
          </ThemeProvider>
        </RootClient>
      </body>
    </html>
  )
}
