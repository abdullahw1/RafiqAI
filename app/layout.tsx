import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RafiqAI — Understand confusing bills',
  description:
    'RafiqAI reviews phone, insurance, medical, and other bills in plain language and prepares clear next steps.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
