export type WidgetClickAction = 'PREVIOUS' | 'PLAYPAUSE' | 'NEXT' | 'VOL_DOWN' | 'VOL_UP';

export const WIDGET_CLICK_ACTIONS: readonly WidgetClickAction[] = [
  'PREVIOUS',
  'PLAYPAUSE',
  'NEXT',
  'VOL_DOWN',
  'VOL_UP',
];

export function isWidgetClickAction(value: string): value is WidgetClickAction {
  return (WIDGET_CLICK_ACTIONS as readonly string[]).includes(value);
}
