// Home-screen widget UI: five buttons, no state beyond static labels — the
// server is the source of truth and the widget never blocks on a fetch to
// render. Kept intentionally dead simple (react-native-android-widget renders
// this to Android RemoteViews, not a real view hierarchy).
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetClickAction } from './widget-actions';

const BUTTON_BG = '#1e2630';
const BORDER = '#2a3441';
const TEXT = '#e8edf2';

interface WidgetButtonProps {
  label: string;
  clickAction: WidgetClickAction;
}

function WidgetButton({ label, clickAction }: WidgetButtonProps) {
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
      <TextWidget text={label} style={{ fontSize: 20, color: TEXT }} />
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
        backgroundColor: '#0b0f14',
        borderRadius: 16,
        padding: 6,
      }}
    >
      <WidgetButton label="⏮" clickAction="PREVIOUS" />
      <WidgetButton label="▶️" clickAction="PLAYPAUSE" />
      <WidgetButton label="⏭" clickAction="NEXT" />
      <WidgetButton label="🔉" clickAction="VOL_DOWN" />
      <WidgetButton label="🔊" clickAction="VOL_UP" />
    </FlexWidget>
  );
}
