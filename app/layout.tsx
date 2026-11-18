import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
const inter=Inter({subsets:['latin'],weight:['300','400','500'],variable:'--font-sans'});
const mono=JetBrains_Mono({subsets:['latin'],weight:['300'],variable:'--font-mono'});
export const metadata:Metadata={title:'QNX Sentinel Hybrid AI Telemetry & Forensics',description:'QNX Sentinel is a hybrid AI post-mortem telemetry and forensics workbench for embedded-system diagnostics, multilingual fault analysis and traceable evidence.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${inter.variable} ${mono.variable} dark`}><body suppressHydrationWarning className="font-sans antialiased bg-[#0A0A0A] text-white">{children}</body></html>}
