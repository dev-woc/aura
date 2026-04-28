import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "i.scdn.co" },
			{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
			{ protocol: "https", hostname: "replicate.delivery" },
			{ protocol: "https", hostname: "pbxt.replicate.delivery" },
		],
	},
};

export default nextConfig;
