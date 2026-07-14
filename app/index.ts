import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './widget/widget-task-handler';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);

// Handles widget add/update/click while the app itself may not be running
// (headless JS engine instance spun up by the OS). See widget/widget-task-handler.tsx.
registerWidgetTaskHandler(widgetTaskHandler);
