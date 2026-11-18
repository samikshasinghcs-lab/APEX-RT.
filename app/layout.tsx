import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600','700'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['300','400','500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'QNX Sentinel | Engineering Intelligence',
  description: 'A production workbench for embedded telemetry analysis, multilingual diagnostics and verifiable forensic evidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[#F5F7F8] font-sans antialiased text-[#18212B]">
        {children}
      </body>
    </html>
  );
}
