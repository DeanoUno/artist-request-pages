const { GoogleSpreadsheet } = require('google-spreadsheet');
const { google } = require('googleapis');
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT || '{}');

// IDs and settings
const CONFIG_SHEET_ID = process.env.ARTIST_CONFIG_SHEET_ID;
const TEMPLATE_SHEET_ID = process.env.TEMPLATE_SHEET_ID;
const CONFIG_TAB_NAME = 'config';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const requiredFields = ['artistId', 'artistName'];
    const missing = requiredFields.filter(f => !data[f]);

    if (missing.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields', missing })
      };
    }

    const artistId = data.artistId.toLowerCase();
    const doc = new GoogleSpreadsheet(CONFIG_SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[CONFIG_TAB_NAME];
    if (!sheet) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Config tab '${CONFIG_TAB_NAME}' not found.` })
      };
    }

    // STEP 1: Copy the blank template
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
    });
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const copiedFile = await drive.files.copy({
      fileId: TEMPLATE_SHEET_ID,
      requestBody: {
        name: `Request Sheet - ${artistId}`
      }
    });

    const newSheetId = copiedFile.data.id;

    // STEP 1.5: Rename the tabs and add welcome tab with artist name
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: newSheetId });
    const songSheet = sheetMeta.data.sheets.find(s => s.properties.title === 'Songs');
const requestSheet = sheetMeta.data.sheets.find(s => s.properties.title === 'Requests');

if (!songSheet || !requestSheet) {
  throw new Error('Songs or Requests tab not found in the copied template.');
}

const songSheetId = songSheet.properties.sheetId;
const requestSheetId = requestSheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: newSheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: songSheetId,
                title: `${artistId}_Songs`
              },
              fields: 'title'
            }
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: requestSheetId,
                title: `${artistId}_Requests`
              },
              fields: 'title'
            }
          },
          {
            addSheet: {
              properties: {
                title: 'Welcome',
                gridProperties: { rowCount: 20, columnCount: 6 },
                tabColor: { red: 1.0, green: 0.9, blue: 0.6 }
              }
            }
          }
        ]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: 'Welcome!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[`🎉 Welcome, ${data.artistName}! Your rQuestify sheet is ready.`]]
      }
    });

    // STEP 2: Add row to config sheet with songListSheetId
    await drive.permissions.create({
      fileId: newSheetId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: 'DuskDuo@gmail.com'
      }
    });

    await sheet.addRow({
      artistId,
      artistName: data.artistName,
      tipVenmo: data.venmo || '',
      tipPaypal: data.paypal || '',
      welcomeMsg: data.welcomeMsg || '',
      telegramChatId: '',
      songListSheetId: newSheetId
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Artist registered, sheet created, and personalized.',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`,
        requestPage: `https://deano-request-page.netlify.app/?artist_id=${artistId}`
      })
    };

  } catch (err) {
    console.error('Registration error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Server error',
        detail: err.message,
        stack: err.stack,
        response: err.response?.data || null
      })
    };
  }
};
