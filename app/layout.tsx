/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "百言 AI",
  description:
    "专业 AI 创作工具，快速用上世界先进 AI，极大提高生活工作效率。支持各类高质量模型，助你创造无与伦比的内容。",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
  appleWebApp: {
    title: "百言 AI",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="config" content={JSON.stringify(getClientConfig())} />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script src="/serviceWorkerRegister.js" defer></script>
        <script
          charSet="UTF-8"
          id="LA_COLLECT"
          src="//sdk.51.la/js-sdk-pro.min.js"
          defer
        ></script>
        <script
          defer
          dangerouslySetInnerHTML={{
            __html: `LA.init({id:"3Ktn7HQCjAwa7NMl",ck:"3Ktn7HQCjAwa7NMl",autoTrack:true,hashMode:true})`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
