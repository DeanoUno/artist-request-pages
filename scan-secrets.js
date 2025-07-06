const fs = require('fs');
const path = require('path');

const keywordRegex = /\b(token|key|secret|id)\b/i;
const longStringRegex = /[A-Za-z0-9._-]{30,}/;

const matches = [];

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    if (keywordRegex.test(line) && longStringRegex.test(line)) {
      matches.push({
        file: filePath,
        line: idx + 1,
        content: line.trim()
      });
    }
  });
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.match(/\.(js|json|env)$/)) {
      scanFile(fullPath);
    }
  });
}

// Run scan
console.log('🔍 Running focused secret scan...\n');
walk('.');

// Output
if (matches.length === 0) {
  console.log('✅ No hardcoded secrets found matching the criteria.\n');
} else {
  matches.forEach(match => {
    console.log(`🚨 ${match.file}:${match.line}`);
    console.log(`   ${match.content}\n`);
  });

  // Optional: also write to a log file
  fs.writeFileSync('secret-scan-report.txt',
    matches.map(m => `${m.file}:${m.line} → ${m.content}`).join('\n'),
    'utf8'
  );
  console.log(`📝 Logged to secret-scan-report.txt`);
}
