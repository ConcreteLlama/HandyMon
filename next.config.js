/** @type {import('next').NextConfig} */
const nextConfig = {
  // Traces the real runtime require() graph and copies only what's actually
  // used into .next/standalone/node_modules — a raw `npm install --omit=dev`
  // ships e.g. all of @mui/icons-material (94MB, one file per icon) when the
  // app only imports a handful.
  output: 'standalone',
};

module.exports = nextConfig;
