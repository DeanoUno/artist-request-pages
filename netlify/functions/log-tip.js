const { GoogleSpreadsheet } = require('google-spreadsheet');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    const { artistId, tipMethod, timestamp } = JSON.parse(event.body);

    // Load artist config
    const configRes = await fetch(`https://opensheet.elk.sh/14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c/config`);
    const artists = await configRes.json();
    const artist = artists.find(a => a.artistId === artistId);
    if (!artist || !artist.tipLogSheetId) throw new Error('Artist config not found or missing tipLogSheetId');

    // Authenticate with Google Sheets
    const doc = new GoogleSpreadsheet(artist.tipLogSheetId);
    await doc.useServiceAccountAuth({
      client_email: process.env.GS_CLIENT_EMAIL,
      private_key: process.env.GS_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Tips'] || (await doc.addSheet({ title: 'Tips', headerValues: ['Timestamp', 'Method'] }));
    await sheet.addRow({ Timestamp: timestamp, Method: tipMethod });

    // Telegram or Pushover notification
    const message = `🎁 Someone clicked the ${tipMethod} tip button for ${artist.displayName}`;
    if (artist.telegramChatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: artist.telegramChatId,
          text: message,
        }),
      });
    } else if (artist.pushoverUserKey) {
      await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body: new URLSearchParams({
          token: process.env.PUSHOVER_API_TOKEN,
          user: artist.pushoverUserKey,
          message: message,
        }),
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
