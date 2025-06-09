const fetch = require('node-fetch');

exports.handler = async (event) => {
  const BOT_TOKEN = '8054718848:AAG0WWR72SXnkUq8wY3VYQrwRSIfcYBPz4E';
  const { chat_id, message } = JSON.parse(event.body);

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id,
      text: message,
    }),
  });

  const data = await res.json();

  return {
    statusCode: 200,
    body: JSON.stringify(data, null, 2),
  };
};
