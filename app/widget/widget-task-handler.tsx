// Headless task handler for react-native-android-widget: runs in a JS engine
// instance the OS spins up on widget add/update/click, with no UI and no
// access to component state from the foreground app. It reads the same
// AsyncStorage-backed server config the main app uses (lib/storage.ts) and
// fires a direct API call per tap. If nothing is configured yet, a tap opens
// the app instead so the user can set it up.
import { Linking } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { api } from '../lib/api';
import { hasAnyDevice } from '../lib/devices';
import { RemoteWidget } from './RemoteWidget';
import { isWidgetClickAction, type WidgetClickAction } from './widget-actions';

async function runAction(action: WidgetClickAction): Promise<void> {
  switch (action) {
    case 'PREVIOUS':
      return api.previous();
    case 'PLAYPAUSE':
      return api.playPause();
    case 'NEXT':
      return api.next();
    case 'VOL_DOWN':
      return api.volumeDown();
    case 'VOL_UP':
      return api.volumeUp();
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, clickAction } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<RemoteWidget />);
      return;

    case 'WIDGET_CLICK': {
      if (!(await hasAnyDevice())) {
        // Nothing configured yet — open the app so the user can set it up.
        await Linking.openURL('macremote://').catch(() => undefined);
      } else if (clickAction && isWidgetClickAction(clickAction)) {
        // Best-effort: a headless task has no way to surface an error toast,
        // so a failed tap is silently a no-op rather than crashing the task.
        await runAction(clickAction).catch(() => undefined);
      }
      props.renderWidget(<RemoteWidget />);
      return;
    }

    case 'WIDGET_DELETED':
    default:
      return;
  }
}
