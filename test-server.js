const app = require('./server');
const http = require('http');

const server = http.createServer(app);
server.listen(3002, async () => {
  console.log('Server started on 3002...');
  try {
    const res = await fetch('http://localhost:3002/api/firebase-config');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Keys returned:', Object.keys(data));
  } catch(e) {
    console.error('Fetch error:', e.message);
  }
  server.close();
  process.exit(0);
});