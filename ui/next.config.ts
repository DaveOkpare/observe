/** @type {import('next').NextConfig} */

const nextConfig = {
  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/traces/overview",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
