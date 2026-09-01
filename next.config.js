/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  // Make sure the official LB-0489 template is bundled into the serverless
  // function so the fill route can read it from disk on Vercel.
  outputFileTracingIncludes: {
    '/api/hr-forms/lb0489': ['./public/forms/lb0489.pdf'],
    '/api/onboarding/w8ben': ['./public/forms/w8ben.pdf'],
    // The general-letter importer drives pdf.js directly to keep italic/bold.
    '/api/offers/extract': ['./node_modules/pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js'],
  },
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
