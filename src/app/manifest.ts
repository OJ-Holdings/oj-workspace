import type { MetadataRoute } from 'next';

/** Makes OJ OS installable: on an iPhone, Share then Add to Home Screen gives an app icon that opens full screen, signed in, with no browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OJ OS',
    short_name: 'OJ OS',
    description: 'The operating system for OJ Holdings: jobs, customers, money and crew.',
    start_url: '/workspace',
    scope: '/',
    display: 'standalone',
    background_color: '#07080b',
    theme_color: '#07080b',
    icons: [{ src: '/brand/exterior-mark.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
    shortcuts: [
      { name: 'Jobs', url: '/workspace/b/exterior/bookings' },
      { name: 'Growth', url: '/workspace/growth' },
      { name: 'Money', url: '/workspace/finance' },
    ],
  };
}
