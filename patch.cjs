const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// مسح أي مسارات خاطئة
html = html.replace(/<base[^>]*>/gi, '');

const iconPath = process.env.APP_ICON || '';
const iconTag = iconPath ? `<link rel="apple-touch-icon" href="${iconPath}">` : '';

// أوامر الآيفون الصارمة
const appleTags = `
  <base href="/Nahj-Al-Noor-App/">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Nahj Al-Noor">
  <link rel="manifest" href="manifest.json">
  ${iconTag}
`;

html = html.replace('<head>', '<head>' + appleTags);
fs.writeFileSync('index.html', html);
