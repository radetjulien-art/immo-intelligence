/** @type {import('next').NextConfig} */
const nextConfig = {
  // No rewrite proxy needed — axios calls http://localhost:8000 directly from the browser
};

module.exports = nextConfig;
