/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow DALL-E 3 CDN images to be rendered with next/image
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oaidalleapiprodscus.blob.core.windows.net",
      },
    ],
  },
};

export default nextConfig;
