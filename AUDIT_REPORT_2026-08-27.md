# Audit & Safe Patch Report — MGB Inventory / POS

Tanggal: 2026-08-27

## Prinsip perubahan
- `prisma/dev.db` pada project audit TIDAK diubah.
- Tidak ada reset database.
- Tidak ada `deleteMany` terhadap data transaksi existing sebagai bagian patch.
- Patch schema dibuat additive/SQLite table-copy dan diuji pada salinan database, bukan database asli.
- Data existing pada salinan sebelum migration: Barang 458, OutletStock 268, RecipeItem 11, OutletSale 0, ManufactureOrder 0, Payment 30, PettyCash 13.

## Temuan kritis

### 1. POS Menu Gangnam belum konsisten dengan schema OutletSaleItem
POS utama membuat `OutletSaleItem` untuk menu dengan `barangId: null`, tetapi schema sebelumnya mewajibkan `barangId Int`. Ini dapat membuat checkout menu gagal di Prisma.

**Perbaikan:** `OutletSaleItem.barangId` menjadi optional. Existing sale lines tetap dipertahankan.

### 2. POS void memakai kolom yang belum ada di OutletSale
Route void menggunakan `voidedAt`, `voidedById`, dan `voidReason`, tetapi schema sebelumnya belum mempunyai kolom tersebut.

**Perbaikan:** kolom void ditambahkan secara nullable sehingga transaksi existing tidak berubah. Relation `OutletSaleVoidedBy` juga ditambahkan.

### 3. Ada route POS legacy yang tidak sesuai schema aktif
`app/api/outlet/pos/sales/route.ts` memakai `cashierId`, `tax`, dan `note` yang tidak ada di model `OutletSale`, serta memproses barang langsung sehingga dapat melewati BOM.

**Perbaikan:** GET dibuat sesuai schema aktif; POST legacy tidak lagi melakukan stock deduction langsung dan mengarahkan alur ke POS Menu `/api/outlet/pos`.

### 4. BOM masih menyimpan/menampilkan satuan utama
BOM menu menyimpan `unit` barang utama dan POS menghitung qty BOM langsung terhadap stock utama. Ini salah ketika misalnya `1 pack = 1000 gram`.

**Perbaikan:** dibuat helper pusat `lib/unit-conversion.ts` dan BOM baru dinormalisasi ke satuan dasar. BOM lama tetap kompatibel: jika item lama masih menyimpan satuan utama, POS dan Manufacture akan mengonversinya saat kalkulasi tanpa mengubah data lama.

### 5. POS stock availability belum memperhitungkan conversion
Stock readiness POS sebelumnya menghitung `stock / recipeQty` tanpa memperhatikan satuan BOM.

**Perbaikan:** availability menggunakan base qty lalu dikonversi kembali ke satuan stock utama sebelum menentukan jumlah menu yang dapat dijual.

### 6. Manufacture order belum mengonversi BOM dasar ke satuan stock
Order Manufacture sebelumnya langsung menyimpan `RecipeItem.qty * plannedQty / outputQty` ke `plannedQty`, padahal stock pusat tetap memakai satuan utama.

**Perbaikan:** recipe qty dipahami sebagai satuan dasar, lalu dikonversi ke satuan utama sebelum disimpan sebagai planned consumption. BOM lama dengan unit utama tetap kompatibel.

### 7. Data conversion existing mempunyai satu anomali
Barang `MEA013 / Pork Shoulder Butt Smithfield` mempunyai `unit=kg`, `baseUnit=kg`, tetapi `conversionRate=1000`. Helper pusat memperlakukan conversion sebagai 1 jika main unit dan base unit sama, sehingga anomali ini tidak menyebabkan kalkulasi 1000x. Data master tersebut TIDAK diubah oleh patch.

## Payment & Petty Cash
Audit menemukan data existing yang memang memiliki Payment PENDING/PAID dan petty cash OUT yang terkait sebagian Payment. Patch ini tidak mengubah data finansial existing.

Route pembayaran pusat sudah mempunyai aturan utama:
- CASH/COD/CBD → Payment + Petty Cash OUT
- TRANSFER → Payment tanpa Petty Cash
- TEMPO → Payable, tanpa pembayaran tunai sampai settlement

Karena transaksi finansial existing sudah ada, patch tidak melakukan rekonsiliasi otomatis yang berisiko menggandakan atau menghapus transaksi.

## Waste / Delivery / Stock
Route waste dan delivery tetap menggunakan basis stock transaksi utama. Ini dipertahankan agar data stock existing tidak berubah. Conversion helper dipusatkan pada BOM/Manufacture/POS yang memang membutuhkan perhitungan resep dasar.

## Migration
File:
`prisma/migrations/20260827190000_fix_pos_menu_item_optional/migration.sql`

Migration diuji pada salinan `dev.db` dan berhasil mengubah:
- `OutletSaleItem.barangId` menjadi nullable
- mempertahankan seluruh row existing
- menambahkan `OutletSale.voidedAt`
- menambahkan `OutletSale.voidedById`
- menambahkan `OutletSale.voidReason`

Tidak ada row existing pada database audit yang hilang saat test migration.

## File inti yang dipatch
- `lib/unit-conversion.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260827190000_fix_pos_menu_item_optional/migration.sql`
- `app/api/menu/[id]/bom/route.ts`
- `app/api/outlet/pos/route.ts`
- `app/api/outlet/pos/sales/route.ts`
- `app/api/outlet/pos/sales/[id]/void/route.ts`
- `app/api/manufacture/recipes/route.ts`
- `app/api/manufacture/orders/route.ts`
- `app/(erp)/menu/page.tsx`
- `app/(erp)/manufacture/page.tsx`

## Data safety
Patch bekerja terhadap code/schema. `prisma/dev.db` asli dari ZIP audit tidak disentuh. Jangan menjalankan `prisma db push --force-reset`, `migrate reset`, atau script seed yang menghapus data pada database production/current.
