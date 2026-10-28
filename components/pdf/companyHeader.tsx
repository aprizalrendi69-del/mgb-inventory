type Company = {
  name?: string | null;
  logo?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  npwp?: string | null;
};

export default function CompanyHeader({ company }: { company: Company | null | undefined }) {
  const address = [company?.address, company?.city, company?.province, company?.postalCode]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");

  return (
    <div className="mb-6 flex items-center gap-4 border-b border-slate-200 pb-4 print:break-inside-avoid">
      {company?.logo ? (
        <img
          src={company.logo}
          alt={`Logo ${company.name || "perusahaan"}`}
          width={84}
          height={84}
          className="h-20 w-20 shrink-0 object-contain"
          crossOrigin="anonymous"
        />
      ) : null}
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{company?.name || "PT. Mitra Garam Bogatama"}</h1>
        {address && <p className="text-sm">{address}</p>}
        {company?.phone && <p className="text-sm">Telp: {company.phone}</p>}
        {company?.email && <p className="text-sm">Email: {company.email}</p>}
        {company?.website && <p className="text-sm">{company.website}</p>}
        {company?.npwp && <p className="text-sm">NPWP: {company.npwp}</p>}
      </div>
    </div>
  );
}
