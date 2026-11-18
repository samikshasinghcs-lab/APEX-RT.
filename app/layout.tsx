import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'QNX Sentinel Hybrid AI Telemetry & Forensics',
  description:
    'ASIL-D-inspired embedded QNX telemetry forensics console with Firebase Hybrid AI routing, Top-10 non-English automotive language diagnostics, Multimodal Vision Fault Inspection, Speculative Edge-vs-Cloud Consensus Gate, and SHA-256 Black-Box Flight Recorder.',
  openGraph: {
    title: 'QNX Sentinel Hybrid AI Telemetry & Forensics',
    description:
      'ASIL-D-inspired embedded QNX telemetry forensics console with Firebase Hybrid AI routing, Top-10 non-English automotive language diagnostics, Multimodal Vision Fault Inspection, Speculative Edge-vs-Cloud Consensus Gate, and SHA-256 Black-Box Flight Recorder.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QNX Sentinel Hybrid AI Telemetry & Forensics',
    description:
      'ASIL-D-inspired embedded QNX telemetry forensics console with Firebase Hybrid AI routing, Top-10 non-English automotive language diagnostics, Multimodal Vision Fault Inspection, Speculative Edge-vs-Cloud Consensus Gate, and SHA-256 Black-Box Flight Recorder.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="font-sans antialiased bg-[#07090E] text-slate-100"
      >
        {children}
      </body>
    </html>
  );
}
