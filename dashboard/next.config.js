/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        child_process: false,
      }
    }
    // Prevent undici (Firebase dep) from being bundled by webpack
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('undici')
    }
    return config
  },
}

module.exports = nextConfig
