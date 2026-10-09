import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RapiCure AI - Pre-OPD Medical Triage & Voice Scribe",
  description:
    "High-volume hospital pre-OPD clinical triage assistant synthesizing bilingual voice complaints, nursing vitals, and lab reports into structured SOAP briefings with risk stratification.",
  openGraph: {
    title: "RapiCure AI - Pre-OPD Medical Triage & Voice Scribe",
    description:
      "High-volume hospital pre-OPD clinical triage assistant synthesizing bilingual voice complaints, nursing vitals, and lab reports into structured SOAP briefings with risk stratification.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
