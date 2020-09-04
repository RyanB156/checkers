const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { Result, Success, Failure, RestAPI } = require('./src/domain/rest-api/restApi');
const {Board} = require('./src/domain/board');

const userAPI = new RestAPI('./src/domain/users.json');
const gameAPI = new RestAPI('./src/domain/games.json');

const port = 3000;

let app = express();
app.use(cors());
app.use(cookieParser());
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
  return new Success(200, hash.digest('hex'));
}

function joinGame(body) {
  let gameCode = body['gameCode'];
  return new Success(200, gameCode);
}

function startGame(body) {
  let game = Board.init();
  return new Success(200, JSON.stringify(game));
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
    let sessionKey = getSessionKey().data;
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


function canAuthenticate(req) {
  return ('username' in req.cookies && 'sessionKey' in req.cookies);
}

// Returns true if the cookies contains 'username' and 'sessionKey'; a user with that username exists; and the user has a valid session key
// TODO: Expire session keys...
function isAuthenticated(req) {
  let userResult = userAPI.get(req.cookies['username']);
  return canAuthenticate(req) && userResult.status == 200 && userResult.data['sessionKey'] === req.cookies['sessionKey'];
}

function accessDeniedHandler(res) {
  return res.status(401).send('<h3>401 Access Denied</h3> <p>You do not have permission to access this resource</p>');
}

/**A list of (endpoint,function) pairs. The function takes the post body as an argument.*/
let actionsWithAuth = [
  {name: 'getGameCode', func: getSessionKey},
  {name: 'hostGame', func: getSessionKey},
  {name: 'joinGame', func: joinGame},
  {name: 'startGame', func: startGame},
];

actionsWithAuth.forEach(action => {
  app.post('/action/' + action.name, jsonParser, function(req, res) {
    console.log('/action/' + action.name);
    if (!isAuthenticated(req)) {
      return accessDeniedHandler(res);
    }
    let dataResult = action.func(req.body);
    if (dataResult.status === 200) {
      return res.status(200).send(dataResult.data);
    } else {
      return res.status(dataResult.status).send(dataResult.error);
    }
  });
});

let pageNamesNoAuth = ['login', 'register'];
let pageNamesAuth = ['home', 'hostGame', 'joinGame', 'playGame'];

pageNamesNoAuth.forEach(pageName => {
  app.get('/' + pageName, function(req, res) {
    let page = getApp(pageName);
    return res.status(200).send(page);
  });
});

pageNamesAuth.forEach(pageName => {
  app.get('/' + pageName, function(req, res) {
    console.log('/' + pageName);
    console.log('cookies: ', req.cookies);
    if (!isAuthenticated(req)) {
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

