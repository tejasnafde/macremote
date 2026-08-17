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
