const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');
const fs = require('fs');

// This is your artist config Google Sheet ID (static)
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';

async function getArtistConfig(artistId) {
const keyPath = path.resolve(__dirname, '../secrets/service_account.json');
  const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

console.log("📄 Connecting to config sheet");

const doc = new GoogleSpreadsheet(CONFIG_SHEET_ID);
await doc.useServiceAccountAuth(creds);
console.log("🔑 Authenticated successfully");

await doc.loadInfo();
console.log("📃 Sheet titles loaded:", Object.keys(doc.sheetsByTitle));

const sheet = doc.sheetsByTitle['config'];
if (!sheet) {
  throw new Error("❌ 'config' sheet not found in config doc");
}

const rows = await sheet.getRows();
console.log(`📦 Found ${rows.length} config rows`);

const row = rows.find(r => r.artistId?.trim().toLowerCase() === artistId.trim().toLowerCase());

  if (!row) {
    throw new Error(`Artist config not found for: ${artistId}`);
  }

return {
  sheetId: row.songListSheetId?.trim(), // 👈 corrected
  pushoverToken: row.pushoverToken?.trim(),
  pushoverUserKey: row.pushoverUserKey?.trim(),
  telegramChatId: row.telegramChatId?.trim()
};
}

module.exports = { getArtistConfig };
