import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['300','400','500'], variable: '--font-mono' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal','italic'], variable: '--font-instrument' });

export const metadata: Metadata = {
  title: 'QNX Sentinel — See the shape of the noise',
  description: 'Observe the shape of embedded telemetry noise with privacy-first diagnostics, hybrid inference and verifiable evidence.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${instrument.variable}`}>
      <body className="min-h-screen bg-[#050507] font-sans antialiased text-[#F4F4F5]">
        {children}
      </body>
    </html>
  );
}
