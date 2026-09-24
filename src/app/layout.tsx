import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
	themeColor: "#09090b",
};

const siteUrl =
	process.env.NEXT_PUBLIC_SITE_URL ||
	process.env.SITE_URL ||
	"https://pushup-counter.pages.dev";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: "Push-Up Counter - កម្មវិធីរាប់ Push-Up AI តាមកាមេរ៉ា",
		template: "%s | Push-Up Counter",
	},
	description:
		"Count your push-ups using real-time AI body tracking directly in your browser. Private, secure, with Khmer and English voice coaching. កម្មវិធីរាប់ការធ្វើ Push-Up ស្វ័យប្រវត្តិតាមកាមេរ៉ាដោយប្រើ AI ឥតគិតថ្លៃ និងមានសុវត្ថិភាពខ្ពស់។",
	applicationName: "Push-Up Counter",
	keywords: [
		"Push-Up Counter",
		"Pushup Tracker",
		"AI Workout Counter",
		"Pose Detection",
		"MediaPipe Pushups",
		"Fitness AI",
		"Real-time Rep Counter",
		"កម្មវិធីរាប់ Push-Up",
		"រាប់ Push-Up",
		"រាប់អាវ៉ង់",
		"ហាត់ប្រាណ",
		"កីឡា",
		"AI ហាត់ប្រាណ",
	],
	authors: [{ name: "lymakara-dev" }],
	creator: "lymakara-dev",
	publisher: "lymakara-dev",
	category: "fitness",
	alternates: {
		canonical: "/",
		languages: {
			en: "/",
			km: "/",
			"km-KH": "/",
		},
	},
	openGraph: {
		title: "Push-Up Counter | កម្មវិធីរាប់ Push-Up AI តាមកាមេរ៉ា",
		description:
			"AI-powered real-time push-up tracker & form feedback with Khmer and English voice guide. វីដេអូដំណើរការលើឧបករណ៍ផ្ទាល់ខ្លួន និងមិនត្រូវបានបញ្ជូនចេញក្រៅឡើយ។",
		url: "/",
		siteName: "Push-Up Counter",
		locale: "km_KH",
		alternateLocale: ["en_US"],
		type: "website",
		images: [
			{
				url: "/icon-512.png",
				width: 512,
				height: 512,
				alt: "Push-Up Counter App Icon - កម្មវិធីរាប់ Push-Up",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Push-Up Counter | កម្មវិធីរាប់ Push-Up AI តាមកាមេរ៉ា",
		description:
			"Count push-ups with real-time pose tracking & voice coaching in English and Khmer.",
		images: ["/icon-512.png"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "32x32" },
			{ url: "/favicon.svg", type: "image/svg+xml" },
		],
		apple: [
			{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
		],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<head>
				<script
					async
					src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3566203508983046"
					crossOrigin="anonymous"
				/>
			</head>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}>{children}</body>
		</html>
	);
}
