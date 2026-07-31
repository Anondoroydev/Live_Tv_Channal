const http = require('http');
const https = require('https');

const username = '171770';
const password = '171770';
const streamId = '3';

const urls = [
  `https://banglavu.top/live/${username}/${password}/${streamId}.m3u8`,
  `https://banglavu.top/live/${username}/${password}/${streamId}.ts`,
  `https://banglaview.online/live/${username}/${password}/${streamId}.m3u8`,
  `https://banglaview.online/live/${username}/${password}/${streamId}.ts`,
  `http://banglaview.online:8080/live/${username}/${password}/${streamId}.m3u8`,
  `http://banglaview.online:8080/live/${username}/${password}/${streamId}.ts`
];

async function testUrl(url) {
  return new Promise((resolve) => {
    console.log(`\nTesting: ${url}`);
    const client = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'VLC/3.0.12 LibVLC/3.0.12'
      },
      rejectUnauthorized: false
    };

    const req = client.get(url, options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);
      if (res.headers.location) console.log(`Location: ${res.headers.location}`);
      
      let data = '';
      if (res.statusCode === 200 && res.headers['content-type'] && res.headers['content-type'].includes('text')) {
         res.on('data', (chunk) => { data += chunk; });
         res.on('end', () => {
           console.log(`Response length: ${data.length}`);
           console.log(`Response start: ${data.substring(0, 100)}`);
           resolve();
         });
      } else {
         res.resume();
         resolve();
      }
    });
    req.on('error', (e) => {
      console.error(`Error: ${e.message}`);
      resolve();
    });
    req.setTimeout(5000, () => {
      console.log('Timeout');
      req.destroy();
      resolve();
    });
  });
}

async function run() {
  for (const url of urls) {
    await testUrl(url);
  }
}

run();
