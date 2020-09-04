
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
      Piece.white(2, 0), Piece.white(2, 2), Piece.white(2, 4), Piece.white(2, 6),

        Piece.red(5, 1), Piece.red(5, 3), Piece.red(5, 5, true), Piece.red(5, 7),
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