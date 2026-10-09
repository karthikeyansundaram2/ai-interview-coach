Design the control system for a bank of elevators in a building: accept hall calls and in-car requests, dispatch elevators efficiently, and move cars safely. It's hard because it mixes a per-car state machine, a dispatching strategy, and real-time concurrency.

## Requirements

**Functional**

- N elevators serving floors 0..F.
- Hall calls: a person on a floor presses UP or DOWN.
- Car calls: a person inside presses a destination floor.
- Dispatcher assigns each hall call to the best elevator.
- Each car moves floor by floor, stops at requested floors, opens and closes doors.
- Display current floor and direction; capacity/overload detection; maintenance mode; emergency stop.

**Non-functional**

- Minimise average wait time and avoid starvation (every request is eventually served).
- Thread-safe: button presses arrive concurrently with car movement.
- Scheduling policy must be swappable (SCAN/LOOK, nearest car, zoning for peak hours).
- Safety: doors never open while moving.

## Core entities

| Entity | Responsibility |
| --- | --- |
| `Direction` (enum) | UP, DOWN, IDLE |
| `HallCall` | Floor and direction |
| `ElevatorCar` | Current floor, direction, state, stop sets, capacity |
| `CarState` | IDLE, MOVING_UP, MOVING_DOWN, DOORS_OPEN, MAINTENANCE |
| `DispatchStrategy` | Chooses a car for a hall call |
| `CarController` | Runs one car's loop: decide next stop, move, open doors |
| `ElevatorSystem` | Facade: receives calls, owns cars and dispatcher |
| `Display` / observers | Receive floor/direction updates |

## Class design

```python
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

class Direction(Enum):
    UP = 1
    DOWN = -1
    IDLE = 0

class CarState(Enum):
    IDLE = "idle"
    MOVING = "moving"
    DOORS_OPEN = "doors_open"
    MAINTENANCE = "maintenance"

@dataclass(frozen=True)
class HallCall:
    floor: int
    direction: Direction

@dataclass
class ElevatorCar:
    car_id: int
    floor: int = 0
    direction: Direction = Direction.IDLE
    state: CarState = CarState.IDLE
    up_stops: set[int] = field(default_factory=set)
    down_stops: set[int] = field(default_factory=set)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def add_stop(self, floor: int) -> None:
        with self.lock:
            (self.up_stops if floor > self.floor else self.down_stops).add(floor)

    def next_stop(self) -> int | None:
        """LOOK: keep going in the current direction while stops remain, then reverse."""
        with self.lock:
            ups = [f for f in self.up_stops if f >= self.floor]
            downs = [f for f in self.down_stops if f <= self.floor]
            if self.direction in (Direction.UP, Direction.IDLE) and ups:
                return min(ups)
            if downs:
                return max(downs)
            return min(ups) if ups else None

    def pending(self) -> int:
        return len(self.up_stops) + len(self.down_stops)

class DispatchStrategy(ABC):
    @abstractmethod
    def choose(self, cars: list[ElevatorCar], call: HallCall) -> ElevatorCar: ...

class NearestSuitableCar(DispatchStrategy):
    def choose(self, cars: list[ElevatorCar], call: HallCall) -> ElevatorCar:
        def cost(c: ElevatorCar) -> tuple[int, int]:
            distance = abs(c.floor - call.floor)
            on_the_way = (c.direction == Direction.IDLE or
                          (c.direction == call.direction and
                           (call.floor - c.floor) * c.direction.value >= 0))
            return (0 if on_the_way else 1, distance + 2 * c.pending())
        usable = [c for c in cars if c.state is not CarState.MAINTENANCE]
        return min(usable, key=cost)

class CarController:
    def __init__(self, car: ElevatorCar, floor_travel_s: float = 1.0) -> None:
        self.car, self.travel_s = car, floor_travel_s
        self.wake = threading.Event()

    def run(self) -> None: ...          # loop: next_stop -> step one floor -> arrive -> doors
    def _arrive(self, floor: int) -> None: ...   # remove stop, DOORS_OPEN, wait, close

class ElevatorSystem:
    def __init__(self, n_cars: int, floors: int, strategy: DispatchStrategy) -> None:
        self.floors = floors
        self.cars = [ElevatorCar(i) for i in range(n_cars)]
        self.controllers = [CarController(c) for c in self.cars]
        self.strategy = strategy
        self._dispatch_lock = threading.Lock()

    def hall_call(self, floor: int, direction: Direction) -> int:
        with self._dispatch_lock:
            car = self.strategy.choose(self.cars, HallCall(floor, direction))
        car.add_stop(floor)
        self.controllers[car.car_id].wake.set()
        return car.car_id

    def car_call(self, car_id: int, floor: int) -> None: ...   # add_stop + wake
```

## Key flows

1. **Hall call**: `hall_call(7, UP)` -> the dispatcher scores cars (prefers idle cars or cars already moving toward floor 7 in the same direction, then by distance and load) -> adds floor 7 as a stop on the chosen car -> wakes its controller.
2. **Car call**: passenger presses 12 inside car 2 -> `car_call(2, 12)` adds the stop and wakes the controller.
3. **Car loop** (per controller thread):
   1. `target = car.next_stop()`; if `None`, set IDLE and wait on `wake`.
   2. Set direction toward target, state MOVING, move one floor per tick, publishing floor updates.
   3. On reaching a floor in its stop set: remove it, state DOORS_OPEN, wait for the dwell time (extend if the door sensor is blocked), close doors.
   4. Repeat.
4. **Maintenance**: mark car MAINTENANCE; the dispatcher stops assigning to it; reassign its pending hall calls to other cars.

## Patterns used

- **Strategy**: `DispatchStrategy` (nearest suitable car, zoning, destination dispatch) and car scheduling (LOOK vs FCFS) are swappable.
- **State**: car states govern allowed actions (no door-open while MOVING, no assignments in MAINTENANCE). A full State-pattern implementation is natural if behaviours grow.
- **Observer**: floor displays, hall lanterns, and monitoring subscribe to car events.
- **Command**: button presses as request objects make logging and replay simple.
- **Facade**: `ElevatorSystem` is the single entry point for the building's panels.

## Concurrency & edge cases

- Button presses (many threads) and controllers (one thread per car) touch each car's stop sets: guarded by a per-car lock; dispatch decisions serialised by a dispatcher lock so two calls don't both pick based on stale load.
- Controllers sleep on an `Event` instead of busy-waiting.
- **Duplicate presses**: sets deduplicate stops; hall calls already assigned are ignored.
- **Starvation**: LOOK guarantees service because the car reverses only after finishing its current direction; add aging for hall calls waiting too long.
- **Overload**: weight sensor blocks door close and departure.
- **Emergency/fire mode**: cancel all stops, return to the ground floor, open doors.
- **Request for the current floor** while doors are closing: reopen.

## Follow-ups the interviewer may ask

**Why LOOK instead of first-come-first-served?**
FCFS makes cars zig-zag and increases total travel. LOOK (like disk scheduling) serves all stops in one direction before reversing, which is efficient and starvation-free.

**How would you handle morning rush hour?**
Swap in a zoning strategy: assign cars to floor bands and park idle cars at the lobby. That's a new `DispatchStrategy`, configured by time of day.

**What is destination dispatch?**
Passengers enter their destination in the lobby; the system groups people going to nearby floors into the same car, reducing stops. The dispatcher sees destinations, not just directions.

**How would you test this?**
Run the controller with a simulated clock and a fake motor, feed a script of calls, and assert on stop order, wait times, and that doors never open while moving.
