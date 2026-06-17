require('dotenv').config();
const app = require('./app');

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`[phase1] Immigration CRM API listening on http://localhost:${port}`);
  console.log(`[phase1] Health: http://localhost:${port}/api/health`);
});
