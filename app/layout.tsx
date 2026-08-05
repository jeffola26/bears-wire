import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BearsWire - Chicago Bears News & Videos",
  description: "Your go-to source for Chicago Bears coverage. Latest news, videos, and analysis from multiple sources.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "BearsWire - Chicago Bears News & Videos",
    description: "Your go-to source for Chicago Bears coverage. Latest news, videos, and analysis from multiple sources.",
    url: "https://bearswire.netlify.app",
    siteName: "BearsWire",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BearsWire - Chicago Bears News & Videos",
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
