'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner');

const app = express();

// Security headers + CSP
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"]
    }
  })
);
app.use(helmet.hidePoweredBy());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.noSniff());

app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({ origin: '*' })); // FCC testing only
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
console.log('Mencoba menghubungkan ke MongoDB...');
mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log('✅ SUKSES: MongoDB Connected!');
  })
  .catch((err) => {
    console.error('❌ ERROR: Gagal connect ke Database.');
    console.error(err);
  });

// Index page
app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// FCC testing
fccTestingRoutes(app);

// API routes
apiRoutes(app);

// 404
app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

// Start server & tests
const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Listening on port ' + port);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log('Tests are not valid:');
        console.error(e);
      }
    }, 3500);
  }
});

module.exports = app;
