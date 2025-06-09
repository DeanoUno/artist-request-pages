const { google } = require('googleapis');

async function getClient() {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT);
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes
  });

  return await auth.getClient();
}

module.exports = { getClient };
