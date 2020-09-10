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

function getSessionKey(req) {
  let data = new TextEncoder().encode(Date.now() | Math.random() * 10000);
  let hash = crypto.createHash('sha256');
  hash.update(data);
  return new Success(200, hash.digest('hex'));
}

/*
  host, friend, gameCode, currentPlayer, board
*/
function hostGame(req) {
  let game = Board.init();

  let gameState = {
    host: req.cookies['username'],
    friend: '',
    gameCode: req.cookies['gameCode'],
    currentPlayer: req.cookies['username'],
    isRunning: false,
    board: game
  }
  gameAPI.add(gameState.gameCode, gameState);

  return new Success(200, gameState.gameCode);
}

function joinGame(req) {
  let gameCode = req.body['gameCode'];
  return new Success(200, gameCode);
}

function startGame(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let gameResult = gameAPI.get(req.cookies['gameCode']);
    gameResult.data['isRunning'] = true;
    gameAPI.update(req.cookies['gameCode'], gameResult.data);
    return new Success(200, gameResult.data['board']);
  }
}

function getBoard(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    return new Success(200, gameResult.data['board']);
  }
}

function getAvailableMoves(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let gameData = {
      board: gameResult.data['board'],
      availableMoves: Board.getAvailableMoves(gameResult.data['board'], req.body['row'], req.body['col']).map(move => move.targetSquare)
    }
    return new Success(200, gameData);
  }
}

/*
  TODO:

    Game runs until the last piece is to be taken, then errors and restarts that turn...

    Enforce turns √

    Allow friend to join the game with the code
      Server adds the friends username
      Client shows whose turn it is

    Make sure the serve side of moving is good to go
    Setup client side of moving
      Use current piece, don't move without first selecting a piece √
      Clear local storage to remove current piece after move and at the start of each turn
*/

function move(req) {
  let gameLoadResult = gameAPI.get(req.cookies['gameCode']);
  if (!gameLoadResult.data.isRunning) {
    return new Failure(400, 'The game is over');
  }
  /* Uncomment this when a friend can join the game...
  if (!gameLoadResult.data['currentPlayer'] === req.cookies['username']) {
    return new Failure(400, 'You must wait your turn');
  }
  */
  if (gameLoadResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let gameState = Board.move(gameLoadResult.data['board'], req.body['startRow'], req.body['startCol'], req.body['endRow'], req.body['endCol']);
    if (gameState.board === undefined) {
      return new Failure(400, `Could not move piece (${req.body['startRow']}, ${req.body['startCol']}) to (${req.body['endRow']}, ${req.body['endCol']})`);
    } else {
      if (!gameState.isRunning) {
        gameLoadResult.data['isRunning'] = false;
        //gameAPI.delete(req.cookies['gameCode']);
      } else {
        gameLoadResult.data.board = gameState.board;
        gameLoadResult.data['currentPlayer'] = req.cookies['username'] === gameLoadResult.data['host'] ? gameLoadResult.data['friend'] : gameLoadResult.data['host'];
        gameAPI.update(req.cookies['gameCode'], gameLoadResult.data);
      }
      return new Success(200, gameState);
    }
  }
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
  let b = canAuthenticate(req) && userResult.status == 200 && userResult.data['sessionKey'] === req.cookies['sessionKey'];
  if (!b) {
    console.log(canAuthenticate(req), userResult.status == 200,  userResult.data['sessionKey'] === req.cookies['sessionKey'])
  }
  return b;
}

function accessDeniedHandler(res) {
  return res.status(401).send('<h3>401 Access Denied</h3> <p>You do not have permission to access this resource</p>');
}

/**A list of (endpoint,function) pairs. The function takes the request as an argument.*/
let actionsWithAuth = [
  {name: 'getGameCode', func: getSessionKey},
  {name: 'hostGame', func: hostGame},
  {name: 'joinGame', func: joinGame},
  {name: 'startGame', func: startGame},
  {name: 'getBoard', func: getBoard},
  {name: 'getAvailableMoves', func: getAvailableMoves},
  {name: 'move', func: move},
];

actionsWithAuth.forEach(action => {
  app.post('/action/' + action.name, jsonParser, function(req, res) {
    console.log('/action/' + action.name);
    if (!isAuthenticated(req)) {
      console.log('--User failed authentication step');
      return accessDeniedHandler(res);
    }
    console.log('--User is authenticated');
    let dataResult = action.func(req);
    if (dataResult.status === 200) {
      console.log('--Action successful');
      return res.status(200).send(dataResult.data);
    } else {
      console.log(`--Action failed. Error: ${dataResult.error}`);
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
    if (!isAuthenticated(req)) {
      console.log('--User failed authentication step');
      return accessDeniedHandler(res);
    }
    console.log('--User is authenticated');
    let page = getApp(pageName);
    console.log('--Sending the page');
    return res.status(200).send(page);
  });
});


app.get('/*', function(req, res) {
  let page = getApp('home');
  return res.status(200).send(page);
});

app.listen(port, () => {
  console.log(`Listening on port ${port} at ${new Date(Date.now()).toLocaleString('en-US')}`);
});

