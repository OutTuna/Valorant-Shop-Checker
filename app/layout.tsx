import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "./context/LanguageContext";

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
      <html lang="uk" suppressHydrationWarning>
        <body className="bg-gray-950 text-white antialiased">
        {children}
        </body>
      </html>
    </LanguageProvider>
  );
}