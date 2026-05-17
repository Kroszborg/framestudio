import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FrameStudio — Pro Video Editor for Android',
  description: 'Professional mobile video editor with multi-track timeline, 12+ filters, text overlays, audio mixer, and 4K export. Free download — no watermarks.',
  openGraph: {
    title: 'FrameStudio — Pro Video Editor for Android',
    description: 'Professional mobile video editor. Free download.',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FrameStudio — Pro Video Editor for Android',
    description: 'Professional mobile video editor. Free download.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
