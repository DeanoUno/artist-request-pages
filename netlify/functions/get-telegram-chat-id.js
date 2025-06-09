const fetch = require('node-fetch');

exports.handler = async (event) => {
  const BOT_TOKEN = '8054718848:AAG0WWR72SXnkUq8wY3VYQrwRSIfcYBPz4E';
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;

  const res = await fetch(url);
  const data = await res.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data, null, 2),
  };
};
