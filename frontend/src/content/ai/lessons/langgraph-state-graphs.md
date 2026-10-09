LangGraph models an LLM application as a graph: nodes do work, edges decide what runs next, and a shared typed state flows through it all. Because graphs can loop, it handles agents naturally — while keeping control flow explicit and debuggable.

## The analogy

A flowchart on a whiteboard for processing a loan application: "check documents → if incomplete, request more → loop back; if complete, assess risk → if high, manual review; else approve". Each box is a node, each arrow is an edge, and the application folder that travels between boxes is the state. LangGraph lets you run that flowchart, with LLMs inside some of the boxes.

## Core concepts

- **State**: a typed dict (or Pydantic model) shared by all nodes.
- **Nodes**: functions that receive the state and return a *partial update*.
- **Reducers**: rules for merging updates into state per key — overwrite by default, or append (e.g. for message lists).
- **Edges**: fixed transitions (`A → B`) or **conditional edges** that call a routing function to pick the next node.
- **START / END**: special entry and exit points.
- **Compile**: turns the builder into a runnable graph, optionally with a checkpointer.

```text
            ┌──────────┐
 START ───► │  agent   │ ──(no tool calls)──► END
            └────┬─────┘
       tool calls│    ▲
                 ▼    │
            ┌──────────┐
            │  tools   │
            └──────────┘
```

## A tool-calling agent from scratch

```python
from typing import Annotated, TypedDict
from langchain_core.messages import AnyMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]   # reducer: append/merge by id
    steps: int                                             # default reducer: overwrite

@tool
def get_weather(city: str) -> str:
    """Current weather for a city."""
    return f"{city}: 31°C, humid"

tools = [get_weather]
llm = make_chat_model().bind_tools(tools)   # any LangChain chat model

def agent(state: State) -> dict:
    reply = llm.invoke(state["messages"])
    return {"messages": [reply], "steps": state.get("steps", 0) + 1}

def route(state: State) -> str:
    if state["steps"] >= 8:
        return END                                   # hard step cap
    return tools_condition(state)                    # "tools" if tool calls, else END

builder = StateGraph(State)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode(tools))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", route, ["tools", END])
builder.add_edge("tools", "agent")
graph = builder.compile()

out = graph.invoke({"messages": [("user", "Weather in Chennai?")], "steps": 0})
print(out["messages"][-1].content)
```

`add_messages` is a reducer: when a node returns `{"messages": [reply]}`, the reply is appended rather than replacing the list. Other keys like `steps` are simply overwritten.

## Why a graph instead of a while-loop?

You *can* write an agent as a loop. LangGraph pays off when:

- **Control flow mixes fixed and dynamic steps**: e.g., always classify → retrieve → then let an agent loop → always run a safety check.
- **You need persistence**: checkpoint after every node so runs survive crashes and conversations resume by thread ID (next lesson).
- **You need human-in-the-loop**: pause before a node, wait for approval, resume.
- **You want streaming and visibility**: stream node updates or tokens; render the graph; trace each step.
- **Subgraphs**: compose a research subgraph inside a larger workflow, or build multi-agent supervisors where each agent is a node.

## Design tips

- **Keep state minimal and typed.** Store what downstream nodes need (messages, retrieved docs, plan, flags), not every intermediate blob.
- **Nodes return partial updates.** Don't mutate the input state in place.
- **Make routing functions pure and cheap** — they read state and return a node name.
- **Put limits in state** (step counters, budgets) and check them in routers.
- **Use `Send`** (LangGraph's fan-out primitive) when you need dynamic parallel branches, such as one worker per sub-question, with a reducer to collect results.

## Common mistakes

- Forgetting a reducer on a list field, so parallel branches overwrite each other's results.
- Returning the entire state from a node and accidentally clobbering keys.
- Graphs with cycles and no exit condition — always include a cap.
- Using LangGraph for a two-step chain where plain functions would do.

## In the interview

**Q: What does LangGraph add over a simple agent loop?**
Explicit state and control flow as a graph, reducers for merging updates, built-in checkpointing for persistence and resumption, interrupts for human-in-the-loop, streaming, and composition via subgraphs.

**Q: What is a reducer?**
A per-key function that defines how a node's partial update merges into the existing state — e.g. `add_messages` appends messages, while the default overwrites the value.

**Q: How do you model a ReAct agent in LangGraph?**
An agent node calls a tool-bound model; a conditional edge routes to a tool node if there are tool calls, else to END; the tool node routes back to the agent. Add a step cap in state.

## Key takeaways

- LangGraph = typed state + nodes + edges (including conditional and cyclic ones).
- Nodes return partial updates; reducers define how they merge.
- It shines with mixed control flow, persistence, HITL, and composition.
- Always cap cycles and keep state lean.
