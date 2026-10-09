Design a two-player chess game: board, pieces, legal move generation, check and checkmate detection, special moves, and undo. It's hard mainly because of rule validation, and it's a great showcase for polymorphism and the Command pattern.

## Requirements

**Functional**

- 8 x 8 board with the standard initial setup; White moves first.
- Each piece type moves by its own rules; captures by moving onto an opponent's piece.
- Reject illegal moves, including moves that leave your own king in check.
- Detect check, checkmate, and stalemate.
- Special moves: castling, en passant, pawn promotion.
- Undo/redo moves; move history in algebraic notation.
- Optional: clocks, draw by threefold repetition and the 50-move rule, resignation.

**Non-functional**

- Clear separation between rules, board state, and UI/IO.
- Adding a variant piece or rule should not require rewriting the game loop.
- Move validation fast enough for interactive play (a bot is a follow-up).

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Color` (enum) | WHITE, BLACK |
| `Position` | Value object: file 0-7, rank 0-7 |
| `Piece` (abstract) | Color, has_moved; `candidate_moves(board, pos)` |
| `King`, `Queen`, `Rook`, `Bishop`, `Knight`, `Pawn` | Movement rules per type |
| `Board` | 8 x 8 grid, piece lookup, apply/revert raw moves, king positions |
| `Move` | From, to, piece, captured piece, special flags (castle, en passant, promotion) |
| `MoveCommand` | Executes and undoes a move on the board |
| `RuleEngine` | Legal moves = candidate moves filtered by "own king not in check"; game-end detection |
| `Game` | Players, turn, status, history, undo/redo |

## Class design

```python
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

class Color(Enum):
    WHITE = 1
    BLACK = -1

@dataclass(frozen=True)
class Position:
    file: int
    rank: int

    def on_board(self) -> bool:
        return 0 <= self.file < 8 and 0 <= self.rank < 8

    def offset(self, df: int, dr: int) -> Position:
        return Position(self.file + df, self.rank + dr)

class Piece(ABC):
    def __init__(self, color: Color) -> None:
        self.color, self.has_moved = color, False

    @abstractmethod   # movement rules only; self-check is filtered by the game
    def candidate_moves(self, board: Board, at: Position) -> list[Position]: ...

    def _slide(self, board: Board, at: Position, dirs: list[tuple[int, int]]) -> list[Position]:
        out: list[Position] = []
        for df, dr in dirs:
            p = at.offset(df, dr)
            while p.on_board():
                occupant = board.at(p)
                if occupant is None or occupant.color is not self.color:
                    out.append(p)
                if occupant is not None:
                    break
                p = p.offset(df, dr)
        return out

class Rook(Piece):
    def candidate_moves(self, board: Board, at: Position) -> list[Position]:
        return self._slide(board, at, [(1, 0), (-1, 0), (0, 1), (0, -1)])

class Knight(Piece): ...    # eight L-shaped jumps, ignores blockers
class Bishop(Piece): ...
class Queen(Piece): ...
class King(Piece): ...      # one step + castling candidates
class Pawn(Piece): ...      # forward, double first move, diagonal capture, en passant

@dataclass
class Move:
    src: Position
    dst: Position
    piece: Piece
    captured: Piece | None = None
    promotion: type[Piece] | None = None
    is_castle: bool = False
    is_en_passant: bool = False

class Board:
    def __init__(self) -> None:
        self._grid: dict[Position, Piece] = {}

    def at(self, p: Position) -> Piece | None:
        return self._grid.get(p)

    def king_position(self, color: Color) -> Position: ...
    def is_attacked(self, p: Position, by: Color) -> bool: ...

class MoveCommand:
    def __init__(self, board: Board, move: Move) -> None:
        self.board, self.move = board, move

    def execute(self) -> None: ...   # move piece, capture, rook for castling, promotion
    def undo(self) -> None: ...      # exact reverse, restoring has_moved and captured piece

class GameStatus(Enum):
    ACTIVE, CHECK, CHECKMATE, STALEMATE, DRAW, RESIGNED = range(6)

@dataclass
class Game:
    board: Board
    turn: Color = Color.WHITE
    status: GameStatus = GameStatus.ACTIVE
    history: list[MoveCommand] = field(default_factory=list)

    def legal_moves(self, src: Position) -> list[Position]: ...
    def make_move(self, src: Position, dst: Position, promote_to: type[Piece] | None = None) -> GameStatus: ...
    def undo(self) -> None: ...
```

## Key flows

1. **Make a move** `(src, dst)`:
   1. Piece at `src` must exist and belong to `turn`; game must be ACTIVE or CHECK.
   2. `dst` must be in `legal_moves(src)`.
   3. Build a `Move` (detect capture, castling, en passant, promotion) and a `MoveCommand`; execute; push to history.
   4. Switch `turn`; evaluate status for the new side to move.
2. **Legal moves**: for each candidate from `piece.candidate_moves`, simulate with a `MoveCommand` (execute, check `board.is_attacked(own_king, opponent)`, undo) and keep only safe moves. Castling also requires the king not in check and not passing through attacked squares.
3. **Status evaluation**: `in_check = is_attacked(king, opponent)`; `has_moves = any legal move for any piece`. No moves + in check = CHECKMATE; no moves + not in check = STALEMATE; in check = CHECK.
4. **Undo**: pop the last command, `undo()`, switch turn back, recompute status.

## Patterns used

- **Polymorphism / Strategy per piece**: each piece class implements its own movement; sliding pieces share `_slide` (a small Template Method).
- **Command**: `MoveCommand` with execute/undo enables history, undo/redo, and safe move simulation during validation.
- **Factory**: create the initial board and promotion pieces (`PieceFactory.create("Q", color)`).
- **Observer**: UI, clocks, and notation recorders subscribe to `MoveMade` events.
- **Separation of concerns**: `Piece` knows movement, `Game`/rules know legality (self-check, game end), `Board` knows state.

## Concurrency & edge cases

- Single game state mutated by alternating players; in an online setting serialise moves per game (per-game lock or actor) and validate the mover's identity and turn.
- **Pinned pieces**: handled naturally by the simulate-and-check-king filter.
- **En passant** is only legal immediately after the opponent's double pawn push; store the last move in game state.
- **Castling rights** depend on the king and rook never having moved; `has_moved` must be restored on undo.
- **Promotion** requires a choice; default to queen if not specified.
- **Draw rules**: threefold repetition needs position hashing (e.g. Zobrist); the 50-move rule needs a half-move clock.

## Follow-ups the interviewer may ask

**Why not put "can't leave king in check" inside each piece?**
It's a game-level rule involving the whole board; centralising it in the rule engine avoids duplicating it six times and handles pins and discovered checks uniformly.

**How would you add a chess bot?**
A `Player` interface with `HumanPlayer` and `BotPlayer`; the bot runs minimax with alpha-beta over `legal_moves`, using `MoveCommand` execute/undo to explore without copying the board.

**How would you support a variant like Chess960?**
Only the initial setup factory and castling rules change; pieces and the game loop stay the same.
