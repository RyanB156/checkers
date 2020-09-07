
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

  static getAvailableMoves(board, row, col) {
    let piece = board[row][col];
    let deltas = piece.isKing ? this._kingDeltas : (piece.team === 'R' ? this._redDeltas : this._whiteDeltas);
    let availableMoves = [];
    for (let i = 0; i < deltas.length; i++) {
      // Find the target square.
      let targetRow = row + deltas[i][0];
      let targetCol = col + deltas[i][1];
      // If the target square is inside the board.
      if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
        // If the target square is empty move there.
        if (board[targetRow][targetCol] === null) {
          console.log(`target square ${JSON.stringify([targetRow, targetCol])}`);
          availableMoves.push([targetRow, targetCol]);
        } else if (board[targetRow][targetCol].team !== piece.team) { // Otherwise try to jump over the piece.
          // Grab the landing square.
          let jumpRow = targetRow + deltas[i][0];
          let jumpCol = targetCol + deltas[i][1];
          // If the landing square is inside the board.
          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
            if (board[jumpRow][jumpCol] === null) {
              console.log(`jump square ${JSON.stringify([jumpRow, jumpCol])}`);
              availableMoves.push([jumpRow, jumpCol]);
            }
          }
        }
      }
    }
    console.log(`availableMoves: ${JSON.stringify(availableMoves)}`);
    return availableMoves;
  }

  static init() {
    let board = [];
    for (let i = 0; i < 8; i++) {
      board.push([]);
      for (let j = 0; j < 8; j++) {
        board[i][j] = null;
      }
    } 
  
    [
      Piece.white(0, 0, true), Piece.white(0, 2), Piece.white(0, 4), Piece.white(0, 6),
        Piece.white(1, 1), Piece.white(1, 3, true), Piece.white(1, 5), Piece.white(1, 7),
      Piece.white(2, 0), Piece.white(2, 2), Piece.white(2, 4), Piece.white(4, 4), // Piece.white(2, 6)

        Piece.red(5, 1), Piece.red(5, 3), Piece.red(5, 5, true), Piece.red(3, 5), // Piece.red(5, 7)
      Piece.red(6, 0), Piece.red(6, 2), Piece.red(6, 4), Piece.red(6, 6),
        Piece.red(7, 1), Piece.red(7, 3, true), Piece.red(7, 5), Piece.red(7, 7)
    ].forEach(piece => {
      board[piece.x][piece.y] = piece;
      delete piece.x;
      delete piece.y;
    });

    return board;
  }

}



module.exports = {Piece, Board};