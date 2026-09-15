import Loading from "@/components/loading";

export default function LoadingPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Loading text="Memuat halaman..." />
      </div>
    </div>
  );
}