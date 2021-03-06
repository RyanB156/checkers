const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { Result, Success, Failure, RestAPI } = require('./src/domain/rest-api/restApi');
const {Board} = require('./src/domain/board');
const board = require('./src/domain/board');

const userAPI = new RestAPI('./src/domain/users.json');
const gameAPI = new RestAPI('./src/domain/games.json');

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

function getTeamFromUsername(username, hostsName) {
  return hostsName === username ? 'R' : 'W';
}

function getFullTeamFromUsername(username, hostsName) {
  return hostsName === username ? 'Red' : 'White';
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
    board: game,
    movablePiece: null
  }
  gameAPI.add(gameState.gameCode, gameState);

  return new Success(200, gameState.gameCode);
}

function getFriendsName(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let friendsName = gameResult.data['friend'];
    return new Success(200, friendsName);
  }
}

function getGameState(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let gameState = gameResult.data['isRunning'];
    return new Success(200, gameState);
  }
}

function getCurrentPlayer(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {

    if (gameResult.data.isRunning) {
      let currentPlayer = gameResult.data['currentPlayer'];
      return new Success(200, currentPlayer);
    } else {
      let winMessage = gameResult.data['winner'] + ' wins';
      return new Failure(503, winMessage);
    }

  }
}

function joinGame(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  console.log('gameCode', req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    gameResult.data['friend'] = req.cookies['username'];
    gameAPI.update(req.cookies['gameCode'], gameResult.data);
    return new Success(200, true);
  }
}

function startGame(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let gameResult = gameAPI.get(req.cookies['gameCode']);

    if (gameResult.data['friend'] === '') {
      return new Failure(400, 'You cannot start a game until someone joins');
    }

    gameResult.data['isRunning'] = true;
    gameAPI.update(req.cookies['gameCode'], gameResult.data);
    let board = gameResult.data['board'];
    //let allPlayersPieces = Board.allTeamsPiecePositions(board, req.cookies['username'])
    return new Success(200, board);
  }
}

function getBoard(req) {
  let gameResult = gameAPI.get(req.cookies['gameCode']);
  if (gameResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let board = gameResult.data['board'];
    let team = getTeamFromUsername(req.cookies['username'], gameResult.data['host']);
    let movablePieces = Board.getMovablePieces(board, team);
    console.log('movablePieces', movablePieces);
    return new Success(200, {board: board, movablePieces: movablePieces});
  }
}

function getAvailableMoves(req) {
  let gameLoadResult = gameAPI.get(req.cookies['gameCode']);
  if (gameLoadResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    let playerTeam = getTeamFromUsername(req.cookies['username'], gameLoadResult.data['host']);

    if (gameLoadResult.data['board'][req.body['row']][req.body['col']].team !== playerTeam) {
      return new Failure(400, 'You cannot move the other team\'s pieces');
    } else if (gameLoadResult.data['movablePiece'] !== null
        && (req.body['row'] !== gameLoadResult.data['movablePiece'][0]
        || req.body['col'] !== gameLoadResult.data['movablePiece'][1])) {
      return new Failure(400, 'You must move the piece that you jumped');
    }

    let gameData = {
      board: gameLoadResult.data['board'],
      availableMoves: Board.getAvailableMoves(gameLoadResult.data['board'], req.body['row'], req.body['col'], gameLoadResult.data['movablePiece'] !== null).map(move => move.targetSquare)
    }
    return new Success(200, gameData);
  }
}


function endTurn(req) {
  let gameLoadResult = gameAPI.get(req.cookies['gameCode']);
  if (gameLoadResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {
    gameLoadResult.data['currentPlayer'] = req.cookies['username'] === gameLoadResult.data['host'] ? gameLoadResult.data['friend'] : gameLoadResult.data['host'];
    gameLoadResult.data['movablePiece'] = null;
    gameAPI.update(req.cookies['gameCode'], gameLoadResult.data);
  }
}

function move(req) {
  let gameLoadResult = gameAPI.get(req.cookies['gameCode']);
  if (!gameLoadResult.data.isRunning) {
    return new Failure(400, 'The game is over');
  }
  
  if (gameLoadResult.data['currentPlayer'] !== req.cookies['username']) {
    return new Failure(400, 'You must wait your turn');
  }
  
  if (gameLoadResult.status !== 200) {
    return new Failure(400, 'Could not find a game with that code');
  } else {

    // Ensure the player only moves the same piece after jumping with it.
    if (gameLoadResult.data['movablePiece'] !== null
        && (req.body['startRow'] !== gameLoadResult.data['movablePiece'][0]
        || req.body['startCol'] !== gameLoadResult.data['movablePiece'][1])) {
      return new Failure(400, 'You must move the piece that you jumped');
    }

    let gameState = Board.move(gameLoadResult.data['board'], req.body['startRow'], req.body['startCol'], req.body['endRow'], req.body['endCol'], gameLoadResult.data['movablePiece'] !== null);
    if (gameState.board === undefined) { // Movement failed.
      return new Failure(400, `Could not move piece (${req.body['startRow']}, ${req.body['startCol']}) to (${req.body['endRow']}, ${req.body['endCol']})`);
    } else if (gameState.pieceJumped) { // Player jumped, enforce movement of that piece next.
      gameLoadResult.data['movablePiece'] = [req.body['endRow'], req.body['endCol']];
      gameAPI.update(req.cookies['gameCode'], gameLoadResult.data);
      gameState.movablePieces = [req.body['endRow'], req.body['endCol']];
      return new Success(200, gameState);
    } else { // Movement successful
      if (!gameState.isRunning) { // Game ended.
        gameLoadResult.data['isRunning'] = false;
        gameLoadResult.data['winner'] = getFullTeamFromUsername(req.cookies['username']);
        gameAPI.update(req.cookies['gameCode'], gameLoadResult.data);
        //gameAPI.delete(req.cookies['gameCode']);
      } else { // Game continues with the next player moving.
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
  {name: 'getFriendsName', func: getFriendsName},
  {name: 'getGameState', func: getGameState},
  {name: 'getCurrentPlayer', func: getCurrentPlayer},
  {name: 'joinGame', func: joinGame},
  {name: 'startGame', func: startGame},
  {name: 'getBoard', func: getBoard},
  {name: 'getAvailableMoves', func: getAvailableMoves},
  {name: 'move', func: move},
  {name: 'endTurn', func: endTurn}
];

// move and startGame return a board object, they should return the available moves too.

actionsWithAuth.forEach(action => {
  app.post('/action/' + action.name, jsonParser, function(req, res) {
    console.log('/action/' + action.name);
    if (!isAuthenticated(req)) {
      console.log('--User failed authentication step');
      return accessDeniedHandler(res);
    }
    console.log(`--User is authenticated (${req.cookies['username']})`);
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
    console.log(`--User is authenticated (${req.cookies['username']})`);
    let page = getApp(pageName);
    console.log('--Sending the page');
    return res.status(200).send(page);
  });
});


app.get('/*', function(req, res) {
  let page = getApp('home');
  return res.status(200).send(page);
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 8000;
}

app.listen(port, () => {
  console.log(`Listening on port ${port} at ${new Date(Date.now()).toLocaleString('en-US')}`);
});

