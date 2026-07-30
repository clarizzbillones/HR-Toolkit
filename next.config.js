/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  // Make sure the official LB-0489 template is bundled into the serverless
  // function so the fill route can read it from disk on Vercel.
  outputFileTracingIncludes: {
    '/api/hr-forms/lb0489': ['./public/forms/lb0489.pdf'],
  },
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
