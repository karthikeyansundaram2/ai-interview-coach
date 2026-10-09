// Frame model for the step-through visualizers.
// A trace function runs the algorithm once and records a Frame per meaningful step;
// the player just scrubs through the recorded frames.

export type Tone = "accent" | "good" | "okay" | "weak" | "info" | "violet" | "muted";

export type Cell = string | number;

export interface Pointer {
  label: string;
  index: number;
  tone?: Tone;
}

export interface ArrayView {
  kind: "array";
  title?: string;
  items: Cell[];
  pointers?: Pointer[];
  /** inclusive [l, r] bracket drawn under the cells */
  window?: [number, number];
  windowTone?: Tone;
  tones?: Record<number, Tone>;
  dim?: number[];
  /** small value printed under each cell (e.g. answer[i], dp[i]) */
  sub?: (Cell | null)[];
  subLabel?: string;
  /** show indices above cells (default true) */
  indices?: boolean;
  /** label each index with this instead of the number */
  indexLabels?: string[];
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: Cell;
  sub?: Cell;
  hidden?: boolean;
  ghost?: boolean;
}
export interface GraphEdge {
  from: string;
  to: string;
  directed?: boolean;
  tone?: Tone;
  dashed?: boolean;
  hidden?: boolean;
  curve?: number;
}
export interface GraphView {
  kind: "graph";
  title?: string;
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  tones?: Record<string, Tone>;
  pointers?: { label: string; node: string; tone?: Tone; below?: boolean }[];
  nodeRadius?: number;
}

export interface GridView {
  kind: "grid";
  title?: string;
  cells: Cell[][];
  tones?: Record<string, Tone>; // key "r,c"
  cursor?: [number, number];
}

export interface TableView {
  kind: "table";
  title?: string;
  rowHeaders: string[];
  colHeaders: string[];
  cells: (Cell | null)[][];
  tones?: Record<string, Tone>; // key "r,c"
  cursor?: [number, number];
}

export interface IntervalsView {
  kind: "intervals";
  title?: string;
  rows: { label: string; items: { range: [number, number]; tone?: Tone; dim?: boolean }[] }[];
  min: number;
  max: number;
}

export type View = ArrayView | GraphView | GridView | TableView | IntervalsView;

export interface Aux {
  label: string;
  kind: "list" | "stack" | "queue" | "map";
  items: Cell[] | [Cell, Cell][];
  highlight?: number[];
  empty?: string;
}

export interface Frame {
  line: number;
  note: string;
  views: View[];
  aux?: Aux[];
  vars?: Record<string, Cell | boolean | null>;
  done?: boolean;
}

export interface InputField {
  key: string;
  label: string;
  type: "numbers" | "number" | "text";
  default: string;
  hint?: string;
}

export type Inputs = Record<string, string>;

export interface VizSpec {
  title: string;
  problem: string;
  code: string;
  inputs?: InputField[];
  trace: (inputs: Inputs) => Frame[];
}
