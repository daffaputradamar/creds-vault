import type { Metadata, Viewport } from 'next';
import { Outfit, Fira_Code, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { ThemeProvider } from '@/components/theme-provider';
import { ServiceWorkerRegister } from '@/components/sw-register';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  applicationName: 'Credentials Vault',
  title: 'Credentials Vault - Secure Storage',
  description: 'Store SSH keys, GitHub PATs, username/password pairs, API keys, and database credentials securely.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vault',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbf6' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0e1a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(outfit.variable, "font-mono", jetbrainsMono.variable)}>
      <head>
        {/* Load Tabler Icons via CDN */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
      </head>
      <body>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <ServiceWorkerRegister />
          </ThemeProvider>
      </body>
    </html>
  );
}
