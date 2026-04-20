import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },            // Spotify album art
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" }, // Vercel Blob
      { protocol: "https", hostname: "replicate.delivery" },   // Replicate output frames
    ],
  },
};

export default nextConfig;
