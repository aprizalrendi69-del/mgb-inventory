import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export async function getCompanyPdfBrand() {
  const company = await prisma.company.findFirst({ orderBy: { id: "asc" } }).catch(() => null);
  let logoBuffer: Buffer | null = null;
  let logoFormat: "PNG" | "JPEG" | null = null;
  const logo = company?.logo?.trim();
  // PDFs only embed local uploads. Do not fetch arbitrary URLs from the server.
  if (logo && logo.startsWith("/uploads/company/")) {
    const filename = path.basename(logo);
    const extension = path.extname(filename).toLowerCase();
    if ([".png", ".jpg", ".jpeg"].includes(extension)) {
      try {
        logoBuffer = await readFile(path.join(process.cwd(), "public", "uploads", "company", filename));
        logoFormat = extension === ".png" ? "PNG" : "JPEG";
      } catch { /* Missing file: keep the company name and render without a logo. */ }
    }
  }
  return {
    name: company?.name?.trim() || "PT. MITRA GARAM BOGATAMA",
    address: company?.address || "",
    city: company?.city || "",
    phone: company?.phone || "",
    email: company?.email || "",
    npwp: company?.npwp || "",
    logoBuffer,
    logoFormat,
  };
}
