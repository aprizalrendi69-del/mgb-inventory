const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "prisma", "dev.db");
const backupDir = path.join(root, "backups", "pre-migrate");

if (!fs.existsSync(dbPath)) {
  console.error(`Database tidak ditemukan: ${dbPath}`);
  console.error("Tidak ada database yang disentuh. Pastikan dev.db adalah database aktif Anda.");
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `dev.db.${stamp}.backup`);
fs.copyFileSync(dbPath, backupPath);
console.log(`Backup database dibuat: ${backupPath}`);
console.log("Menjalankan Prisma migrate deploy tanpa reset database...");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["--no-install", "prisma", "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  console.error("Migration gagal. Backup asli tetap tersedia:", backupPath);
  process.exit(result.status ?? 1);
}

console.log("Migration selesai. Database tidak di-reset.");
