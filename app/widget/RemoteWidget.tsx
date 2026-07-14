// Home-screen widget UI: five buttons, no state beyond static labels — the
// server is the source of truth and the widget never blocks on a fetch to
// render. Kept intentionally dead simple (react-native-android-widget renders
// this to Android RemoteViews, not a real view hierarchy). Icons are inline
// SVG strings (react-native-android-widget's SvgWidget) mirroring the same
// path data as components/icons.tsx / design/mockups/deck.html — no emoji.
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetClickAction } from './widget-actions';

const BUTTON_BG = '#131820'; // theme.colors.ink850
const BORDER = 'rgba(255, 255, 255, 0.08)'; // theme.colors.line
const ICON = '#f3f5f1'; // theme.colors.off

const SVG_PREV = `<svg viewBox="0 0 24 24" fill="none"><path d="M18 4.5v15l-10-7.5z" fill="${ICON}"/><rect x="4.6" y="4.5" width="2.4" height="15" rx="1" fill="${ICON}"/></svg>`;
const SVG_NEXT = `<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5v15l10-7.5z" fill="${ICON}"/><rect x="17" y="4.5" width="2.4" height="15" rx="1" fill="${ICON}"/></svg>`;
const SVG_PLAY_PAUSE = `<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="4" width="4.4" height="16" rx="1.6" fill="${ICON}"/><rect x="13.6" y="4" width="4.4" height="16" rx="1.6" fill="${ICON}"/></svg>`;
const SVG_VOLUME = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 9.6v4.8h3.4L12.5 19V5l-5.1 4.6H4Z" stroke="${ICON}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.4 9.2a4.2 4.2 0 0 1 0 5.6" stroke="${ICON}" stroke-width="1.6" stroke-linecap="round"/></svg>`;

interface WidgetButtonProps {
  svg: string;
  badge?: string;
  clickAction: WidgetClickAction;
}

function WidgetButton({ svg, badge, clickAction }: WidgetButtonProps) {
  return (
    <FlexWidget
      clickAction={clickAction}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BUTTON_BG,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        marginHorizontal: 4,
      }}
    >
      <SvgWidget svg={svg} style={{ width: 20, height: 20 }} />
      {badge ? <TextWidget text={badge} style={{ fontSize: 11, color: ICON }} /> : null}
    </FlexWidget>
  );
}

export function RemoteWidget() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b0e12', // theme.colors.ink950
        borderRadius: 16,
        padding: 6,
      }}
    >
      <WidgetButton svg={SVG_PREV} clickAction="PREVIOUS" />
      <WidgetButton svg={SVG_PLAY_PAUSE} clickAction="PLAYPAUSE" />
      <WidgetButton svg={SVG_NEXT} clickAction="NEXT" />
      <WidgetButton svg={SVG_VOLUME} badge="-" clickAction="VOL_DOWN" />
      <WidgetButton svg={SVG_VOLUME} badge="+" clickAction="VOL_UP" />
    </FlexWidget>
  );
}
