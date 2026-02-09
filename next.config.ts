import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: path.join(__dirname, './'), // Adjust the path as needed
  },
};

export default nextConfig;
