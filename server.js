'use strict';
require('dotenv').config();
const express     = require('express');
const bodyParser  = require('body-parser');
const cors        = require('cors');

const apiRoutes         = require('./routes/api.js');
const fccTestingRoutes  = require('./routes/fcctesting.js');
const runner            = require('./test-runner');

const app = express();

//----------------------------------------------------------

// Connects to MongoDB ------------------------- added!
require('./database/connection.js')

// HTTP or HTTPS protocol ------------------------- added!
/*// This environment variable (process.env.httpOrHttps) was created by me to set redirection url's to:
// - Protocol "HTTP" when the functional tests are running (for the fcc functional tests to pass, my functional tests can only redirect to HTTP)
// - Protocol "HTTPS" when the functional tests are stopped (for the fcc remaining tests to pass, my logic can only redirect to HTTPS)
process.env.httpOrHttps = "https"*/

// WHY I INSTALLED NODEMON ------------------------- added!
/*// Replit.com's console sometimes would erase all the console logs, almost immediately, including recent errors, which I could not see because it would re-load automatically without having the time to stop and read the error(s). I installed nodemon because it stopped when an error is thrown, and it will not restart until you change something. Set in package.json file a "--delay 50" (50 seconds) until auto-restarts*/

// PROCESS.ON('WARNING', ...)
/*// This function allows to show deprecation warning stack when it's not appearing on the console. It was necessary due to the following thrown error:
// [DEP0066] DeprecationWarning: OutgoingMessage.prototype._headers is deprecated
// With the stack warning I could trace it to "node_modules/super-agent/lib/node/index.js:419 and 427", where I replaced ._headers for .getHeaders()*/
/*process.on('warning', (warning) => {
    console.log(warning.stack);
});*/

//----------------------------------------------------------

// Security Features with HELMET ------------------------- added!
const helmet = require('helmet')

// app.use helmet (extended version)
app.use(helmet({
    contentSecurityPolicy: {
      //useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        frameSrc: ["'self'"] // only allow your site to be loaded in an iFrame on your own pages
      }
    },
    referrerPolicy: { // only allow your site to send the referrer for your own pages
      policy: 'same-origin'
    },
    dnsPrefetchControl: { // do not allow DNS prefetching
      allow: false
    }
}));

// app.use helmet (short version)
// 1. only allow your site to be loaded in an iFrame on your own pages
//app.use(helmet.frameguard({ action: 'sameorigin' } ));
// 2. only allow your site to send the referrer for your own pages
//app.use(helmet.referrerPolicy({ policy: 'same-origin' }));
// 3. do not allow DNS prefetching
//app.use(helmet.dnsPrefetchControl({ allow: false }));

//----------------------------------------------------------

app.use('/public', express.static(process.cwd() + '/public'));

app.use(cors({origin: '*'})); //For FCC testing purposes only

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Sample front-end
app.route('/b/:board/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/board.html');
  });
app.route('/b/:board/:threadid')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/thread.html');
  });

//Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

//For FCC testing purposes
fccTestingRoutes(app);

//Routing for API 
apiRoutes(app);

//404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

//Start our server and tests!
const listener = app.listen(process.env.PORT || 3000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
  if(process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch(e) {
        console.log('Tests are not valid:');
        console.error(e);
      }
    }, 1500);
  }
});

module.exports = app; //for testing
