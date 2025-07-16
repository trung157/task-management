console.log('🚀 Starting simple test server...');

const express = require('express');
const app = express();
const PORT = 5000;

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Simple server is running!' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

console.log('📝 Server setup complete, waiting for connections...');
