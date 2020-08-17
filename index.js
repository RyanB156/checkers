const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const api = require('./src/domain/rest-api/restApi.js');

const userAPI = new api('./src/domain/users.json');

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

  console.log(html);

  let arr;
  
  while ((arr = regex.exec(html)) !== null) {
    
    let prefix = html.substring(0, arr['index']);
    let fragment = getHtmlFragment(arr[1]);
    let suffix = html.substring(arr['index'] + arr[0].length, html.length);
    html = prefix + fragment + suffix;
  }

  return html;
}

app.get('/login', function(req, res) {
  let page = getApp('login');
  res.status(200).send(page);
});

app.get('/*', function(req, res) {
  let page = getApp('home');
  res.status(200).send(page);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

