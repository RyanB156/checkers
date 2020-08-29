const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const api = require('./src/domain/rest-api/restApi.js');

const userAPI = new api('./src/domain/users.json');
const gameAPI = new api('./src/domain/games.json');

const port = 3000;

let app = express();
app.use(cors());
let jsonParser = bodyParser.json();

const menuPath = './src/app/menu.html';
const appPath = './app.html';

function getHtml(path) {
  return fs.readFileSync(path, 'utf8').toString();
}

function getHtmlFragment(fileName) {
  return getHtml('./src/app/' + fileName + '.html');
}

// Use regex to find custom html tags and replace them with their content.
function getApp(routingPage) {
  let html = getHtml(appPath).replace('<routing-module></routing-module>', getHtmlFragment(routingPage));
  let regex = /<app-([a-z]+)><\/app-[a-z]+>/g;
  let arr;
  
  while ((arr = regex.exec(html)) !== null) {
    
    let prefix = html.substring(0, arr['index']);
    let fragment = getHtmlFragment(arr[1]);
    let suffix = html.substring(arr['index'] + arr[0].length, html.length);
    html = prefix + fragment + suffix;
  }

  return html;
}

function getSessionKey(body) {
  let data = new TextEncoder().encode(Date.now() | Math.random() * 10000);
  let hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

// User login. Request must have 'username' and 'password'. username and password hash must match existing user.
app.post('/action/login', jsonParser, function(req, res) {
  console.log('/action/login');
  console.log(`Server received ${JSON.stringify(req.body)}`);

  if (!('username' in req.body && 'password' in req.body)) {
    console.log('Request is missing username and/or password hash');
    return res.status(400).send('Login must have username and password hash');
  } else {
    let username = req.body['username'];
    let result = userAPI.get(username);
    if (result.status !== 200) {
      return res.status(result.status).send(result.error);
    }
    // TODO: Establish symmetric keys with the client using DH or EC.
    if (result.data['password'] !== req.body['password']) {
      return res.status(400).send('Login error');
    }
    let sessionKey = getSessionKey();
    userAPI.update(username, {username: username, password: result.data['password'], sessionKey: sessionKey});
    return res.status(200).send(sessionKey);
  }
});

// Register a user. Request must have 'username' and 'password'. username must be unique.
app.post('/action/register', jsonParser, function(req, res) {
  console.log('/action/register');
  console.log(`Server received ${JSON.stringify(req.body)}`);

  if (!('username' in req.body && 'password' in req.body)) {
    console.log('Request is missing username and/or password hash');
    return res.status(400).send('Register must have username and hash');
  } else {
    if (userAPI.get(req.body['username']).status === 200) {
      return res.status(400).send('A user with that username already exists');
    }
    let username = req.body['username'];
    let result = userAPI.add(username, {'username': username, 'password': req.body['password'], 'sessionKey': ''});
    if (result.status === 200) {
      return res.status(result.status).send(res.data);
    } else {
      return res.status(result.status).send(res.error);
    }
  }
})


function canAuthenticate(body) {
  return ('username' in body && 'sessionKey' in body);
}

// Returns true if the request body contains 'username' and 'password'; a user with that username exists; and the user has a valid session key
// TODO: Expire session keys...
function isAuthenticated(body) {
  let userResult = userAPI.get(body['username']);
  console.log(canAuthenticate(body), userResult.status == 200, userResult.data['sessionKey'], body['sessionKey']);
  return canAuthenticate(body) && userResult.status == 200 && userResult.data['sessionKey'] === body['sessionKey'];
}

function accessDeniedHandler(res) {
  return res.status(401).send('<h3>401 Access Denied</h3> <p>You do not have permission to access this resource</p>');
}

/**A list of (endpoint,function) pairs. The function takes the post body as an argument.*/
let actionsWithAuth = [{name: 'hostGame', func: getSessionKey}];

actionsWithAuth.forEach(action => {
  app.post('/' + action.name, jsonParser, function(req, res) {
    console.log('/' + pageName);
    if (!isAuthenticated(req.body)) {
      return accessDeniedHandler(res);
    }
    let data = action.func(req.body);
    return res.status(200).send(data);
  });
});

let pageNamesNoAuth = ['login', 'register'];
let pageNamesAuth = ['home', 'hostGame', 'joinGame'];

pageNamesNoAuth.forEach(pageName => {
  app.get('/' + pageName, function(req, res) {
    let page = getApp(pageName);
    return res.status(200).send(page);
  });
});

pageNamesAuth.forEach(pageName => {
  app.post('/' + pageName, jsonParser, function(req, res) {
    console.log('/' + pageName);
    if (!isAuthenticated(req.body)) {
      return accessDeniedHandler(res);
    }
    let page = getApp(pageName);
    return res.status(200).send(page);
  });
});


app.get('/*', function(req, res) {
  let page = getApp('home');
  return res.status(200).send(page);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

