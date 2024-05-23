/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '**'
      }
    ]
  },
  typescript: {
    
    ignoreBuildErrors: true,
  },
  env: {
    OPEN_API_KEY: process.env.OPEN_API_KEY,
  },
}
