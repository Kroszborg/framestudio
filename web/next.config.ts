import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Serve APK from the /download route
  async headers() {
    return [
      {
        source: '/download/:file',
        headers: [{ key: 'Content-Disposition', value: 'attachment' }],
      },
    ];
  },
};

export default nextConfig;
