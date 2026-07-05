/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone: self-contained server bundle (server.js + pruned node_modules)
  // shipped inside the NovaShell native exe and booted by the Rust core
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
