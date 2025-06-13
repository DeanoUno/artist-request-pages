const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');

// This is your artist config Google Sheet ID (static)
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';

async function getArtistConfig(artistId) {
const keyPath = path.resolve(__dirname, '_secrets/service_account.json');
  console.log("🔍 __dirname:", __dirname);
  console.log("🔍 keyPath:", keyPath);

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
  const match = rows.find(r => (r.artistId || '').trim() === artistId.trim());

  if (!match) {
    throw new Error(`❌ Artist ID '${artistId}' not found in config`);
  }

  return {
    sheetId: match.songListSheetId,
    pushoverToken: match.pushoverToken,
    pushoverUserKey: match.pushoverUserKey,
    telegramChatId: match.telegramChatId
  };
}

module.exports = { getArtistConfig };
