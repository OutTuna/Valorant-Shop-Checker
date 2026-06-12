import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";

export const metadata: Metadata = {
  title: "Valorant Store",
  description: "Secure Valorant shop viewer with Riot login",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <html lang="uk" suppressHydrationWarning>
          <head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
              rel="stylesheet"
            />
          </head>
          <body className="bg-theme-base text-theme-primary antialiased">
            {children}
          </body>
        </html>
      </ThemeProvider>
    </LanguageProvider>
  );
}