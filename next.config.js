/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse 依赖的 pdfjs-dist 不能被 webpack 打包,必须保持 Node.js require
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};

module.exports = nextConfig;