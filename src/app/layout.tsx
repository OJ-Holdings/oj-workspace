import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, Sora } from 'next/font/google';
import './globals.css';

// Manrope for the interface, Sora for headings and figures, Cormorant Garamond only inside OJ Essentials.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });

export const metadata: Metadata = { title: 'OJ Workspace', description: 'One dashboard for OJ Exterior Care, OJ Solutions and OJ Essentials' };
export const viewport: Viewport = { themeColor: '#050914', width: 'device-width', initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${manrope.variable} ${sora.variable} ${cormorant.variable}`}><body>{children}</body></html>;
}
