import http from 'http';
http.get('http://localhost:3000/api/channels', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const channels = JSON.parse(data);
      const free = channels.filter(c => !c.isPremium);
      const prem = channels.filter(c => c.isPremium);
      console.log('API RESPONSE -> Total:', channels.length, 'Free:', free.length, 'Premium:', prem.length);
      console.log('Sample Free Channels:', free.slice(0, 10).map(c => c.name));
    } catch(e) { console.error(e); }
  });
});
