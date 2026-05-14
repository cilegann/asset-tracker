const db = require('./db');
const path = require('path');
const fs = require('fs');

// 建立 backups 資料夾 (如果不存在)
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `data_backup_${timestamp}.db`);

console.log('🚀 正在啟動資料庫線上備份...');

db.backup(backupPath)
  .then(() => {
    console.log('----------------------------------------');
    console.log('✅ 備份成功！');
    console.log(`位置: ${backupPath}`);
    console.log('----------------------------------------');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 備份過程中發生錯誤:');
    console.error(err);
    process.exit(1);
  });
