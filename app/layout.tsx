import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { TRIPPAY_BLUE_DARK } from '@/theme/colors'
import { RootClient } from '@/app/RootClient'
import { AIChatProvider } from '@/components/AIChatStore'
import { AIChatWidget } from '@/components/AIChatWidget'

const inter = Inter({ subsets: ['latin'] })

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value as 'he' | 'en') || 'en'
  const dir = locale === 'he' ? 'rtl' : 'ltr'
  return (
    <html lang={locale} dir={dir} className={inter.className} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={TRIPPAY_BLUE_DARK} />
      </head>
      <body className="antialiased touch-manipulation pb-[env(safe-area-inset-bottom)] bg-[color:var(--color-bg)]">
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
