Design a Snake and Ladder game for multiple players on a configurable board. The problem checks clean modelling of a board with jumps, a turn loop, and how you make randomness (dice) swappable and testable.

## Requirements

**Functional**

- Board of N cells (default 100); configurable snakes (head to tail, going down) and ladders (bottom to top, going up).
- 2+ players start at position 0 and take turns rolling a die.
- Move forward by the roll; if you land on a snake head or ladder bottom, jump to its end.
- A player wins on reaching exactly N; overshooting means no move (configurable rule).
- Optional rules: rolling a 6 gives another turn, three 6s in a row forfeits the turn, multiple dice.
- Game ends when one player wins (or continues until ranking is decided, configurable).

**Non-functional**

- Dice must be injectable for deterministic tests.
- Rules should be extendable without rewriting the game loop.
- Board configuration validated at startup: no cycles, no jump starting at N, no two jumps on the same cell.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Board` | Size, jump map (`dict[int, int]`), `final_position(pos)` |
| `Jump` | Value object: start, end; snake if end < start, ladder otherwise |
| `Dice` (interface) | `roll() -> int`; `StandardDice`, `MultiDice`, `FixedSequenceDice` for tests |
| `Player` | Name and current position |
| `RuleSet` | Overshoot rule, extra-turn-on-six, win condition |
| `Game` | Turn queue, applies rolls, tracks winners and history |

## Class design

```python
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass
import random

@dataclass(frozen=True)
class Jump:
    start: int
    end: int

    @property
    def is_snake(self) -> bool:
        return self.end < self.start

class Board:
    def __init__(self, size: int, jumps: list[Jump]) -> None:
        self.size = size
        self._jumps = {j.start: j.end for j in jumps}
        self._validate()

    def _validate(self) -> None: ...   # no jump at 0 or size, no duplicate starts, no cycles

    def final_position(self, pos: int) -> int:
        seen = set()
        while pos in self._jumps and pos not in seen:   # chained jumps allowed
            seen.add(pos)
            pos = self._jumps[pos]
        return pos

class Dice(ABC):
    @abstractmethod
    def roll(self) -> int: ...

class StandardDice(Dice):
    def __init__(self, count: int = 1, faces: int = 6, rng: random.Random | None = None) -> None:
        self.count, self.faces = count, faces
        self._rng = rng or random.Random()

    def roll(self) -> int:
        return sum(self._rng.randint(1, self.faces) for _ in range(self.count))

class FixedSequenceDice(Dice): ...      # for tests: replays a given sequence

@dataclass
class Player:
    name: str
    position: int = 0

@dataclass(frozen=True)
class RuleSet:
    exact_finish: bool = True
    extra_turn_on: int | None = 6
    max_consecutive_extra: int = 2

@dataclass(frozen=True)
class TurnResult:
    player: str
    roll: int
    start: int
    end: int
    won: bool

class Game:
    def __init__(self, board: Board, players: list[Player], dice: Dice,
                 rules: RuleSet = RuleSet()) -> None:
        self.board, self.dice, self.rules = board, dice, rules
        self._queue: deque[Player] = deque(players)
        self.winners: list[Player] = []
        self.log: list[TurnResult] = []

    def play_turn(self) -> TurnResult: ...
    def play(self) -> list[Player]: ...
    def _next_position(self, pos: int, roll: int) -> int: ...
```

## Key flows

1. **Setup**: build `Board(size, jumps)` and validate; create players at 0; inject dice and rules.
2. **Play a turn**:
   1. Pop the current player from the front of the queue.
   2. `roll = dice.roll()`.
   3. `target = pos + roll`; if `target > size` and `exact_finish`, stay put.
   4. `end = board.final_position(target)`; update position; append `TurnResult` to the log.
   5. If `end == size`, add to winners and don't requeue. Otherwise requeue at the back, or at the front if an extra turn is earned (within the consecutive limit).
3. **Play game**: loop `play_turn()` until one winner (or until one player remains, if ranking all).

## Patterns used

- **Strategy**: `Dice` implementations (single, multiple, loaded/fixed for tests) and potentially `RuleSet` variants.
- **Dependency injection**: dice and RNG are passed in, making tests deterministic.
- **Value objects**: `Jump`, `TurnResult`, `RuleSet` are immutable and self-describing.
- Not needed: a `Snake` class and a `Ladder` class with behaviour. They differ only in direction, so one `Jump` value object (with an `is_snake` property for display) is enough.

## Concurrency & edge cases

- Single game loop, single thread; if hosted online, process each game's turns sequentially via a per-game lock or queue.
- **Overshoot**: decide and state the rule (stay vs bounce back).
- **Chained jumps**: a ladder ending on a snake head; handle via a loop and validate against cycles.
- **Invalid boards**: a snake at the final cell, two jumps from one cell, jumps outside the board.
- **Infinite games**: with exact finish rules and bad luck, games can be long; add a max-turn safeguard for simulations.

## Follow-ups the interviewer may ask

**How do you test the game deterministically?**
Inject `FixedSequenceDice([3, 6, 2, ...])` or a seeded `random.Random`, then assert on the turn log.

**How would you add special cells (skip a turn, teleport)?**
Generalise `Jump` into a `CellEffect` interface with `apply(player, game)`; jumps become one effect type. The board maps cells to effects.

**How do you support multiple simultaneous games?**
Each `Game` is independent with its own board reference (boards are immutable and can be shared) and its own players. A `GameManager` maps game IDs to games.

**How would you generate a random valid board?**
Randomly place jumps while rejecting ones that start at existing jump starts, end at the final cell, or create cycles; cap snake and ladder lengths for balance.
