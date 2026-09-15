# Final Menu / Central Kitchen / Void Patch — 2026-08-26

## Data safety
- Existing `prisma/dev.db` was migrated in-place without resetting or deleting existing business rows.
- Pre-migration database backup: `backups/dev.db.before_menu_bom_20260826.sqlite`.
- Existing row counts and stock totals were checked before/after migration. Existing business tables retained their row counts and key stock totals.

## Final business structure
- `Menu` = POS sellable menu.
- `Recipe` / BOM can target either `Menu` or `ProductCK`.
- `ProductCK` = Central Kitchen production product and points to its stock/output `Barang`.
- `Barang` remains the inventory/material/stock entity.
- Manufacture is restricted to ProductCK BOMs, not POS Menu BOMs.
- POS Gangnam reads Menu master data instead of using Barang names as the menu catalog.
- POS ingredient stock is calculated from the Menu BOM and OutletStock.

## Gangnam menu master
Seeded from the provided POS reference:
ALL YOU CAN EAT, GO CHU JANG SAENG GYEP SAL, DWAE JI GALBI, CRISPY PORK BELLY,
SUNDUBU JJIGAE, KIMCHI, KOCORI, DANMUJI, CHIKIN MU, JAPCHAE, ODENG,
SUJEONGGWA, GIMBAB, BOKKEUMBAP, SAENGCHAE, PAJEON, GIMMARI, MANDU,
HOTTEOK, DONKAS, DWAEJI BULGOGI, AMERICANO, MILK PUDDING, ES CAMPUR MEDAN,
SLICED FRUIT, TTEOKBOKKI, JJAJANGMYEON.

Ingredient quantities were NOT invented. Menus without BOM remain visible but are blocked from zero-price direct sale until their BOM is configured. The AYCE package retains its configured Rp199.000 price.

## Released Delivery Void
`PUT /api/delivery/[id]/items/[itemId]/void`:
- only works for `RELEASED` delivery;
- requires a reason;
- is idempotent per item (`voided` prevents double return);
- restores the voided quantity to Central stock;
- updates Inventory;
- writes `StockCard` and `StockMutation` audit records;
- updates Delivery `totalQty` excluding voided items;
- if a Central-to-Outlet transfer exists, the corresponding transfer line is zeroed and already-received quantity is reversed from OutletStock with an audit StockCard.

## POS Void
POS sale void now reverses the Menu BOM consumption for menu-based sales, while legacy Barang sales still reverse their direct stock line.

## Verification
- Existing business row counts and stock totals were compared before/after migration.
- Fresh application of the new migration was tested against a copy of the original DB.
- The new migration creates Menu/ProductCK and preserves the existing Recipe/output mapping.
- Full Next.js build could not be executed in this environment because the uploaded archive did not contain a complete installed `node_modules` tree and package installation was not available offline.
