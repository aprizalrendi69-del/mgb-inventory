# MGB ERP Audit / Repair Package

This package is intended to be extracted over the existing `mgb-inventory` project.

## Safety
- No existing application data is intentionally deleted.
- `dev.db` is intentionally NOT included in the repair package so the current database remains in place.
- Before each dev/build/start, `scripts/safe-migrate.js` creates a timestamped DB backup and runs Prisma migrations without reset.
- The migration only adds nullable fields, indexes, makes POS item `barangId` optional while preserving existing rows, and fills missing base-unit metadata without changing stock quantities, and corrects two unambiguous legacy unit definitions (1.75L → 1750ml; 1kg pack stored as kg/1000 → gram/1000).

## Main repaired flows
- POS is scoped by outlet.
- POS BOM consumption uses base-unit conversion and changes only the selected outlet's `OutletStock`.
- POS checkout writes `StockCard` movement so safe void can reverse the exact original stock movement.
- Manufacture Order is outlet-scoped and creation does not change stock; completion changes only the selected outlet's `OutletStock`.
- Manufacture ingredient quantities are stored on the order in base units and converted correctly when applying to existing outlet stock stored in the item's main/display unit.
- Payment supports the existing `PETTY_CASH` UI label by normalizing it to the database method `CASH`, and payable filtering uses the actual PurchasePayable relation.
- Existing legacy recipes without an outlet remain usable for controlled migration; newly created Manufacture recipes are outlet-specific.

## Important deployment
Run `npm install` if dependencies are not already installed, then `npm run dev`. The pre-dev hook will back up and migrate the existing database before starting Next.js.
