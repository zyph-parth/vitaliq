import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { PwaRegistration } from '@/components/PwaRegistration'

export const metadata: Metadata = {
  applicationName: 'VitalIQ',
  title: 'VitalIQ - Your Intelligent Health OS',
  description:
    'The fitness platform that connects training, nutrition, sleep, mental load, and longevity into one adaptive workspace.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/vitaliq-tab-icon.svg', type: 'image/svg+xml' },
      { url: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/vitaliq-tab-icon.svg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VitalIQ',
  },
  openGraph: {
    title: 'VitalIQ',
    description: 'Your intelligent health operating system',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#fafaf7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegistration />
      </body>
    </html>
  )
}
