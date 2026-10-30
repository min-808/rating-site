import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // dev only: lets a phone on the home wifi open `next dev` by the computer's address.
  // without it the dev scripts are blocked and nothing on the page runs (no milestone
  // banner, no filters button). has no effect on the deployed site
  allowedDevOrigins: ['192.168.4.*'],
};

export default nextConfig;
