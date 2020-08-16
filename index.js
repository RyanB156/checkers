const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');

const port = 3000;

let app = express();
app.use(cors());
let jsonParser = bodyParser.json();

const menuPath = './src/app/menu.html'

function getHtml(path) {
  return fs.readFileSync(path, 'utf8').toString();
}

app.get('/*', function(req, res) {
  let page = getHtml(menuPath);
  res.status(200).send(page);
});


app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
