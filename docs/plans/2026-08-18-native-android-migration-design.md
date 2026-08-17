# Native Android migration design

## Goal

Replace the Expo/React Native client with a native Kotlin and Jetpack Compose
application without reducing the capabilities of the currently installed app.
The replacement must install as an update, retain the user's saved Macs, and
continue receiving signed APK releases through the existing GitHub release
flow.

The migration is parity-first. Visual refinements are welcome when they are
low-risk, but do not justify dropping behavior or delaying the release.

## Release invariants

- Keep the package name `io.github.tejasnafde.macremote`.
- Keep the existing Android signing identity in the release workflow.
- Increase `versionCode` and use the repository release version.
- Read the existing React Native AsyncStorage database on first native launch,
  migrate device records and preferences, and leave the old data intact for a
  safe upgrade.
- Continue checking GitHub Releases, downloading the signed APK, and handing it
  to Android's package installer.
- Preserve the FastAPI protocol. The server and browser extension do not gain a
  native-client-specific API.
- Expo OTA updates end at the native release. All later client updates are
  signed APK releases.

## Architecture

The Android project lives under `app/` and builds directly with Gradle. It uses
Jetpack Compose with a single activity and explicit screen state rather than a
navigation dependency. A small repository layer owns device configuration,
encrypted credentials, HTTP requests, polling, and update metadata. UI code
consumes immutable state exposed by lifecycle-aware view models.

The API client uses bounded timeouts and typed results. Status polling is a
single coroutine per active device: changing devices cancels the old job, and
only responses bearing the current generation may update state. Slider writes
are serialized and conflated so a final committed value cannot be overwritten
by an older drag update.

The media notification is an Android `MediaSessionService`. Play and pause are
absolute actions when the server/browser protocol supports them; toggle is
used only for the existing global media-key endpoint. Service teardown releases
the session and clears process state. The home-screen widget uses Glance and
the same device repository/API client as the foreground app.

## Feature parity

The first native release retains:

- first-run device setup and multiple saved Macs;
- switching, editing, and deleting devices;
- online status, now playing, volume, mute, and brightness controls;
- sleep and blackout timers, lock, sleep, screen restore, and cursor banish;
- browser-tab playback, seek, volume, mute, focus, and fullscreen controls;
- running app/window selection and per-app audio controls;
- reading/scroll controls;
- media notification controls and the home-screen widget;
- automatic and manual GitHub APK update checks.

The existing dark visual language, typography hierarchy, green accent, large
touch targets, and compact remote-control layout remain recognizable. Compose
adds native back behavior, system insets, ripples, haptics, and accessibility
semantics without redesigning the information architecture.

## Reliability pass

Independent server and release defects remain in scope: reject invalid API
tokens at startup/install time, make sleep-timer cleanup ownership-safe, restore
volume after interrupted fades, serialize fullscreen requests, make blackout
idempotent and preserve zero-valued state, deploy the selected release tag,
recover stale updater locks, remove the unused public feedback endpoint, and
run the extension regression test in CI and release gates.

App concurrency and Android lifecycle findings are fixed in the native design
instead of patching code that will be removed.

## Error handling

Offline and timeout states keep the last trustworthy status visible while
clearly marking it stale. Destructive actions require deliberate confirmation.
Update failures never block launch and surface a retryable message. Migration
is idempotent: partially migrated data can be retried, and credentials move to
encrypted storage only after the new record is durable.

## Verification and rollout

Pure Kotlin tests cover URL normalization, version comparison, AsyncStorage
migration, response ordering, write conflation, and API serialization. Compose
tests cover navigation and critical control behavior. Server and extension
regression suites remain release gates.

The release APK is built in CI with the existing keystore. Before tagging, a
release build must assemble locally, lint and tests must pass, and the APK's
package/version metadata must be inspected. The release workflow then builds
and signs from the tag. Delivery is complete only after the GitHub release
contains the APK and its package name, version code, and signature continuity
are verified against the prior release where the artifacts permit it.

## Rollback

The previous Expo source remains available in Git history. If release
verification fails, no tag is published. If the signed native APK cannot update
the prior package or loses critical parity, the native release is withheld and
the existing Expo release remains the latest self-update target.
