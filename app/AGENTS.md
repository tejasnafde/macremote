# Native Android client

- The Android project root is `app/android`; build with its checked-in Gradle wrapper.
- Preserve package id `io.github.tejasnafde.macremote`, signing-key continuity,
  and monotonically increasing `versionCode` values so existing installs
  upgrade in place.
- Keep the first-launch reader for the legacy AsyncStorage databases and do not
  delete those databases during migration.
- Write a failing JVM test before changing URL/version/migration, polling-order,
  command-order, widget-action, or release-decoding behavior.
- Run `./gradlew testDebugUnitTest lintDebug assembleRelease` before release.
