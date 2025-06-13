const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');
const fs = require('fs');

// This is your artist config Google Sheet ID (static)
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';

async function getArtistConfig(artistId) {
const keyPath = './netlify/functions/secrets/service_account.json';
  const creds = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

  const doc = new GoogleSpreadsheet(CONFIG_SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle['Config'];
  const rows = await sheet.getRows();

  const row = rows.find(r => r.artistId?.trim().toLowerCase() === artistId.trim().toLowerCase());

  if (!row) {
    throw new Error(`Artist config not found for: ${artistId}`);
  }

  return {
    sheetId: row.sheetId?.trim(),
    pushoverToken: row.pushoverToken?.trim(),
    pushoverUserKey: row.pushoverUserKey?.trim(),
    telegramChatId: row.telegramChatId?.trim()
  };
}

module.exports = { getArtistConfig };
