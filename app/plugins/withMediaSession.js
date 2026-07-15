// Expo config plugin for the native MediaSession media-control notification
// (see app/modules/media-session). Adds the Android runtime/foreground-service
// permissions, registers the foreground Service that holds the
// MediaSessionCompat + MediaStyle notification, and registers androidx.media's
// MediaButtonReceiver so notification buttons, hardware media keys, and the
// Quick Settings / lockscreen transport controls all route through the same
// MediaSession callback. Wired into app.json's plugins array; applied by
// `npx expo prebuild`.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// Must match the Kotlin service class in app/modules/media-session.
const SERVICE_NAME = 'expo.modules.mediasession.MediaNotificationService';
// androidx.media ships this receiver; it forwards media-button broadcasts to
// the one service that declares an ACTION_MEDIA_BUTTON intent filter.
const RECEIVER_NAME = 'androidx.media.session.MediaButtonReceiver';
const MEDIA_BUTTON_ACTION = 'android.intent.action.MEDIA_BUTTON';

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
];

function mediaButtonIntentFilter() {
  return [{ action: [{ $: { 'android:name': MEDIA_BUTTON_ACTION } }] }];
}

function addService(application) {
  const services = application.service || (application.service = []);
  if (services.some((s) => s.$ && s.$['android:name'] === SERVICE_NAME)) return;
  services.push({
    $: {
      'android:name': SERVICE_NAME,
      'android:exported': 'false',
      'android:foregroundServiceType': 'mediaPlayback',
    },
    'intent-filter': mediaButtonIntentFilter(),
  });
}

function addReceiver(application) {
  const receivers = application.receiver || (application.receiver = []);
  if (receivers.some((r) => r.$ && r.$['android:name'] === RECEIVER_NAME)) return;
  receivers.push({
    $: {
      'android:name': RECEIVER_NAME,
      // Must be receivable from the system media-button broadcast.
      'android:exported': 'true',
    },
    'intent-filter': mediaButtonIntentFilter(),
  });
}

const withMediaSession = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);

  config = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    addService(application);
    addReceiver(application);
    return cfg;
  });

  return config;
};

module.exports = withMediaSession;
