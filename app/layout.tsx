import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RafiqAI — Understand a confusing phone bill',
  description:
    'RafiqAI helps caregivers spot charges worth questioning on a family member\'s phone bill, then calls them to explain.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
