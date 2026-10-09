Command turns a request into an object that carries everything needed to perform it. Once a request is an object, you can queue it, log it, retry it, schedule it, or undo it.

## The idea

At a restaurant, the waiter writes your order on a slip and pins it on the kitchen rail. The slip is a **command**: it holds what to make and for which table. The waiter doesn't cook; the chef doesn't talk to customers. The slips can be queued, prioritised, or cancelled, and there's a record of what was ordered.

```text
 Invoker ──holds──> Command ──calls──> Receiver
 (Button,           execute()          (TextDocument,
  Queue)            undo()              BankAccount)
```

## Why it matters

When actions are plain method calls, they vanish after running. Turning them into objects gives you:

- **Undo/redo**: each command knows how to reverse itself.
- **Queuing and scheduling**: workers execute commands later.
- **Audit logs**: store the commands that changed state.
- **Macros**: a list of commands is itself a command.

```python
from abc import ABC, abstractmethod

class TextDocument:                      # receiver
    text: str = ""

class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...
    @abstractmethod
    def undo(self) -> None: ...

class Append(Command):
    def __init__(self, doc: TextDocument, s: str) -> None:
        self.doc, self.s = doc, s
    def execute(self) -> None:
        self.doc.text += self.s
    def undo(self) -> None:
        self.doc.text = self.doc.text[: -len(self.s)]

class DeleteLast(Command):
    def __init__(self, doc: TextDocument, n: int) -> None:
        self.doc, self.n, self.removed = doc, n, ""
    def execute(self) -> None:
        self.removed, self.doc.text = self.doc.text[-self.n:], self.doc.text[: -self.n]
    def undo(self) -> None:
        self.doc.text += self.removed

class Editor:                            # invoker with history
    def __init__(self) -> None:
        self._done: list[Command] = []
        self._undone: list[Command] = []
    def run(self, cmd: Command) -> None:
        cmd.execute()
        self._done.append(cmd)
        self._undone.clear()             # new action invalidates redo
    def undo(self) -> None:
        if self._done:
            (cmd := self._done.pop()).undo()
            self._undone.append(cmd)
    def redo(self) -> None:
        if self._undone:
            (cmd := self._undone.pop()).execute()   # not run(): that clears redo
            self._done.append(cmd)

doc, ed = TextDocument(), Editor()
for cmd in (Append(doc, "Hello"), Append(doc, " world"), DeleteLast(doc, 6)):
    ed.run(cmd)
ed.undo()
print(doc.text)   # Hello world
```

## When to use / when not to

Use Command for undo/redo (editors, chess move history), job queues and schedulers, transactional operations you want to log or replay, and remote control style interfaces (elevator buttons, smart-home actions). Avoid it for simple direct calls with no need to defer, log, or reverse; wrapping every method call in a class is noise.

## Common mistakes

- Commands that capture too little state to undo correctly (store what you removed, not just how much).
- Forgetting to clear the redo stack after a new action.
- Commands with side effects outside the receiver that can't be undone (sending an email); mark them as irreversible or use compensating actions.
- Putting business rules in the invoker instead of the receiver.

## In the interview

**Q: How would you implement undo in chess?**
Each move is a `MoveCommand` storing the piece, from/to squares, any captured piece, and special flags (castling, promotion). `undo()` restores all of it; the game keeps a history stack.

**Q: Command vs Strategy?**
Strategy encapsulates *how* to do something and is reused many times. Command encapsulates *a specific request* with its parameters, usually executed once and possibly reversed.

**Q: How does Command relate to message queues?**
A queued job is a serialised command: a type plus parameters that a worker executes later. Idempotency keys make retries safe.

## Key takeaways

- Command = a request as an object with `execute()` (and often `undo()`).
- Enables undo/redo, queuing, logging, and macros.
- Store enough state to reverse the action exactly.
- Clear the redo stack on new actions.
