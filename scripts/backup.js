const fs = require("fs");
const path = require("path");

// =====================================================
// MGB ERP - BACKUP SYSTEM
// =====================================================
//
// Backup yang dibuat:
// 1. prisma/dev.db
// 2. public/uploads/
//
// Backup lama TIDAK DIHAPUS.
//
// Struktur:
//
// backups/
// ├── 2026-08-19_010000/
// │   ├── dev.db
// │   └── uploads/
// ├── 2026-08-20_010000/
// │   ├── dev.db
// │   └── uploads/
// └── ...
//
// =====================================================

// =====================================================
// ROOT PROJECT
// =====================================================

const ROOT_DIR = path.resolve(__dirname, "..");

// =====================================================
// SOURCE
// =====================================================

const DATABASE_SOURCE = path.join(
  ROOT_DIR,
  "prisma",
  "dev.db"
);

const UPLOADS_SOURCE = path.join(
  ROOT_DIR,
  "public",
  "uploads"
);

// =====================================================
// BACKUP DIRECTORY
// =====================================================

const BACKUP_ROOT = path.join(
  ROOT_DIR,
  "backups"
);

// =====================================================
// FORMAT TANGGAL
// =====================================================

function pad(number) {
  return String(number).padStart(2, "0");
}

function getBackupName() {
  const now = new Date();

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());

  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  return `${year}-${month}-${day}_${hour}${minute}${second}`;
}

// =====================================================
// COPY DIRECTORY
// =====================================================

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    console.log(
      `[BACKUP] Folder tidak ditemukan: ${source}`
    );

    return false;
  }

  fs.mkdirSync(destination, {
    recursive: true,
  });

  const entries = fs.readdirSync(source, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const sourcePath = path.join(
      source,
      entry.name
    );

    const destinationPath = path.join(
      destination,
      entry.name
    );

    if (entry.isDirectory()) {
      copyDirectory(
        sourcePath,
        destinationPath
      );
    } else if (entry.isFile()) {
      fs.copyFileSync(
        sourcePath,
        destinationPath
      );
    }
  }

  return true;
}

// =====================================================
// COPY FILE
// =====================================================

function copyFile(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(
      `File tidak ditemukan: ${source}`
    );
  }

  fs.copyFileSync(
    source,
    destination
  );
}

// =====================================================
// MAIN BACKUP
// =====================================================

function runBackup() {
  console.log("");
  console.log(
    "====================================================="
  );
  console.log(
    "              MGB ERP BACKUP SYSTEM"
  );
  console.log(
    "====================================================="
  );
  console.log("");

  // ---------------------------------------------------
  // CEK DATABASE
  // ---------------------------------------------------

  if (!fs.existsSync(DATABASE_SOURCE)) {
    throw new Error(
      `Database MGB tidak ditemukan:\n${DATABASE_SOURCE}`
    );
  }

  // ---------------------------------------------------
  // BUAT FOLDER BACKUP UTAMA
  // ---------------------------------------------------

  fs.mkdirSync(BACKUP_ROOT, {
    recursive: true,
  });

  // ---------------------------------------------------
  // NAMA BACKUP
  // ---------------------------------------------------

  const backupName = getBackupName();

  const backupDirectory = path.join(
    BACKUP_ROOT,
    backupName
  );

  // ---------------------------------------------------
  // BUAT FOLDER BACKUP
  // ---------------------------------------------------

  fs.mkdirSync(backupDirectory, {
    recursive: true,
  });

  console.log(
    `[BACKUP] Folder backup: ${backupName}`
  );

  // ---------------------------------------------------
  // BACKUP DATABASE
  // ---------------------------------------------------

  const databaseDestination = path.join(
    backupDirectory,
    "dev.db"
  );

  console.log(
    "[BACKUP] Membackup database..."
  );

  copyFile(
    DATABASE_SOURCE,
    databaseDestination
  );

  console.log(
    "[BACKUP] Database berhasil dibackup."
  );

  // ---------------------------------------------------
  // BACKUP UPLOADS
  // ---------------------------------------------------

  const uploadsDestination = path.join(
    backupDirectory,
    "uploads"
  );

  console.log(
    "[BACKUP] Membackup folder uploads..."
  );

  const uploadsCopied = copyDirectory(
    UPLOADS_SOURCE,
    uploadsDestination
  );

  if (uploadsCopied) {
    console.log(
      "[BACKUP] Folder uploads berhasil dibackup."
    );
  } else {
    console.log(
      "[BACKUP] Folder uploads belum ada, dilewati."
    );
  }

  // ---------------------------------------------------
  // INFO UKURAN DATABASE
  // ---------------------------------------------------

  const databaseStats =
    fs.statSync(databaseDestination);

  const databaseSizeMB =
    databaseStats.size /
    (1024 * 1024);

  // ---------------------------------------------------
  // HASIL
  // ---------------------------------------------------

  console.log("");
  console.log(
    "====================================================="
  );
  console.log(
    "              BACKUP BERHASIL"
  );
  console.log(
    "====================================================="
  );
  console.log("");

  console.log(
    `Backup : ${backupName}`
  );

  console.log(
    `Lokasi : ${backupDirectory}`
  );

  console.log(
    `Database : ${databaseSizeMB.toFixed(2)} MB`
  );

  console.log("");
  console.log(
    "Backup lama TIDAK dihapus."
  );

  console.log("");
  console.log(
    "====================================================="
  );
  console.log("");
}

// =====================================================
// ERROR HANDLER
// =====================================================

try {
  runBackup();
} catch (error) {
  console.error("");
  console.error(
    "====================================================="
  );
  console.error(
    "              BACKUP GAGAL"
  );
  console.error(
    "====================================================="
  );
  console.error("");

  console.error(
    error?.message || error
  );

  console.error("");
  console.error(
    "====================================================="
  );
  console.error("");

  process.exit(1);
}