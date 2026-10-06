import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RapiCure | Pre-OPD Smart Triage & Voice Scribe (AIIMS Jodhpur)",
  description:
    "Pre-consultation vernacular medical scribe & smart triage system powered by Gemini 2.0 Flash for Indian OPDs.",
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
