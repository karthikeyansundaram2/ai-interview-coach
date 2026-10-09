import type { Track } from "@/lib/content/types";

export const lld: Track = {
  slug: "lld",
  name: "Low-Level Design",
  tagline: "Turn fuzzy requirements into clean, extensible class designs under interview pressure.",
  intro:
    "Low-level design interviews test whether you can model a real problem as cooperating objects, defend your trade-offs, and keep the design open for change. This track builds that skill from OOP and SOLID up through design patterns, concurrency, and a repeatable interview framework, all in idiomatic Python.",
  stages: [
    {
      name: "Principles",
      blurb: "The vocabulary every design discussion is built on: OOP, SOLID, coupling and cohesion, and how to sketch it all on a whiteboard.",
      modules: [
        {
          slug: "oop-foundations",
          title: "OOP Foundations",
          outcome: "Explain and apply the four pillars of OOP in Python, and choose composition over inheritance with a clear reason.",
          lessons: [
            { slug: "encapsulation", title: "Encapsulation", summary: "Hide state behind behaviour so objects protect their own invariants.", minutes: 8 },
            { slug: "abstraction", title: "Abstraction", summary: "Expose what an object does, not how it does it.", minutes: 8 },
            { slug: "inheritance-vs-composition", title: "Inheritance vs Composition", summary: "Why 'has-a' usually beats 'is-a', and when inheritance is still the right call.", minutes: 10 },
            { slug: "polymorphism", title: "Polymorphism", summary: "One interface, many implementations: the engine behind most design patterns.", minutes: 8 },
            { slug: "interfaces-and-abcs", title: "Interfaces, ABCs and Protocols in Python", summary: "Express contracts in Python with abc.ABC and typing.Protocol.", minutes: 10 },
          ],
        },
        {
          slug: "solid",
          title: "SOLID Principles",
          outcome: "Spot SOLID violations in a design and refactor them, explaining the concrete benefit of each change.",
          lessons: [
            { slug: "single-responsibility", title: "Single Responsibility Principle", summary: "A class should have one reason to change.", minutes: 8 },
            { slug: "open-closed", title: "Open/Closed Principle", summary: "Add behaviour by adding code, not by editing working code.", minutes: 8 },
            { slug: "liskov-substitution", title: "Liskov Substitution Principle", summary: "Subtypes must honour the promises of their parent type.", minutes: 9 },
            { slug: "interface-segregation", title: "Interface Segregation Principle", summary: "Many small, focused interfaces beat one fat one.", minutes: 7 },
            { slug: "dependency-inversion", title: "Dependency Inversion Principle", summary: "Depend on abstractions and inject the concrete pieces.", minutes: 9 },
          ],
        },
        {
          slug: "design-principles",
          title: "Everyday Design Principles",
          outcome: "Use DRY, KISS, YAGNI, the Law of Demeter, and coupling/cohesion as quick heuristics to judge a design.",
          lessons: [
            { slug: "dry-kiss-yagni", title: "DRY, KISS and YAGNI", summary: "Three rules of thumb that keep designs small and honest.", minutes: 8 },
            { slug: "law-of-demeter", title: "Law of Demeter", summary: "Talk to your friends, not to your friends' friends.", minutes: 7 },
            { slug: "coupling-and-cohesion", title: "Coupling and Cohesion", summary: "The two dials that decide how painful your design is to change.", minutes: 8 },
          ],
        },
        {
          slug: "uml-for-interviews",
          title: "UML for Interviews",
          outcome: "Draw a clear class diagram and sequence sketch quickly, using only the notation interviewers actually care about.",
          lessons: [
            { slug: "class-diagrams", title: "Class Diagrams That Communicate", summary: "The minimal UML you need to whiteboard a design in minutes.", minutes: 9 },
            { slug: "class-relationships", title: "Association, Aggregation and Composition", summary: "Name relationships precisely and pick the right multiplicity.", minutes: 8 },
          ],
        },
      ],
    },
    {
      name: "Patterns",
      blurb: "The classic Gang-of-Four patterns, each framed by the problem it solves and how it shows up in LLD interviews.",
      modules: [
        {
          slug: "creational-patterns",
          title: "Creational Patterns",
          outcome: "Pick the right way to construct objects so that creation logic stays flexible and testable.",
          lessons: [
            { slug: "singleton", title: "Singleton", summary: "Exactly one instance, and why you should be suspicious of it.", minutes: 8 },
            { slug: "factory-method", title: "Factory Method", summary: "Let a method decide which concrete class to create.", minutes: 8 },
            { slug: "abstract-factory", title: "Abstract Factory", summary: "Create families of related objects that must be used together.", minutes: 9 },
            { slug: "builder", title: "Builder", summary: "Assemble complex objects step by step with validation at the end.", minutes: 8 },
            { slug: "prototype", title: "Prototype", summary: "Create new objects by cloning a configured template.", minutes: 7 },
          ],
        },
        {
          slug: "structural-patterns",
          title: "Structural Patterns",
          outcome: "Compose objects into larger structures and wrap existing code without rewriting it.",
          lessons: [
            { slug: "adapter", title: "Adapter", summary: "Make an incompatible interface fit the one your code expects.", minutes: 7 },
            { slug: "decorator", title: "Decorator", summary: "Stack behaviour onto an object at runtime without subclass explosion.", minutes: 8 },
            { slug: "facade", title: "Facade", summary: "One simple front door to a complicated subsystem.", minutes: 7 },
            { slug: "proxy", title: "Proxy", summary: "A stand-in that controls access, caching, or lazy loading.", minutes: 8 },
            { slug: "composite", title: "Composite", summary: "Treat single objects and trees of objects the same way.", minutes: 8 },
          ],
        },
        {
          slug: "behavioral-patterns-core",
          title: "Behavioral Patterns I",
          outcome: "Model swappable algorithms, event notification, state machines, and undoable actions cleanly.",
          lessons: [
            { slug: "strategy", title: "Strategy", summary: "Swap algorithms at runtime behind a common interface.", minutes: 8 },
            { slug: "observer", title: "Observer", summary: "Notify many listeners when something changes, without knowing who they are.", minutes: 9 },
            { slug: "state", title: "State", summary: "Replace sprawling if/else on status with state objects.", minutes: 9 },
            { slug: "command", title: "Command", summary: "Turn a request into an object you can queue, log, or undo.", minutes: 8 },
          ],
        },
        {
          slug: "behavioral-patterns-flow",
          title: "Behavioral Patterns II",
          outcome: "Build processing pipelines, reusable algorithm skeletons, and clean traversal over collections.",
          lessons: [
            { slug: "chain-of-responsibility", title: "Chain of Responsibility", summary: "Pass a request along a chain of handlers until one deals with it.", minutes: 8 },
            { slug: "template-method", title: "Template Method", summary: "Fix the algorithm's skeleton, let subclasses fill in the steps.", minutes: 7 },
            { slug: "iterator", title: "Iterator", summary: "Traverse a collection without exposing how it is stored.", minutes: 7 },
          ],
        },
      ],
    },
    {
      name: "Architecture & Interview",
      blurb: "Make designs safe under concurrency, give them clean boundaries, and run the interview itself with a repeatable framework.",
      modules: [
        {
          slug: "concurrency-in-lld",
          title: "Concurrency in LLD",
          outcome: "Identify shared mutable state in a design and protect it with the right locking or queueing strategy.",
          lessons: [
            { slug: "thread-safety-and-locks", title: "Thread Safety and Locks", summary: "Find race conditions and fix them with the smallest correct lock.", minutes: 10 },
            { slug: "producer-consumer", title: "Producer-Consumer", summary: "Decouple work creation from work execution with a bounded queue.", minutes: 9 },
            { slug: "optimistic-vs-pessimistic-locking", title: "Optimistic vs Pessimistic Locking", summary: "Prevent double-booking with version checks or held locks.", minutes: 9 },
          ],
        },
        {
          slug: "apis-and-errors",
          title: "APIs and Error Handling",
          outcome: "Design class and service interfaces that are hard to misuse and fail loudly and predictably.",
          lessons: [
            { slug: "designing-apis", title: "Designing Class and Service APIs", summary: "Shape method signatures, return types, and boundaries that are hard to misuse.", minutes: 9 },
            { slug: "error-handling", title: "Error Handling in Designs", summary: "Domain exceptions, validation at the edges, and idempotent retries.", minutes: 9 },
          ],
        },
        {
          slug: "layering-and-architecture",
          title: "Layering and Clean Architecture",
          outcome: "Separate domain logic from storage and delivery so the core design survives infrastructure changes.",
          lessons: [
            { slug: "layered-and-clean-architecture", title: "Layered and Clean Architecture", summary: "Controllers, services, and domain: who may depend on whom.", minutes: 10 },
            { slug: "repository-pattern", title: "Repository Pattern", summary: "Hide persistence behind a collection-like interface.", minutes: 8 },
          ],
        },
        {
          slug: "lld-interview",
          title: "Running the LLD Interview",
          outcome: "Drive a 45-minute LLD round end to end with a framework that shows structure, judgement, and extensibility.",
          lessons: [
            { slug: "lld-interview-framework", title: "The LLD Interview Framework", summary: "Seven steps from vague prompt to defended design.", minutes: 12 },
            { slug: "lld-interview-walkthrough", title: "Worked Walkthrough and Pitfalls", summary: "The framework applied to a real prompt, minute by minute, plus the traps to avoid.", minutes: 12 },
          ],
        },
      ],
    },
  ],
  practiceLabel: "LLD Problems",
  practiceIntro:
    "Classic machine-coding and LLD prompts, each with clarified requirements, a class skeleton, key flows, and the follow-ups interviewers like to push on. Try sketching your own design for 30 minutes before opening the solution.",
  practice: [
    { slug: "tic-tac-toe", title: "Tic-Tac-Toe", level: "Easy", concepts: ["Game loop", "Strategy", "O(1) win check"], minutes: 30, summary: "An N x N board game with pluggable players and constant-time win detection." },
    { slug: "snake-and-ladder", title: "Snake and Ladder", level: "Easy", concepts: ["Game modelling", "Dice abstraction", "Turn order"], minutes: 30, summary: "A multiplayer board game with configurable board, dice, and jump rules." },
    { slug: "lru-cache", title: "LRU Cache", level: "Easy", concepts: ["Hash map + DLL", "Eviction policy", "Thread safety"], minutes: 30, summary: "A fixed-capacity cache with O(1) get/put and least-recently-used eviction." },
    { slug: "logging-framework", title: "Logging Framework", level: "Easy", concepts: ["Chain of Responsibility", "Singleton", "Async sinks"], minutes: 35, summary: "A logger with levels, formatters, and multiple pluggable output sinks." },
    { slug: "library-management", title: "Library Management System", level: "Easy", concepts: ["Entity modelling", "Reservations", "Fines"], minutes: 40, summary: "Members borrow, return, and reserve book copies with due dates and fines." },
    { slug: "parking-lot", title: "Parking Lot", level: "Medium", concepts: ["Strategy", "Spot allocation", "Concurrency"], minutes: 45, summary: "A multi-floor lot that allocates spots by vehicle type and charges on exit." },
    { slug: "vending-machine", title: "Vending Machine", level: "Medium", concepts: ["State pattern", "Change making", "Inventory"], minutes: 40, summary: "A coin-and-note machine modelled as an explicit state machine." },
    { slug: "rate-limiter", title: "Rate Limiter", level: "Medium", concepts: ["Token bucket", "Sliding window", "Strategy"], minutes: 40, summary: "A per-client limiter with swappable algorithms and thread-safe counters." },
    { slug: "atm", title: "ATM System", level: "Medium", concepts: ["State pattern", "Chain of Responsibility", "Transactions"], minutes: 45, summary: "Card authentication, withdrawals with note dispensing, and bank integration." },
    { slug: "splitwise", title: "Splitwise (Expense Sharing)", level: "Medium", concepts: ["Split strategies", "Balance ledger", "Debt simplification"], minutes: 45, summary: "Track shared expenses with equal, exact, and percentage splits and settle balances." },
    { slug: "notification-service", title: "Notification Service", level: "Medium", concepts: ["Observer", "Channel strategy", "Retries"], minutes: 40, summary: "Send templated notifications over email, SMS, and push with preferences and retries." },
    { slug: "meeting-room-scheduler", title: "Meeting Room Scheduler", level: "Medium", concepts: ["Interval overlap", "Locking", "Calendar"], minutes: 40, summary: "Book rooms for time slots without conflicts and suggest available rooms." },
    { slug: "inventory-order-management", title: "Inventory and Order Management", level: "Medium", concepts: ["Reservations", "Order state machine", "Idempotency"], minutes: 45, summary: "Reserve stock, place orders, and handle payment and cancellation without overselling." },
    { slug: "hotel-booking", title: "Hotel Booking System", level: "Medium", concepts: ["Date-range availability", "Pricing strategy", "Optimistic locking"], minutes: 45, summary: "Search and book hotel rooms across date ranges without double-booking." },
    { slug: "elevator-system", title: "Elevator System", level: "Hard", concepts: ["State pattern", "Scheduling strategy", "Concurrency"], minutes: 50, summary: "A bank of elevators that dispatches requests efficiently with pluggable scheduling." },
    { slug: "movie-ticket-booking", title: "Movie Ticket Booking (BookMyShow)", level: "Hard", concepts: ["Seat locking", "Hold expiry", "Payments"], minutes: 50, summary: "Browse shows, hold seats temporarily, and confirm bookings under heavy contention." },
    { slug: "ride-sharing", title: "Ride Sharing (Uber)", level: "Hard", concepts: ["Driver matching", "Trip state machine", "Pricing strategy"], minutes: 50, summary: "Match riders with nearby drivers, track trips through their lifecycle, and price them." },
    { slug: "food-delivery", title: "Food Delivery (Swiggy/Zomato)", level: "Hard", concepts: ["Order lifecycle", "Agent assignment", "Observer"], minutes: 50, summary: "Restaurants, carts, orders, and delivery-agent assignment with live status updates." },
    { slug: "chess", title: "Chess", level: "Hard", concepts: ["Polymorphic moves", "Command (undo)", "Rule validation"], minutes: 50, summary: "A two-player chess engine with per-piece move rules, check detection, and undo." },
    { slug: "pub-sub-message-queue", title: "Pub-Sub Message Queue", level: "Hard", concepts: ["Topics & partitions", "Consumer offsets", "Producer-consumer"], minutes: 50, summary: "An in-memory broker with topics, consumer groups, offsets, and at-least-once delivery." },
  ],
};
