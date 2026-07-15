// Bridges RemoteScreen's /status polling to the native media notification.
// While the toggle is ON and a device is active, every status update is
// mirrored into the notification (title / artist / app / play-state). When a
// notification, Quick Settings, or lockscreen button is pressed, the native
// module emits "onMediaAction"; we run the matching server call and refresh so
// the notification reflects the new state on the next mirror.
import { useEffect, useRef } from 'react';
import { api, NowPlaying } from './api';
import { addActionListener, MediaAction, startOrUpdate, stop } from './mediaNotification';

interface Params {
  enabled: boolean;
  hasDevice: boolean;
  online: boolean;
  deviceName: string;
  nowPlaying: NowPlaying | null | undefined;
  isPlaying: boolean;
  /** Re-fetch /status after an action so the notification re-mirrors. */
  refresh: () => Promise<void> | void;
}

export function useMediaNotification({
  enabled,
  hasDevice,
  online,
  deviceName,
  nowPlaying,
  isPlaying,
  refresh,
}: Params): void {
  // Keep refresh current without re-subscribing the action listener on every
  // render (refresh is a fresh closure each poll).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Action listener: one subscription while enabled.
  useEffect(() => {
    if (!enabled) return;
    const runAction = async (action: MediaAction) => {
      try {
        if (action === 'playpause') await api.playPause();
        else if (action === 'next') await api.next();
        else if (action === 'previous') await api.previous();
        await refreshRef.current();
      } catch {
        // A missed remote press is a no-op; the next poll re-mirrors truth.
      }
    };
    return addActionListener(runAction);
  }, [enabled]);

  // Mirror status into the notification (or tear it down).
  useEffect(() => {
    if (!enabled || !hasDevice) {
      stop();
      return;
    }
    const hasTrack = online && Boolean(nowPlaying?.title);
    startOrUpdate(
      hasTrack
        ? {
            title: nowPlaying!.title!,
            artist: nowPlaying!.artist ?? '',
            app: nowPlaying!.app ?? '',
            isPlaying,
          }
        : { title: 'macremote', artist: deviceName, app: '', isPlaying: false }
    );
  }, [
    enabled,
    hasDevice,
    online,
    deviceName,
    nowPlaying?.title,
    nowPlaying?.artist,
    nowPlaying?.app,
    isPlaying,
  ]);
}
