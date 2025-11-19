// FILE: backend/server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const getHealthEvents = require('./routes/getHealthEvents');
const addManualEvent = require('./routes/addManualEvent');
const processImage = require('./routes/processImage');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health-events', getHealthEvents);
app.post('/api/add-manual-event', addManualEvent);
app.post('/api/process-image', processImage);


app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '192.168.100.56', () => {
  console.log(`Server running on port ${PORT} and listening on all network interfaces`);
});