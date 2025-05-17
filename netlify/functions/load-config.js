const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  const artistId = event.queryStringParameters.artist_id;

  if (!artistId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing artist_id parameter" }),
    };
  }

  const configURL = "https://opensheet.elk.sh/113QUjjcc72tnxFltbh2e2wcNQ896dwOLv2uG2mrYEsY/config";

  try {
    const response = await fetch(configURL);
    const data = await response.json();

    const artist = data.find((row) => (row.artist_id || '').trim().toLowerCase() === artistId.toLowerCase());

    if (!artist) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Artist not found" }),
      };
    }

    const sheetId = artist.songListSheetId || artist.sheet_id;

    const mappedArtist = {
      artistId: artist.artist_id?.trim(),
      artistName: artist.artistName?.trim(),
      logoUrl: artist.logoUrl?.trim(),
      tipLink: artist.tipLink?.trim(),
      tipSquare: artist.tipSquare?.trim(),
      tipPaypal: artist.tipPaypal?.trim(),
      tipVenmo: artist.tipVenmo?.trim(),
      tipCashapp: artist.tipCashapp?.trim(),
      tipBandcamp: artist.tipBandcamp?.trim(),
      welcomeMessage: artist.welcomeMessage?.trim(),
      thankYouMessage: artist.thankYouMessage?.trim(),
      theme: artist.theme?.trim() || "default",
      songListSheetId: sheetId,
      pushoverUserKey: artist.pushoverUserKey?.trim(),
      pushovertoken: artist.pushover_token?.trim(),
      active: (artist.active || "").trim().toLowerCase() === "true"
    };

    return {
      statusCode: 200,
      body: JSON.stringify(mappedArtist),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch config", details: error.message }),
    };
  }
};
