const fs = require('fs');
const path = require('path');

const content = process.env.GOOGLE_CREDS_SANIBEL_SONG;

if (!content) {
  console.error('❌ Missing GOOGLE_CREDS_SANIBEL_SONG environment variable.');
  process.exit(1);
}

const filePath = path.join(__dirname, 'functions', 'credentials.json');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ credentials.json written successfully for Netlify Functions.');
