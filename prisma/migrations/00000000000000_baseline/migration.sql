-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "outletId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeen" DATETIME,
    CONSTRAINT "User_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Outlet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutletStockOut" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "userId" INTEGER,
    "trxDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qtyProcessed" REAL NOT NULL,
    "wasteQty" REAL NOT NULL DEFAULT 0,
    "netQty" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    CONSTRAINT "OutletStockOut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletStockOut_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletStockOut_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletTransfer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "sourceOutletId" INTEGER,
    "outletId" INTEGER NOT NULL,
    "transferDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletTransfer_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletTransfer_sourceOutletId_fkey" FOREIGN KEY ("sourceOutletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "tempoDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Barang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL,
    "baseUnit" TEXT,
    "conversionRate" REAL NOT NULL DEFAULT 1,
    "minimumStock" REAL NOT NULL DEFAULT 0,
    "stock" REAL NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL DEFAULT 0,
    "hasExpired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiredWarning" INTEGER NOT NULL DEFAULT 30,
    "source" TEXT NOT NULL DEFAULT 'CENTRAL',
    "sourceOutletId" INTEGER,
    CONSTRAINT "Barang_sourceOutletId_fkey" FOREIGN KEY ("sourceOutletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BarangBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiredDate" DATETIME NOT NULL,
    "qty" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BarangBatch_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "remarks" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletPurchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "remarks" TEXT,
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletPurchase_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletPurchaseItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    "price" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "OutletPurchaseItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletPurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OutletPurchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseId" INTEGER,
    "outletPurchaseId" INTEGER,
    "userId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseComment_outletPurchaseId_fkey" FOREIGN KEY ("outletPurchaseId") REFERENCES "OutletPurchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseComment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "purchaseId" INTEGER,
    "outletPurchaseId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" REAL NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "accountId" INTEGER,
    "referenceNumber" TEXT,
    "note" TEXT,
    "createdBy" INTEGER,
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PettyCashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_outletPurchaseId_fkey" FOREIGN KEY ("outletPurchaseId") REFERENCES "OutletPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PettyCash" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "trxDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" REAL NOT NULL DEFAULT 0,
    "balanceBefore" REAL NOT NULL DEFAULT 0,
    "balanceAfter" REAL NOT NULL DEFAULT 0,
    "accountId" INTEGER,
    "paymentId" INTEGER,
    "outletId" INTEGER,
    "createdBy" INTEGER,
    "approvedBy" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PettyCash_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PettyCash_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PettyCashAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PettyCashAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" REAL NOT NULL DEFAULT 0,
    "currentBalance" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "outletId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PettyCashAccount_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletReceipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "outletId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "receiptDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletReceipt_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OutletPurchase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletReceiptItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "OutletReceiptItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "OutletReceipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outletId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "stock" REAL NOT NULL DEFAULT 0,
    "minimumStock" REAL NOT NULL DEFAULT 0,
    "averageCost" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletStock_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletStock_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletBarang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "outletId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "harga" REAL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutletBarang_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutletBarang_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletSale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "outletId" INTEGER NOT NULL,
    "userId" INTEGER,
    "customerName" TEXT,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "changeAmount" REAL NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voidedAt" DATETIME,
    "voidedBy" INTEGER,
    "voidReason" TEXT,
    "voidedById" INTEGER,
    CONSTRAINT "OutletSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSale_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletSaleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saleId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "menuId" INTEGER,
    "qty" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "OutletSaleItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "OutletSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "purchaseId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "receiptDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Receipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Receipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "ReceiptItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "outletId" INTEGER,
    "deliveryDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "totalQty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "voidedBy" INTEGER,
    CONSTRAINT "Delivery_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deliveryId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" DATETIME,
    "voidedById" INTEGER,
    "voidReason" TEXT,
    CONSTRAINT "DeliveryItem_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuratJalan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "driver" TEXT,
    "vehicleNumber" TEXT,
    "expedition" TEXT,
    "receiver" TEXT,
    "receiveDate" DATETIME,
    "note" TEXT,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SuratJalan_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "trxDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trxType" TEXT NOT NULL,
    "trxNumber" TEXT NOT NULL,
    "referenceId" INTEGER,
    "warehouse" TEXT DEFAULT 'MAIN',
    "qtyIn" REAL NOT NULL DEFAULT 0,
    "qtyOut" REAL NOT NULL DEFAULT 0,
    "balance" REAL NOT NULL,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "totalValue" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockCard_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MutationStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "barangId" INTEGER NOT NULL,
    "fromWarehouse" TEXT NOT NULL,
    "toWarehouse" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "mutationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MutationStock_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "stock" REAL NOT NULL DEFAULT 0,
    "reservedStock" REAL NOT NULL DEFAULT 0,
    "availableStock" REAL NOT NULL DEFAULT 0,
    "minimumStock" REAL NOT NULL DEFAULT 0,
    "maximumStock" REAL NOT NULL DEFAULT 0,
    "lastPurchase" REAL NOT NULL DEFAULT 0,
    "averageCost" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inventory_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockOpname" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'WEEKLY',
    "status" TEXT NOT NULL DEFAULT 'COUNTING',
    "createdBy" INTEGER,
    "approvedBy" INTEGER,
    "outletId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockOpname_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockOpnameItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "systemQty" REAL NOT NULL,
    "physicalQty" REAL NOT NULL DEFAULT 0,
    "difference" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "StockOpnameItem_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "adjustmentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "type" TEXT NOT NULL DEFAULT 'IN',
    "reason" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdjustmentItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adjustmentId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "price" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'IN',
    CONSTRAINT "AdjustmentItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdjustmentItem_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "Adjustment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "History" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionType" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "History_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "photo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" DATETIME,
    "checkOut" DATETIME,
    "photoIn" TEXT,
    "photoOut" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiredDate" DATETIME NOT NULL,
    "qty" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchStock_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMutation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "stockBefore" REAL NOT NULL,
    "stockAfter" REAL NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMutation_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Company" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "npwp" TEXT,
    "director" TEXT,
    "footer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentNumber" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StockOpnameHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "opnameId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "systemQty" REAL NOT NULL,
    "physicalQty" REAL NOT NULL,
    "difference" REAL NOT NULL,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockOpnameHistory_opnameId_fkey" FOREIGN KEY ("opnameId") REFERENCES "StockOpname" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockOpnameHistory_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MasterHarga" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "purchaseId" INTEGER,
    "purchaseItemId" INTEGER,
    "poNumber" TEXT,
    "hargaLama" REAL NOT NULL,
    "hargaBaru" REAL NOT NULL,
    "selisihHarga" REAL NOT NULL DEFAULT 0,
    "persenNaik" REAL NOT NULL DEFAULT 0,
    "qty" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "akumulasi" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "receiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterHarga_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MasterHarga_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchasePayable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchaseId" INTEGER,
    "outletPurchaseId" INTEGER,
    "supplierId" INTEGER NOT NULL,
    "outletId" INTEGER,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "amount" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "outstanding" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OUTSTANDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchasePayable_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchasePayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchasePayable_outletPurchaseId_fkey" FOREIGN KEY ("outletPurchaseId") REFERENCES "OutletPurchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchasePayable_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "barangId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "lastPrice" REAL NOT NULL DEFAULT 0,
    "averagePrice" REAL NOT NULL DEFAULT 0,
    "highestPrice" REAL NOT NULL DEFAULT 0,
    "lowestPrice" REAL NOT NULL DEFAULT 0,
    "totalPurchase" REAL NOT NULL DEFAULT 0,
    "lastReceiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriceSummary_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PriceSummary_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutletTransferItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transferId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "receivedQty" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "OutletTransferItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OutletTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "OutletTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastReadAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "image" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductCK" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "outputBarangId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductCK_outputBarangId_fkey" FOREIGN KEY ("outputBarangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "menuId" INTEGER,
    "productCkId" INTEGER,
    "outputBarangId" INTEGER,
    "outputQty" REAL NOT NULL DEFAULT 1,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipe_outputBarangId_fkey" FOREIGN KEY ("outputBarangId") REFERENCES "Barang" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recipe_productCkId_fkey" FOREIGN KEY ("productCkId") REFERENCES "ProductCK" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Recipe_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipeId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "qty" REAL NOT NULL,
    "unit" TEXT,
    CONSTRAINT "RecipeItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManufactureOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "plannedQty" REAL NOT NULL,
    "producedQty" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "productionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManufactureOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ManufactureOrder_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManufactureOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "barangId" INTEGER NOT NULL,
    "plannedQty" REAL NOT NULL,
    "actualQty" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ManufactureOrderItem_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManufactureOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ManufactureOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockWaste" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "barangId" INTEGER NOT NULL,
    "userId" INTEGER,
    "trxDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qtyProcessed" REAL NOT NULL,
    "wasteQty" REAL NOT NULL DEFAULT 0,
    "netQty" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "totalCost" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "approvedBy" INTEGER,
    "approvedAt" DATETIME,
    CONSTRAINT "StockWaste_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockWaste_barangId_fkey" FOREIGN KEY ("barangId") REFERENCES "Barang" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Outlet_code_key" ON "Outlet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OutletStockOut_number_key" ON "OutletStockOut"("number");

-- CreateIndex
CREATE INDEX "OutletStockOut_outletId_idx" ON "OutletStockOut"("outletId");

-- CreateIndex
CREATE INDEX "OutletStockOut_barangId_idx" ON "OutletStockOut"("barangId");

-- CreateIndex
CREATE INDEX "OutletStockOut_trxDate_idx" ON "OutletStockOut"("trxDate");

-- CreateIndex
CREATE INDEX "OutletStockOut_type_idx" ON "OutletStockOut"("type");

-- CreateIndex
CREATE INDEX "OutletStockOut_status_idx" ON "OutletStockOut"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OutletTransfer_number_key" ON "OutletTransfer"("number");

-- CreateIndex
CREATE INDEX "OutletTransfer_sourceOutletId_idx" ON "OutletTransfer"("sourceOutletId");

-- CreateIndex
CREATE INDEX "OutletTransfer_outletId_idx" ON "OutletTransfer"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Barang_code_key" ON "Barang"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Barang_barcode_key" ON "Barang"("barcode");

-- CreateIndex
CREATE INDEX "Barang_source_idx" ON "Barang"("source");

-- CreateIndex
CREATE INDEX "Barang_sourceOutletId_idx" ON "Barang"("sourceOutletId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_number_key" ON "Purchase"("number");

-- CreateIndex
CREATE UNIQUE INDEX "OutletPurchase_number_key" ON "OutletPurchase"("number");

-- CreateIndex
CREATE INDEX "OutletPurchase_outletId_idx" ON "OutletPurchase"("outletId");

-- CreateIndex
CREATE INDEX "OutletPurchase_supplierId_idx" ON "OutletPurchase"("supplierId");

-- CreateIndex
CREATE INDEX "OutletPurchase_paymentMethod_idx" ON "OutletPurchase"("paymentMethod");

-- CreateIndex
CREATE INDEX "OutletPurchaseItem_purchaseId_idx" ON "OutletPurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "OutletPurchaseItem_barangId_idx" ON "OutletPurchaseItem"("barangId");

-- CreateIndex
CREATE INDEX "PurchaseComment_purchaseId_idx" ON "PurchaseComment"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseComment_outletPurchaseId_idx" ON "PurchaseComment"("outletPurchaseId");

-- CreateIndex
CREATE INDEX "PurchaseComment_userId_idx" ON "PurchaseComment"("userId");

-- CreateIndex
CREATE INDEX "PurchaseComment_createdAt_idx" ON "PurchaseComment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");

-- CreateIndex
CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX "Payment_outletPurchaseId_idx" ON "Payment"("outletPurchaseId");

-- CreateIndex
CREATE INDEX "Payment_supplierId_idx" ON "Payment"("supplierId");

-- CreateIndex
CREATE INDEX "Payment_accountId_idx" ON "Payment"("accountId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCash_number_key" ON "PettyCash"("number");

-- CreateIndex
CREATE INDEX "PettyCash_accountId_idx" ON "PettyCash"("accountId");

-- CreateIndex
CREATE INDEX "PettyCash_trxDate_idx" ON "PettyCash"("trxDate");

-- CreateIndex
CREATE INDEX "PettyCash_type_idx" ON "PettyCash"("type");

-- CreateIndex
CREATE INDEX "PettyCash_category_idx" ON "PettyCash"("category");

-- CreateIndex
CREATE INDEX "PettyCash_paymentId_idx" ON "PettyCash"("paymentId");

-- CreateIndex
CREATE INDEX "PettyCash_outletId_idx" ON "PettyCash"("outletId");

-- CreateIndex
CREATE INDEX "PettyCash_status_idx" ON "PettyCash"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashAccount_code_key" ON "PettyCashAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashAccount_outletId_key" ON "PettyCashAccount"("outletId");

-- CreateIndex
CREATE INDEX "PettyCashAccount_code_idx" ON "PettyCashAccount"("code");

-- CreateIndex
CREATE INDEX "PettyCashAccount_isActive_idx" ON "PettyCashAccount"("isActive");

-- CreateIndex
CREATE INDEX "PettyCashAccount_outletId_idx" ON "PettyCashAccount"("outletId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletReceipt_number_key" ON "OutletReceipt"("number");

-- CreateIndex
CREATE INDEX "OutletReceipt_outletId_idx" ON "OutletReceipt"("outletId");

-- CreateIndex
CREATE INDEX "OutletReceipt_purchaseId_idx" ON "OutletReceipt"("purchaseId");

-- CreateIndex
CREATE INDEX "OutletReceiptItem_receiptId_idx" ON "OutletReceiptItem"("receiptId");

-- CreateIndex
CREATE INDEX "OutletReceiptItem_barangId_idx" ON "OutletReceiptItem"("barangId");

-- CreateIndex
CREATE INDEX "OutletStock_outletId_idx" ON "OutletStock"("outletId");

-- CreateIndex
CREATE INDEX "OutletStock_barangId_idx" ON "OutletStock"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletStock_outletId_barangId_key" ON "OutletStock"("outletId", "barangId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletBarang_outletId_barangId_key" ON "OutletBarang"("outletId", "barangId");

-- CreateIndex
CREATE UNIQUE INDEX "OutletSale_number_key" ON "OutletSale"("number");

-- CreateIndex
CREATE INDEX "OutletSale_outletId_idx" ON "OutletSale"("outletId");

-- CreateIndex
CREATE INDEX "OutletSale_userId_idx" ON "OutletSale"("userId");

-- CreateIndex
CREATE INDEX "OutletSale_saleDate_idx" ON "OutletSale"("saleDate");

-- CreateIndex
CREATE INDEX "OutletSale_status_idx" ON "OutletSale"("status");

-- CreateIndex
CREATE INDEX "OutletSaleItem_saleId_idx" ON "OutletSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "OutletSaleItem_barangId_idx" ON "OutletSaleItem"("barangId");

-- CreateIndex
CREATE INDEX "OutletSaleItem_menuId_idx" ON "OutletSaleItem"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_number_key" ON "Receipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_number_key" ON "Delivery"("number");

-- CreateIndex
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryItem_barangId_idx" ON "DeliveryItem"("barangId");

-- CreateIndex
CREATE INDEX "DeliveryItem_voided_idx" ON "DeliveryItem"("voided");

-- CreateIndex
CREATE INDEX "DeliveryItem_voidedById_idx" ON "DeliveryItem"("voidedById");

-- CreateIndex
CREATE UNIQUE INDEX "SuratJalan_number_key" ON "SuratJalan"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SuratJalan_deliveryId_key" ON "SuratJalan"("deliveryId");

-- CreateIndex
CREATE INDEX "StockCard_barangId_idx" ON "StockCard"("barangId");

-- CreateIndex
CREATE INDEX "StockCard_trxDate_idx" ON "StockCard"("trxDate");

-- CreateIndex
CREATE UNIQUE INDEX "MutationStock_number_key" ON "MutationStock"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_barangId_key" ON "Inventory"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "StockOpname_code_key" ON "StockOpname"("code");

-- CreateIndex
CREATE INDEX "StockOpname_outletId_idx" ON "StockOpname"("outletId");

-- CreateIndex
CREATE INDEX "StockOpname_type_idx" ON "StockOpname"("type");

-- CreateIndex
CREATE INDEX "StockOpname_status_idx" ON "StockOpname"("status");

-- CreateIndex
CREATE INDEX "StockOpname_date_idx" ON "StockOpname"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Adjustment_number_key" ON "Adjustment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nik_key" ON "Employee"("nik");

-- CreateIndex
CREATE INDEX "BatchStock_barangId_idx" ON "BatchStock"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNumber_type_period_key" ON "DocumentNumber"("type", "period");

-- CreateIndex
CREATE INDEX "MasterHarga_barangId_idx" ON "MasterHarga"("barangId");

-- CreateIndex
CREATE INDEX "MasterHarga_supplierId_idx" ON "MasterHarga"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayable_purchaseId_key" ON "PurchasePayable"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayable_outletPurchaseId_key" ON "PurchasePayable"("outletPurchaseId");

-- CreateIndex
CREATE INDEX "PurchasePayable_purchaseId_idx" ON "PurchasePayable"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchasePayable_outletPurchaseId_idx" ON "PurchasePayable"("outletPurchaseId");

-- CreateIndex
CREATE INDEX "PurchasePayable_supplierId_idx" ON "PurchasePayable"("supplierId");

-- CreateIndex
CREATE INDEX "PurchasePayable_outletId_idx" ON "PurchasePayable"("outletId");

-- CreateIndex
CREATE INDEX "PurchasePayable_status_idx" ON "PurchasePayable"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSummary_barangId_key" ON "PriceSummary"("barangId");

-- CreateIndex
CREATE INDEX "PriceSummary_supplierId_idx" ON "PriceSummary"("supplierId");

-- CreateIndex
CREATE INDEX "OutletTransferItem_transferId_idx" ON "OutletTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "OutletTransferItem_barangId_idx" ON "OutletTransferItem"("barangId");

-- CreateIndex
CREATE INDEX "ChatConversation_updatedAt_idx" ON "ChatConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatParticipant_conversationId_idx" ON "ChatParticipant"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatParticipant_conversationId_userId_key" ON "ChatParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_readAt_idx" ON "ChatMessage"("readAt");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_Menu_1" ON "Menu"("code");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "Menu_category_idx" ON "Menu"("category");

-- CreateIndex
CREATE INDEX "Menu_active_idx" ON "Menu"("active");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_ProductCK_1" ON "ProductCK"("code");
Pragma writable_schema=0;

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_ProductCK_2" ON "ProductCK"("outputBarangId");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "ProductCK_active_idx" ON "ProductCK"("active");

-- CreateIndex
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_Recipe_1" ON "Recipe"("code");
Pragma writable_schema=0;

-- CreateIndex
CREATE INDEX "Recipe_menuId_idx" ON "Recipe"("menuId");

-- CreateIndex
CREATE INDEX "Recipe_productCkId_idx" ON "Recipe"("productCkId");

-- CreateIndex
CREATE INDEX "Recipe_outputBarangId_idx" ON "Recipe"("outputBarangId");

-- CreateIndex
CREATE INDEX "Recipe_active_idx" ON "Recipe"("active");

-- CreateIndex
CREATE INDEX "Recipe_menuId_productCkId_idx" ON "Recipe"("menuId", "productCkId");

-- CreateIndex
CREATE INDEX "RecipeItem_recipeId_idx" ON "RecipeItem"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeItem_barangId_idx" ON "RecipeItem"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "ManufactureOrder_number_key" ON "ManufactureOrder"("number");

-- CreateIndex
CREATE INDEX "ManufactureOrder_recipeId_idx" ON "ManufactureOrder"("recipeId");

-- CreateIndex
CREATE INDEX "ManufactureOrder_productionDate_idx" ON "ManufactureOrder"("productionDate");

-- CreateIndex
CREATE INDEX "ManufactureOrder_status_idx" ON "ManufactureOrder"("status");

-- CreateIndex
CREATE INDEX "ManufactureOrder_createdBy_idx" ON "ManufactureOrder"("createdBy");

-- CreateIndex
CREATE INDEX "ManufactureOrderItem_orderId_idx" ON "ManufactureOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ManufactureOrderItem_barangId_idx" ON "ManufactureOrderItem"("barangId");

-- CreateIndex
CREATE UNIQUE INDEX "StockWaste_number_key" ON "StockWaste"("number");

-- CreateIndex
CREATE INDEX "StockWaste_barangId_idx" ON "StockWaste"("barangId");

-- CreateIndex
CREATE INDEX "StockWaste_trxDate_idx" ON "StockWaste"("trxDate");

-- CreateIndex
CREATE INDEX "StockWaste_type_idx" ON "StockWaste"("type");

-- CreateIndex
CREATE INDEX "StockWaste_status_idx" ON "StockWaste"("status");

