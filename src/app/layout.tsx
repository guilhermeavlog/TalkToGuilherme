import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Talk to Guilherme',
  description: 'Ask Guilherme anything — his AI avatar will answer you verbally.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
