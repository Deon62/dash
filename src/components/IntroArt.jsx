import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { COLORS } from "@/theme/colors";

/**
 * The three intro illustrations.
 *
 * Drawn rather than iconified: an outline glyph in a grey disc says "this is a
 * feature", where a picture of the thing says what the thing is. They are also
 * where the intro gets its colour — the palette appears here, doing a job,
 * instead of being sprayed over type that is meant to stay quiet.
 *
 * All three share a 200×150 viewBox, the same corner radius and the same
 * baseline, so the artwork does not jump as the carousel pages.
 */

const W = 200;
const H = 150;

function Frame({ children }) {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      {children}
    </Svg>
  );
}

/** Units as a fanned stack of files, each with its own coloured spine. */
export function FiledArt() {
  const cards = [
    { x: 18, y: 74, tint: COLORS.teal },
    { x: 30, y: 50, tint: COLORS.violet },
    { x: 42, y: 26, tint: COLORS.primary },
  ];

  return (
    <Frame>
      {cards.map((card, index) => (
        <G key={card.tint}>
          <Rect
            x={card.x}
            y={card.y}
            width={140}
            height={50}
            rx={10}
            fill={COLORS.canvas}
            stroke={COLORS.line}
            strokeWidth={1.5}
          />
          {/* The spine is the unit's identity, the way the code is in the app. */}
          <Rect x={card.x + 12} y={card.y + 14} width={4} height={22} rx={2} fill={card.tint} />
          <Rect
            x={card.x + 26}
            y={card.y + 17}
            width={index === 2 ? 62 : 48}
            height={5}
            rx={2.5}
            fill={COLORS.ink}
            opacity={0.8}
          />
          <Rect
            x={card.x + 26}
            y={card.y + 29}
            width={index === 2 ? 88 : 70}
            height={4}
            rx={2}
            fill={COLORS.line}
          />
        </G>
      ))}
    </Frame>
  );
}

/** A note with one passage picked out — an answer quoting the source. */
export function NotesArt() {
  return (
    <Frame>
      <Rect
        x={16}
        y={14}
        width={104}
        height={122}
        rx={12}
        fill={COLORS.canvas}
        stroke={COLORS.line}
        strokeWidth={1.5}
      />

      {[30, 44, 58].map((y) => (
        <Rect
          key={y}
          x={30}
          y={y}
          width={y === 58 ? 52 : 76}
          height={5}
          rx={2.5}
          fill={COLORS.line}
        />
      ))}

      {/* The quoted lines: what the tutor found, marked in the note itself.
          Everything here stops short of x=106 so the answer card overlapping
          from the right never covers a word of it. */}
      <Rect x={24} y={74} width={82} height={30} rx={7} fill={COLORS.primary} opacity={0.1} />
      <Rect x={30} y={82} width={4} height={14} rx={2} fill={COLORS.primary} />
      <Rect x={42} y={83} width={56} height={5} rx={2.5} fill={COLORS.primary} opacity={0.85} />
      <Rect x={42} y={92} width={38} height={5} rx={2.5} fill={COLORS.primary} opacity={0.45} />

      <Rect x={30} y={116} width={58} height={4} rx={2} fill={COLORS.line} />

      {/* The answer, lifted straight off the page and sitting over it. */}
      <Rect
        x={110}
        y={58}
        width={74}
        height={56}
        rx={12}
        fill={COLORS.canvas}
        stroke={COLORS.primary}
        strokeWidth={1.5}
      />
      <Rect x={122} y={76} width={50} height={5} rx={2.5} fill={COLORS.primary} />
      <Rect x={122} y={88} width={34} height={5} rx={2.5} fill={COLORS.primary} opacity={0.4} />
      <Path
        d="M122 114 l0 11 l11 -11 z"
        fill={COLORS.canvas}
        stroke={COLORS.primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/**
 * A month card with the marks on it, in the colours the real calendar uses.
 *
 * Laid out on a five-column grid with one spacing value, so the dates line up
 * under the weekday ticks and the dots line up under the dates. The earlier
 * version placed everything by eye and the columns did not agree.
 */
export function CalendarArt() {
  const LEFT = 38;
  const STEP = 25;
  /** Column centres: 50, 75, 100, 125, 150. */
  const columns = [0, 1, 2, 3, 4].map((i) => LEFT + 12 + i * STEP);

  const rows = [
    { date: 72, dot: 88 },
    { date: 104, dot: 120 },
  ];

  /** `[row, column]` -> the colour of that day's mark. */
  const marks = [
    { row: 0, column: 1, tint: COLORS.pink },
    { row: 0, column: 3, tint: COLORS.primary },
    { row: 1, column: 2, tint: COLORS.danger },
    { row: 1, column: 4, tint: COLORS.amber },
  ];

  /** Today sits in the first row, first column — the one dark disc. */
  const today = { row: 0, column: 0 };

  return (
    <Frame>
      <Rect
        x={22}
        y={18}
        width={156}
        height={118}
        rx={16}
        fill={COLORS.canvas}
        stroke={COLORS.line}
        strokeWidth={1.5}
      />

      {/* Month name. */}
      <Rect x={LEFT} y={36} width={46} height={6} rx={3} fill={COLORS.ink} opacity={0.85} />

      {/* Weekday ticks, one per column. */}
      {columns.map((cx) => (
        <Rect key={`w${cx}`} x={cx - 5} y={54} width={10} height={3} rx={1.5} fill={COLORS.line} />
      ))}

      {/* Dates. */}
      {rows.map((row, rowIndex) =>
        columns.map((cx, columnIndex) => {
          const isToday = today.row === rowIndex && today.column === columnIndex;

          return (
            <Circle
              key={`d${rowIndex}-${columnIndex}`}
              cx={cx}
              cy={row.date}
              r={9}
              fill={isToday ? COLORS.ink : COLORS.surface}
            />
          );
        })
      )}

      {/* Marks, directly under the day they belong to. */}
      {marks.map((mark) => (
        <Circle
          key={`m${mark.row}-${mark.column}`}
          cx={columns[mark.column]}
          cy={rows[mark.row].dot}
          r={3.5}
          fill={mark.tint}
        />
      ))}
    </Frame>
  );
}
