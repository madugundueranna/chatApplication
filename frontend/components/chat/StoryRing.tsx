import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

// A segmented story ring: one arc per story (Instagram-style). Each segment is
// the colourful gradient when UNVIEWED and grey when VIEWED. A single story draws
// one continuous ring. `viewedFlags[i]` = whether story i has been seen.
type StoryRingProps = {
  size: number; // outer ring box (px)
  stroke?: number; // ring thickness
  viewedFlags: boolean[];
};

const SEEN = "#D9DCE1";

export function StoryRing({ size, stroke = 3, viewedFlags }: StoryRingProps) {
  const flags = viewedFlags.length ? viewedFlags : [false];
  const n = flags.length;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = n > 1 ? 6 : 0; // visual break between segments
  const segment = circumference / n;
  const dash = Math.max(segment - gap, 1);

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="storyGradient" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#FEDA75" />
          <Stop offset="0.35" stopColor="#FA7E1E" />
          <Stop offset="0.6" stopColor="#D62976" />
          <Stop offset="0.85" stopColor="#962FBF" />
          <Stop offset="1" stopColor="#4F5BD5" />
        </LinearGradient>
      </Defs>
      {flags.map((viewed, i) => (
        <Circle
          key={i}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={viewed ? SEEN : "url(#storyGradient)"}
          strokeWidth={stroke}
          strokeLinecap={n > 1 ? "round" : "butt"}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-(i * segment)}
          // Start segments at the top of the circle.
          transform={`rotate(-90 ${c} ${c})`}
        />
      ))}
    </Svg>
  );
}
