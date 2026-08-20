import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PT.MITRA GARAM BOGATAMA",
  description: "PT. Mitra Garam Bogatama ERP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-100">
        {children}
      </body>
    </html>
  );
}