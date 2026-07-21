// Vector icon set ported from the inline SVGs in design/mockups/deck.html —
// no emoji, no icon-font UI kit, just the mockup's own path data rendered
// with react-native-svg so every glyph matches the approved design exactly.
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function IconChevronDouble({ size = 11, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 9.5 12 4.5l5 5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 14.5l5 5 5-5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconHelp({ size = 16, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
      <Path
        d="M9.2 9.3a2.8 2.8 0 1 1 3.8 2.6c-.7.3-1 .8-1 1.6v.4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={17} r={0.9} fill={color} />
    </Svg>
  );
}

export function IconBattery({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={8} width={18} height={8} rx={2.4} stroke={color} strokeWidth={1.6} />
      <Rect x={4} y={10} width={12.5} height={4} rx={1} fill={color} opacity={0.85} />
      <Path d="M21.5 10.4v3.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconPrev({ size = 24, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 4.5v15l-10-7.5z" fill={color} />
      <Rect x={4.6} y={4.5} width={2.4} height={15} rx={1} fill={color} />
    </Svg>
  );
}

export function IconNext({ size = 24, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4.5v15l10-7.5z" fill={color} />
      <Rect x={17} y={4.5} width={2.4} height={15} rx={1} fill={color} />
    </Svg>
  );
}

// Seek 10s icons: IconRefresh's circular-arrow-plus-arrowhead shape (already
// approved for this stroke weight), mirrored for "back" via a <G> transform
// so the arrowhead reads as rewind vs fast-forward, with a small "10" set as
// real SVG text (not a hand-drawn digit path) centered in the loop.
export function IconSeekForward10({ size = 27, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 11a8 8 0 1 0-2.3 5.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 5v6h-6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <SvgText x={12} y={15.6} fontSize={8.5} fontWeight="800" fill={color} textAnchor="middle">
        10
      </SvgText>
    </Svg>
  );
}

export function IconSeekBack10({ size = 27, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform="scale(-1,1) translate(-24,0)">
        <Path d="M20 11a8 8 0 1 0-2.3 5.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M20 5v6h-6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </G>
      <SvgText x={12} y={15.6} fontSize={8.5} fontWeight="800" fill={color} textAnchor="middle">
        10
      </SvgText>
    </Svg>
  );
}

export function IconPlay({ size = 38, color = '#04140b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 4.2v15.6l14-7.8z" fill={color} />
    </Svg>
  );
}

export function IconPause({ size = 38, color = '#04140b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={6} y={4} width={4.4} height={16} rx={1.6} fill={color} />
      <Rect x={13.6} y={4} width={4.4} height={16} rx={1.6} fill={color} />
    </Svg>
  );
}

export function IconBrightnessDown({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.6} />
      <Path
        d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconBrightnessUp({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5.4} stroke={color} strokeWidth={1.6} />
      <Path
        d="M12 1.5v3M12 19.5v3M3.1 3.1l2.1 2.1M18.8 18.8l2.1 2.1M1.5 12h3M19.5 12h3M3.1 20.9l2.1-2.1M18.8 5.2l2.1-2.1"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconLock({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={10} rx={2.4} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconLockPartial({ size = 24, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10.5} width={14} height={10} rx={2.4} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M8 10.5V8.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconSleep({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12.5} r={8.2} stroke={color} strokeWidth={1.7} />
      <Path d="M12 7.6v5.1l3.4 2" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconVolume({ size = 24, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.6v4.8h3.4L12.5 19V5l-5.1 4.6H4Z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.4 9.2a4.2 4.2 0 0 1 0 5.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M18.7 6.8a7.8 7.8 0 0 1 0 10.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMute({ size = 24, color = '#f2795b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.6v4.8h3.4L12.5 19V5l-5.1 4.6H4Z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.4 10.4l3.8 3.8M20.2 10.4l-3.8 3.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconEye({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={2.9} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconEyeOff({ size = 20, color = '#4ade80' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4l16 16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M9.9 6.2A7.6 7.6 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a15.6 15.6 0 0 1-3 3.7M6.3 7.2A15 15 0 0 0 2.5 12S6 18.2 12 18.2a8.9 8.9 0 0 0 3.7-.8"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9.9 10.3a2.9 2.9 0 0 0 4 3.9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCheck({ size = 19, color = '#04140b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconRefresh({ size = 19, color = '#04140b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 11a8 8 0 1 0-2.3 5.6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M20 5v6h-6" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconDownload({ size = 18, color = '#4ade80' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v11.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7.5 10.5 12 15l4.5-4.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 19h14" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function IconWifiOff({ size = 26, color = '#f2795b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4l16 16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path
        d="M8.5 8.7a10 10 0 0 1 11 1.7M5.5 11.7a10 10 0 0 1 2.4-1.8M2 8.7a14 14 0 0 1 3.4-2.4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 18.6h.01" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconWindows({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={4} y={4} width={7.2} height={7.2} rx={1} />
      <Rect x={12.8} y={4} width={7.2} height={7.2} rx={1} />
      <Rect x={4} y={12.8} width={7.2} height={7.2} rx={1} />
      <Rect x={12.8} y={12.8} width={7.2} height={7.2} rx={1} />
    </Svg>
  );
}

export function IconPlus({ size = 16, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconX({ size = 11, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5l14 14M19 5L5 19" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMinus({ size = 16, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevronStack({ size = 15, color = '#4ade80' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12.5} r={8.2} stroke={color} strokeWidth={1.7} />
      <Path d="M12 7.6v5.1l3.4 2" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCursor({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 3.5 19 9.8l-6.2 1.7-2.6 6.1z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconArrowUpRight({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 17 17 7" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.5 7H17v8.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconMoon({ size = 24, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a7 7 0 0 0 10.2 10.2Z" />
    </Svg>
  );
}

export function IconBook({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 6.2C10.4 5 8.2 4.6 5.2 4.6a1 1 0 0 0-1 1v11.3a1 1 0 0 0 1 1c3 0 5.2.4 6.8 1.6 1.6-1.2 3.8-1.6 6.8-1.6a1 1 0 0 0 1-1V5.6a1 1 0 0 0-1-1c-3 0-5.2.4-6.8 1.6Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M12 6.2v13.3" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevronLeft({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 5 8 12l6.5 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronRight({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.5 5 16 12l-6.5 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconApps({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={3.5} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={2} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconMonitor({ size = 16, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4.5} width={18} height={12.5} rx={2.2} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M12 17v3.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M8.2 20.5h7.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// Vertical mixer: three fader lines with a knob at a different height on
// each, matching the 1.6 stroke weight of the rest of the set.
export function IconSliders({ size = 16, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4.5v4.2M6 12.3v7.2M12 4.5v8.7M12 16.8v2.7M18 4.5v1.7M18 9.8v9.7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx={6} cy={10.5} r={1.8} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={15} r={1.8} stroke={color} strokeWidth={1.6} />
      <Circle cx={18} cy={8} r={1.8} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconArrowLeft({ size = 20, color = '#f3f5f1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11 6 5 12l6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
