import type { NextConfig } from "next";

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
			"connect-src 'self' https://cdn.jsdelivr.net blob: data:",
			"media-src 'self' blob: data:",
			"img-src 'self' data: blob:",
			"worker-src 'self' blob:",
			"style-src 'self' 'unsafe-inline'",
			"font-src 'self' data:",
			"object-src 'none'",
			"base-uri 'self'",
			"frame-ancestors 'none'",
		].join("; "),
	},
	{
		key: "Permissions-Policy",
		value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
	},
	{
		key: "Strict-Transport-Security",
		value: "max-age=31536000; includeSubDomains; preload",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
];

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

