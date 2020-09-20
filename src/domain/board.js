
class Piece {
  constructor(x, y, team, isKing=false) {
    this.x = x;
    this.y = y;
    this.team = team;
    this.isKing = isKing;
  }

  static red(x, y, isKing=false) {
    return new Piece(x, y, 'R', isKing);
  }

  static white(x, y, isKing=false) {
    return new Piece(x, y, 'W', isKing);
  }
} 


class Board {

  static _whiteDeltas = [[1, -1], [1, 1]];
  static _redDeltas = [[-1, -1], [-1, 1]];
  static _kingDeltas = [[1, -1], [1, 1], [-1, -1], [-1, 1]];

  static getAvailableMoves(board, row, col, jumpRequired=false) {
    let piece = board[row][col];
    let deltas = piece.isKing ? this._kingDeltas : (piece.team === 'R' ? this._redDeltas : this._whiteDeltas);
    console.log(deltas);
    let availableMoves = [];

    if (piece === null) {
      console.log(`piece ${row}, ${col} is null`);
      return availableMoves;
    }

    for (let i = 0; i < deltas.length; i++) {
      // Find the target square.
      let targetRow = row + deltas[i][0];
      let targetCol = col + deltas[i][1];
      // If the target square is inside the board.
      if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
        // If the target square is empty move there.
        if (!jumpRequired && board[targetRow][targetCol] === null) {
          //console.log(`target square ${JSON.stringify({targetSquare: [targetRow, targetCol], jumpedSquare: []})}`);
          availableMoves.push({targetSquare: [targetRow, targetCol], jumpedSquare: []});
        } else if (board[targetRow][targetCol] !== null && board[targetRow][targetCol].team !== piece.team) { // Otherwise try to jump over the piece.
          // Grab the landing square.
          let jumpRow = targetRow + deltas[i][0];
          let jumpCol = targetCol + deltas[i][1];
          // If the landing square is inside the board.
          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
            if (board[jumpRow][jumpCol] === null) {
              //console.log(`jump square ${JSON.stringify({targetSquare: [jumpRow, jumpCol], jumpedSquare: [targetRow, targetCol]})}`);
              availableMoves.push({targetSquare: [jumpRow, jumpCol], jumpedSquare: [targetRow, targetCol]});
            }
          }
        }
      }
    }
    console.log(`availableMoves: ${JSON.stringify(availableMoves)}`);
    return availableMoves;
  }

  static getJumpingMoves(board, row, col) {
    return this.getAvailableMoves(board, row, col, false);
  }

  /**Returns a list of movable pieces for the specified team */
  static getMovablePieces(board, team) {
    let movablePieces = [];

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (board[i][j] !== null && board[i][j].team === team) {
          console.log('checking', i, j);
          if (this.getAvailableMoves(board, i, j).length > 0) {
            console.log('adding', i, j);
            movablePieces.push([i, j]);
          }
        }
      }
    }

    return movablePieces;
  }

  static moveResult(stateData) {

    let state = {
      isRunning: stateData.isRunning,
      board: stateData.board,
      message: stateData.message !== undefined ? stateData.message : '',
      movablePieces: stateData.movablePieces !== undefined ? stateData.movablePieces : [],
      pieceJumped: stateData.pieceJumped !== undefined ? stateData.pieceJumped : false
    }

    console.log(state);
    return state;
  }

  /** Move a piece, removing pieces that are jumped over
   * Returns {isRunning: true/false, board: undefined (bad move) / defined (good move), 
   * message: win/lose message, movablePieces: list of pieces the current player can move before ending their turn}
   */
  static move(board, startRow, startCol, endRow, endCol, jumpRequired=false) {
    console.log(startRow, startCol, endRow, endCol);
    // Ensure the piece is inside the board.
    let availableMoves = this.getAvailableMoves(board, startRow, startCol, jumpRequired);
    let movablePieces = [];
    let pieceJumped = false;
    let chosenMove = availableMoves.find(move => move.targetSquare[0] === endRow && move.targetSquare[1] === endCol);

    if (chosenMove === undefined) {
      console.log('move undefined');
      return this.moveResult({isRunning: true, board: undefined});
    }

    let piece = board[startRow][startCol];
    // Move piece to its destination.
    board[startRow][startCol] = null;
    board[chosenMove.targetSquare[0]][chosenMove.targetSquare[1]] = piece;
    // Remove the piece that was jumped over, if possible.
    if (chosenMove.jumpedSquare.length > 0) {
      if (board[chosenMove.jumpedSquare[0]][chosenMove.jumpedSquare[1]].team === piece.team) {
        return this.moveResult({isRunning: true, board: undefined});
      }
      board[chosenMove.jumpedSquare[0]][chosenMove.jumpedSquare[1]] = null;
      pieceJumped = true;
      movablePieces = this.getJumpingMoves(board, chosenMove.targetSquare[0], chosenMove.targetSquare[1]);
    }

    if (piece.team === 'R' && endRow === 0 || piece.team === 'W' && endRow === 7) {
      piece.isKing = true;
    }

    let redCount = 0, whiteCount = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (board[i][j] !== null) {
          if (board[i][j].team === 'R') {
            redCount++;
          }
          if (board[i][j].team === 'W') {
            whiteCount++;
          }
        }
      }
    }

    if (redCount === 0) {
      return this.moveResult({isRunning: false, board: board, message: 'White wins'});
    } else if (whiteCount === 0) {
      return this.moveResult({isRunning: false, board: board, message: 'Red wins'});
    } else {
      return this.moveResult({isRunning: true, board: board, movablePieces: movablePieces, pieceJumped: pieceJumped});
    }

  }

  static getFreshPieces() {
    return [
      Piece.white(0, 0), Piece.white(0, 2), Piece.white(0, 4), Piece.white(0, 6),
        Piece.white(1, 1), Piece.white(1, 3), Piece.white(1, 5), Piece.white(1, 7),
      Piece.white(2, 0), Piece.white(2, 2), Piece.white(2, 4), Piece.white(2, 6),

        Piece.red(5, 1), Piece.red(5, 3), Piece.red(5, 5), Piece.red(5, 7),
      Piece.red(6, 0), Piece.red(6, 2), Piece.red(6, 4), Piece.red(6, 6),
        Piece.red(7, 1), Piece.red(7, 3), Piece.red(7, 5), Piece.red(7, 7)
    ]
  }

  static init() {
    let board = [];
    for (let i = 0; i < 8; i++) {
      board.push([]);
      for (let j = 0; j < 8; j++) {
        board[i][j] = null;
      }
    } 
  
    this.getFreshPieces().forEach(piece => {
      board[piece.x][piece.y] = piece;
      delete piece.x;
      delete piece.y;
    });

    return board;
  }

}



module.exports = {Piece, Board};