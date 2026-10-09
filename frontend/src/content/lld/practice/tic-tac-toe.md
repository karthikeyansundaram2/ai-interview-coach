Design a Tic-Tac-Toe game that two players (human or bot) can play on an N x N board. It's a warm-up problem, but interviewers use it to check clean modelling, a tidy game loop, and whether you can detect a win in O(1) instead of rescanning the board.

## Requirements

**Functional**

- Two players take turns placing their symbol (X or O) on an empty cell.
- Board size is configurable (default 3 x 3); a player wins with N in a row, column, or diagonal.
- Detect win and draw; reject moves on occupied or out-of-range cells and moves out of turn.
- Players can be humans (input-driven) or bots (strategy-driven).
- Optional: undo the last move, replay a finished game.

**Non-functional**

- Move validation and win check should be O(1) per move.
- Easy to add new player types or a larger board without changing game logic.
- Single process; one game object per match, no concurrency needed across games.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Symbol` (enum) | X or O |
| `Board` | Grid state, placing marks, bounds and occupancy checks |
| `Player` (interface) | Chooses the next move; `HumanPlayer`, `RandomBot`, `SmartBot` |
| `Move` | Value object: row, col, symbol |
| `WinTracker` | Row/column/diagonal counters for O(1) win detection |
| `Game` | Turn order, status, move history, orchestrates the loop |
| `GameStatus` (enum) | IN_PROGRESS, X_WON, O_WON, DRAW |

## Class design

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

class Symbol(Enum):
    X = 1
    O = -1

class GameStatus(Enum):
    IN_PROGRESS = "in_progress"
    X_WON = "x_won"
    O_WON = "o_won"
    DRAW = "draw"

@dataclass(frozen=True)
class Move:
    row: int
    col: int
    symbol: Symbol

class Board:
    def __init__(self, n: int = 3) -> None:
        self.n = n
        self._cells: list[list[Symbol | None]] = [[None] * n for _ in range(n)]
        self.filled = 0

    def is_valid(self, r: int, c: int) -> bool:
        return 0 <= r < self.n and 0 <= c < self.n and self._cells[r][c] is None

    def place(self, move: Move) -> None: ...
    def clear(self, r: int, c: int) -> None: ...          # for undo
    def empty_cells(self) -> list[tuple[int, int]]: ...

class WinTracker:
    """X adds +1, O adds -1; a line summing to +/-n is a win."""

    def __init__(self, n: int) -> None:
        self.n = n
        self.rows, self.cols = [0] * n, [0] * n
        self.diag = self.anti = 0

    def record(self, m: Move) -> bool:
        v = m.symbol.value
        self.rows[m.row] += v
        self.cols[m.col] += v
        if m.row == m.col:
            self.diag += v
        if m.row + m.col == self.n - 1:
            self.anti += v
        return self.n in map(abs, (self.rows[m.row], self.cols[m.col], self.diag, self.anti))

    def unrecord(self, m: Move) -> None: ...

class Player(ABC):
    def __init__(self, name: str, symbol: Symbol) -> None:
        self.name, self.symbol = name, symbol

    @abstractmethod
    def next_move(self, board: Board) -> tuple[int, int]: ...

class HumanPlayer(Player): ...        # reads from an input source
class RandomBot(Player): ...          # picks a random empty cell
class SmartBot(Player): ...           # win > block > centre > corner

class Game:
    def __init__(self, p1: Player, p2: Player, n: int = 3) -> None:
        self.board, self.tracker = Board(n), WinTracker(n)
        self.players = [p1, p2]
        self.turn = 0
        self.status = GameStatus.IN_PROGRESS
        self.history: list[Move] = []

    def play_turn(self) -> GameStatus: ...
    def apply(self, r: int, c: int) -> GameStatus: ...
    def undo(self) -> None: ...
```

## Key flows

1. **Start game**: create `Game(p1, p2, n)`; board empty, `turn = 0`, status `IN_PROGRESS`.
2. **Play a turn**: `current = players[turn % 2]`; `(r, c) = current.next_move(board)`; call `apply(r, c)`.
3. **Apply a move**: reject if status isn't `IN_PROGRESS` or `board.is_valid(r, c)` is false. Create `Move`, `board.place(move)`, append to history. If `tracker.record(move)` returns true, set status to that player's win. Else if `board.filled == n * n`, set `DRAW`. Otherwise increment `turn`.
4. **Undo**: pop the last move, `board.clear`, `tracker.unrecord`, decrement `turn`, set status back to `IN_PROGRESS`.

## Patterns used

- **Strategy**: `Player.next_move` lets humans and bots of varying difficulty plug in without touching `Game`.
- **Command (light)**: `Move` objects in a history list enable undo and replay.
- **Template Method (optional)**: a generic `BoardGame.play()` loop (`while not over: play_turn()`) shared with other board games.
- Deliberately *not* used: Singleton for `Game` (you'll want many games) and a class per cell.

## Concurrency & edge cases

- **Single game, single thread**: no locking needed. If games are hosted on a server, each game is its own aggregate; a per-game lock (or processing a game's moves through one queue) prevents two moves landing simultaneously.
- **Out-of-turn moves** in a networked version: validate that the requesting player is `players[turn % 2]`.
- **Moves after game over** must be rejected.
- **Win and full board on the same move**: check win before draw.
- **Large N**: the tracker keeps O(1) checks; a "K in a row on an N x N board" variant (Gomoku) needs a different check that scans outward from the last move in four directions, O(K).

## Follow-ups the interviewer may ask

**How do you make win detection O(1)?**
Keep running sums per row, column, and both diagonals with X as +1 and O as -1. After each move, only four counters change; a win is when any reaches +/-N.

**How would you add an AI player?**
Implement `Player` with minimax (with alpha-beta pruning) for 3 x 3, or the heuristic order win, block, centre, corner for larger boards. The game loop doesn't change.

**How would you support K-in-a-row on a larger board?**
Swap the win checker for a strategy that counts consecutive symbols outward from the last move in four directions; `WinChecker` becomes an interface.

**How do you support replay or spectators?**
The move history is enough to replay. For live spectators, have `Game` publish `MoveMade` events to observers.

**How would you support more than two players?**
Generalise `turn % len(players)`, give each player a distinct symbol, and replace the +1/-1 trick with per-player counters per line.
