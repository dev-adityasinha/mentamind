import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Mentamind — Foundation Assistance Platform',
  description: 'Humanitarian blood donation and free medicine support system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="antialiased" style={{ fontFamily: 'var(--font-sans)' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
