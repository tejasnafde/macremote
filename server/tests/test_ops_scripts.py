import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_ops_shell_scripts_parse():
    for relative in ("ops/install.sh", "ops/update.sh", "scripts/ship.sh"):
        subprocess.run(["bash", "-n", str(ROOT / relative)], check=True)


def test_installer_rejects_invalid_api_token_before_launchd_changes():
    script = (ROOT / "ops/install.sh").read_text()
    token_check = script.index("API_TOKEN")
    launchd_changes = script.index("launchctl bootout")
    assert token_check < launchd_changes
    assert "change-me-to-a-long-random-token" in script


def test_updater_checks_out_selected_tag_and_verifies_exact_version():
    script = (ROOT / "ops/update.sh").read_text()
    assert 'git checkout --detach --quiet "$LATEST_TAG"' in script
    assert '"$GOT" = "$EXPECTED"' in script
    assert 'restart_and_check "$LATEST"' in script
    assert "json.load(sys.stdin).get('version', '')" in script
    assert "tr -d" not in script


def test_updater_recovers_a_dead_process_lock():
    script = (ROOT / "ops/update.sh").read_text()
    assert "kill -0" in script
    assert "owner.pid" in script


def test_ci_and_release_gate_native_app_and_extension_tests():
    ci = (ROOT / ".github/workflows/ci.yml").read_text()
    release = (ROOT / ".github/workflows/release.yml").read_text()
    for workflow in (ci, release):
        assert "./gradlew testDebugUnitTest" in workflow
        assert "node --test extension/mediaOp.test.mjs" in workflow
        assert "expo prebuild" not in workflow


def test_ship_bumps_native_android_version_without_ota_path():
    script = (ROOT / "scripts/ship.sh").read_text()
    assert "app/android/app/build.gradle.kts" in script
    assert "--ota" not in script
    assert "app/app.json" not in script


def test_native_client_preserves_browser_seek_routing_and_timer_parity():
    view_model = (ROOT / "app/android/app/src/main/java/io/github/tejasnafde/macremote/state/MacRemoteViewModel.kt").read_text()
    screens = (ROOT / "app/android/app/src/main/java/io/github/tejasnafde/macremote/ui/Screens.kt").read_text()
    assert "RemoteAction.SeekBack -> seek(device, -10)" in view_model
    assert "RemoteAction.SeekForward -> seek(device, 10)" in view_model
    assert 'Text("Custom")' in screens
    assert 'Text("Change timer")' in screens
    assert "var editing by remember { mutableStateOf(false) }" in screens
    assert "delay(1_000)" in screens


def test_native_widget_keeps_the_v044_and_v050_component_names():
    manifest = (ROOT / "app/android/app/src/main/AndroidManifest.xml").read_text()
    widget = (ROOT / "app/android/app/src/main/java/io/github/tejasnafde/macremote/widget/MacRemoteWidget.kt").read_text()
    assert 'android:name=".widget.RemoteWidget"' in manifest
    assert 'android:name=".widget.MacRemoteWidget"' in manifest
    assert "class RemoteWidget" in widget
    assert "class MacRemoteWidget" in widget
    assert "reconcileLegacyWidgetProvider(this)" in (
        ROOT / "app/android/app/src/main/java/io/github/tejasnafde/macremote/MacRemoteApplication.kt"
    ).read_text()
    assert "catch (_: Exception)" in widget


def test_media_service_records_success_before_a_later_transition_can_rollback():
    service = (
        ROOT
        / "app/android/app/src/main/java/io/github/tejasnafde/macremote/media/MediaControlService.kt"
    ).read_text()
    assert ".onSuccess { playbackGate.succeeded(transition) }" in service


def test_native_timer_editor_visually_marks_the_current_mode():
    screens = (ROOT / "app/android/app/src/main/java/io/github/tejasnafde/macremote/ui/Screens.kt").read_text()
    assert "if (mode == SleepMode.Sleep) MacColors.Green.copy(alpha = .25f)" in screens
    assert "if (mode == SleepMode.Blackout) MacColors.Green.copy(alpha = .25f)" in screens


def test_canonical_launcher_sources_are_restored_exactly():
    expected = {
        "icon.png": "182e15ef7ba3b15a6b6c8e97377a11c04b665b787c53569e197523a752f0a2a9",
        "android-icon-foreground.png": "2ef8140a49d20f4f6d46a3b9b9784cb2ce3b141014ba5f35f0a39559ef3f384e",
        "android-icon-background.png": "586e165023f16ee7d92ce3b99ee6a695936e8bfd0c65375262c2988bc7d1fd3a",
        "android-icon-monochrome.png": "64183ad8373473f158a061f0a7b569423d9848fdcd00b8bf26c9769f22ebc765",
    }
    for name, digest in expected.items():
        data = (ROOT / "app/assets" / name).read_bytes()
        assert hashlib.sha256(data).hexdigest() == digest
