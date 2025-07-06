// load-config.js
const { google } = require('googleapis');
const sheets = google.sheets('v4');

exports.handler = async function(event) {
  const artistId = event.queryStringParameters.artist_id || '';
  if (!artistId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing artist_id parameter' })
    };
  }

  const sheetId = process.env.ARTIST_CONFIG_SHEET_ID;
  const apiUrl = `https://opensheet.elk.sh/${sheetId}/config`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    const artist = data.find(row => row.artistId?.toLowerCase() === artistId.toLowerCase());

    if (!artist) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Artist not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(artist)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load artist config', details: err.message })
    };
  }
};
