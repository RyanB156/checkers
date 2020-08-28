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

function getSessionKey() {
  let data = new TextEncoder().encode(Date.now() | Math.random() * 10000);
  let hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

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

app.post('/action/register', jsonParser, function(req, res) {
  console.log('/action/register');
  console.log(`Server received ${JSON.stringify(req.body)}`);

  if (!('username' in req.body && 'password' in req.body)) {
    console.log('Request is missing username and/or password hash');
    return res.status(400).send('Register must have username and hash');
  } else {
    let username = req.body['username'];
    let result = userAPI.add(username, {'username': username, 'password': req.body['password'], 'sessionKey': ''});
    if (result.status === 200) {
      return res.status(result.status).send(res.data);
    } else {
      return res.status(result.status).send(res.error);
    }
  }
})

app.get('/action/getGameCode', async function(req, res) {
  console.log('/action/getGameCode');
  let hash = getSessionKey();
  return res.status(200).send({hash: hash});
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
    if (!('username' in req.body && 'sessionKey' in req.body)) {
      return res.status(401).send('<p>You do not have permission to access this resource</p>');
    } else {
      let userResult = userAPI.get(req.body['username']);
      if (userResult.status !== 200) {
        return res.status(userResult.status).send(userResult.error);
      }
      if (userResult.data['sessionKey'] !== req.body['sessionKey']) {
        return res.status(401).send('401 Access Denied');
      }
      let page = getApp(pageName);
      return res.status(200).send(page);
    }
  });
});


app.get('/*', function(req, res) {
  let page = getApp('home');
  return res.status(200).send(page);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

