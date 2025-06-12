const fs = require('fs');
const path = require('path');

exports.handler = async function () {
  const keyPath = path.join(__dirname, 'secrets', 'service_account.json');

  try {
    const exists = fs.existsSync(keyPath);
    const content = exists ? fs.readFileSync(keyPath, 'utf8').substring(0, 100) + '...' : null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        exists,
        preview: content || 'File not found',
        pathChecked: keyPath,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to check credentials file',
        detail: err.message,
        pathChecked: keyPath,
      }),
    };
  }
};
