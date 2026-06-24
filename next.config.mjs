/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // xlsx is a CommonJS dep; keep it external to the server bundle so it loads cleanly
  // on Azure App Service / Node runtimes.
  experimental: {
    serverComponentsExternalPackages: ["xlsx", "@azure/storage-blob"],
  },
};

export default nextConfig;
