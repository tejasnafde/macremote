package io.github.tejasnafde.macremote.state

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.github.tejasnafde.macremote.MacRemoteApplication
import io.github.tejasnafde.macremote.data.ApiException
import io.github.tejasnafde.macremote.data.AppEntry
import io.github.tejasnafde.macremote.data.AudioApp
import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.Device
import io.github.tejasnafde.macremote.data.DisplayInfo
import io.github.tejasnafde.macremote.data.DisplayWindows
import io.github.tejasnafde.macremote.data.MacStatus
import io.github.tejasnafde.macremote.data.SleepMode
import io.github.tejasnafde.macremote.update.LatestRelease
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class AppScreen { Loading, Setup, Remote, Devices, Reading, Apps }

data class MacRemoteUiState(
    val screen: AppScreen = AppScreen.Loading,
    val devices: List<Device> = emptyList(),
    val deviceProbes: Map<String, DeviceProbe> = emptyMap(),
    val activeDevice: Device? = null,
    val editingDevice: Device? = null,
    val status: MacStatus? = null,
    val online: Boolean = false,
    val refreshing: Boolean = false,
    val displays: List<DisplayInfo> = emptyList(),
    val brightnessTarget: String? = null,
    val windows: List<DisplayWindows> = emptyList(),
    val fallbackApps: List<AppEntry> = emptyList(),
    val audioAvailable: Boolean? = null,
    val audioApps: List<AudioApp> = emptyList(),
    val loadingApps: Boolean = false,
    val mediaNotificationEnabled: Boolean = false,
    val readingMode: String = "arrows",
    val latestRelease: LatestRelease? = null,
    val updateProgress: Int? = null,
    val message: String? = null,
)

data class DeviceProbe(
    val probing: Boolean = true,
    val online: Boolean = false,
    val version: String? = null,
)

class MacRemoteViewModel(application: Application) : AndroidViewModel(application) {
    private val graph = (application as MacRemoteApplication).graph
    private val mutableState = MutableStateFlow(MacRemoteUiState())
    val state: StateFlow<MacRemoteUiState> = mutableState.asStateFlow()
    private val responseGate = ResponseGate()
    private var pollJob: Job? = null
    private var volumeJob: Job? = null
    private var volumeQueue = FinalWinsQueue<Int>()
    private var volumeSignal = Channel<Unit>(Channel.CONFLATED)
    private var rememberedTabKey: String? = null
    private var rememberedTabAtMs = 0L
    private var probeGeneration = 0
    private var appForeground = false

    init { viewModelScope.launch { bootstrap() } }

    private suspend fun bootstrap() {
        val devices = graph.devices.load()
        mutableState.update {
            it.copy(
                devices = devices.devices,
                activeDevice = devices.activeDevice,
                mediaNotificationEnabled = graph.devices.mediaNotificationEnabled(),
                readingMode = graph.devices.readingMode(),
                screen = if (devices.devices.isEmpty()) AppScreen.Setup else AppScreen.Remote,
            )
        }
        devices.activeDevice?.takeIf { appForeground }?.let(::activatePolling)
        if (graph.devices.mediaNotificationEnabled()) {
            io.github.tejasnafde.macremote.media.MediaControlService.setEnabled(
                getApplication(),
                true,
            )
        }
        checkForUpdate(manual = false)
    }

    fun navigate(screen: AppScreen) {
        mutableState.update { it.copy(screen = screen, message = null) }
        if (screen == AppScreen.Apps) loadApps()
        if (screen == AppScreen.Devices) probeDevices()
    }

    fun setForeground(foreground: Boolean) {
        if (appForeground == foreground) return
        appForeground = foreground
        if (foreground) {
            state.value.activeDevice?.let(::activatePolling)
        } else {
            pausePolling()
        }
    }

    fun back() {
        when (state.value.screen) {
            AppScreen.Setup -> if (state.value.devices.isNotEmpty()) navigate(AppScreen.Devices)
            AppScreen.Remote, AppScreen.Loading -> Unit
            else -> navigate(AppScreen.Remote)
        }
    }

    fun beginAddDevice() {
        mutableState.update { it.copy(editingDevice = null, screen = AppScreen.Setup) }
    }

    fun beginEditDevice(device: Device) {
        mutableState.update { it.copy(editingDevice = device, screen = AppScreen.Setup) }
    }

    fun testConnection(url: String, token: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val temporary = Device("test", "Mac", io.github.tejasnafde.macremote.core.UrlNormalizer.normalize(url), token.trim())
            val result = runCatching {
                graph.api.health(temporary)
                graph.api.status(temporary)
            }.map { Unit }
            onResult(result)
        }
    }

    fun saveDevice(name: String, url: String, token: String, onResult: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            val result = runCatching {
                val editing = state.value.editingDevice
                val saved = if (editing == null) graph.devices.add(name, url, token)
                else graph.devices.update(editing.id, name, url, token)
                val devices = graph.devices.state.value
                mutableState.update {
                    it.copy(
                        devices = devices.devices,
                        activeDevice = devices.activeDevice,
                        editingDevice = null,
                        screen = AppScreen.Remote,
                    )
                }
                activatePolling(saved)
            }
            onResult(result)
        }
    }

    fun activateDevice(device: Device) {
        viewModelScope.launch {
            graph.devices.activate(device.id)
            val devices = graph.devices.state.value
            mutableState.update { it.copy(devices = devices.devices, activeDevice = device, screen = AppScreen.Remote) }
            activatePolling(device)
        }
    }

    private fun probeDevices() {
        val devices = state.value.devices
        val generation = ++probeGeneration
        mutableState.update { current ->
            current.copy(deviceProbes = devices.associate { it.id to DeviceProbe() })
        }
        devices.forEach { device ->
            viewModelScope.launch {
                val result = runCatching {
                    graph.api.health(device)
                    graph.api.version(device)
                }
                if (generation != probeGeneration || state.value.devices.none { it.id == device.id }) return@launch
                mutableState.update { current ->
                    current.copy(
                        deviceProbes = current.deviceProbes + (
                            device.id to DeviceProbe(
                                probing = false,
                                online = result.isSuccess,
                                version = result.getOrNull(),
                            )
                        ),
                    )
                }
            }
        }
    }

    fun removeDevice(device: Device) {
        viewModelScope.launch {
            graph.devices.remove(device.id)
            val devices = graph.devices.state.value
            mutableState.update {
                it.copy(
                    devices = devices.devices,
                    activeDevice = devices.activeDevice,
                    screen = if (devices.devices.isEmpty()) AppScreen.Setup else AppScreen.Devices,
                )
            }
            devices.activeDevice?.let(::activatePolling) ?: stopPolling()
        }
    }

    private fun activatePolling(device: Device) {
        stopPolling()
        responseGate.activate(device.id)
        mutableState.update {
            it.copy(
                activeDevice = device,
                status = null,
                online = false,
                displays = emptyList(),
                brightnessTarget = graph.devices.brightnessTarget(device.id),
            )
        }
        startVolumeWriter(device)
        pollJob = viewModelScope.launch {
            launch {
                runCatching { graph.api.displays(device) }.onSuccess { displays ->
                    if (state.value.activeDevice?.id == device.id) mutableState.update { it.copy(displays = displays) }
                }
            }
            while (isActive) {
                refresh(device)
                delay(POLL_MS)
            }
        }
    }

    fun refreshNow() {
        state.value.activeDevice?.let { device -> viewModelScope.launch { refresh(device, showSpinner = true) } }
    }

    private suspend fun refresh(device: Device, showSpinner: Boolean = false) {
        val token = responseGate.nextRequest()
        if (showSpinner) mutableState.update { it.copy(refreshing = true) }
        try {
            val status = graph.api.status(device)
            if (responseGate.accepts(token)) mutableState.update { it.copy(status = status, online = true, refreshing = false) }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            if (responseGate.accepts(token)) mutableState.update { it.copy(online = false, refreshing = false) }
        }
    }

    private fun stopPolling() {
        pausePolling()
        volumeJob?.cancel()
        volumeJob = null
        volumeSignal.close()
    }

    private fun pausePolling() {
        pollJob?.cancel()
        pollJob = null
    }

    private fun startVolumeWriter(device: Device) {
        volumeQueue = FinalWinsQueue()
        volumeSignal = Channel(Channel.CONFLATED)
        volumeJob = viewModelScope.launch {
            for (ignored in volumeSignal) {
                var next = volumeQueue.takeNext()
                while (next != null) {
                    runCatching { graph.api.setVolume(device, next) }
                        .onFailure { postError(it) }
                    volumeQueue.completeInFlight()
                    next = volumeQueue.takeNext()
                }
            }
        }
    }

    fun setVolume(level: Int, committed: Boolean) {
        val safe = level.coerceIn(0, 100)
        mutableState.update { current ->
            current.copy(status = current.status?.copy(volume = safe, muted = if (safe > 0) false else current.status.muted))
        }
        if (committed) volumeQueue.commit(safe) else volumeQueue.offerPreview(safe)
        volumeSignal.trySend(Unit)
    }

    fun selectBrightnessTarget(displayId: String) {
        val device = state.value.activeDevice ?: return
        graph.devices.setBrightnessTarget(device.id, displayId)
        mutableState.update { it.copy(brightnessTarget = displayId) }
    }

    fun setBrightness(level: Int) {
        val safe = level.coerceIn(0, 100)
        val target = state.value.brightnessTarget ?: "builtin"
        mutableState.update { current ->
            if (target == "builtin") {
                current.copy(status = current.status?.copy(brightness = safe))
            } else {
                current.copy(displays = current.displays.map { display ->
                    if (display.id != target) display
                    else if (display.method == "gamma") display.copy(gammaLevel = safe)
                    else display.copy(brightness = safe)
                })
            }
        }
        withDevice { graph.api.setBrightness(it, safe, target) }
    }

    fun command(action: RemoteAction) = withDevice { device ->
        when (action) {
            RemoteAction.PlayPause -> {
                val tab = MediaTargetSelector.select(
                    state.value.status,
                    rememberedTabKey,
                    rememberedTabAtMs,
                    System.currentTimeMillis(),
                )
                if (tab == null) graph.api.playPause(device)
                else {
                    rememberTab(tab)
                    graph.api.tabCommand(device, tab, if (tab.playing) "pause" else "play")
                }
            }
            RemoteAction.Next -> graph.api.next(device)
            RemoteAction.Previous -> graph.api.previous(device)
            RemoteAction.SeekBack -> graph.api.seek(device, -10)
            RemoteAction.SeekForward -> graph.api.seek(device, 10)
            RemoteAction.VolumeUp -> graph.api.volumeUp(device)
            RemoteAction.VolumeDown -> graph.api.volumeDown(device)
            RemoteAction.Mute -> graph.api.mute(device)
            RemoteAction.BrightnessUp -> graph.api.brightnessStep(device, "up", state.value.brightnessTarget)
            RemoteAction.BrightnessDown -> graph.api.brightnessStep(device, "down", state.value.brightnessTarget)
            RemoteAction.Lock -> graph.api.lock(device)
            RemoteAction.Sleep -> graph.api.sleep(device)
            RemoteAction.Blackout -> graph.api.blackout(device)
            RemoteAction.ScreensOn -> graph.api.screensOn(device)
            RemoteAction.BanishCursor -> graph.api.banishCursor(device)
        }
    }

    fun setSleepTimer(minutes: Int, mode: SleepMode) = withDevice { graph.api.setSleepTimer(it, minutes, mode) }
    fun cancelSleepTimer() = withDevice { graph.api.cancelSleepTimer(it) }

    fun tabCommand(tab: BrowserTab, action: String, value: Int? = null) = withDevice {
        if (action == "play" || action == "pause") rememberTab(tab)
        graph.api.tabCommand(it, tab, action, value)
    }

    fun tabFullscreen(tab: BrowserTab) = withDevice { graph.api.tabFullscreen(it, tab) }

    fun setReadingMode(mode: String) {
        graph.devices.setReadingMode(mode)
        mutableState.update { it.copy(readingMode = mode) }
    }

    fun scroll(dy: Int) = withDevice(silent = true) { graph.api.inputScroll(it, 0, dy) }
    fun inputKey(key: String) = withDevice(silent = true) { graph.api.inputKey(it, key) }

    fun loadApps() {
        val device = state.value.activeDevice ?: return
        viewModelScope.launch {
            mutableState.update { it.copy(loadingApps = true) }
            val windowsResult = runCatching { graph.api.windows(device) }
            val fallback = if (windowsResult.exceptionOrNull() is ApiException &&
                (windowsResult.exceptionOrNull() as ApiException).status == 404
            ) runCatching { graph.api.apps(device) }.getOrDefault(emptyList()) else emptyList()
            val audio = runCatching { graph.api.audioApps(device) }.getOrNull()
            if (state.value.activeDevice?.id == device.id) {
                mutableState.update {
                    it.copy(
                        windows = windowsResult.getOrDefault(emptyList()),
                        fallbackApps = fallback,
                        audioAvailable = audio?.first,
                        audioApps = audio?.second.orEmpty(),
                        loadingApps = false,
                        message = windowsResult.exceptionOrNull()?.takeUnless { error -> error is ApiException && error.status == 404 }?.message,
                    )
                }
            }
        }
    }

    fun focusWindow(id: Int) = withDevice { graph.api.focusWindow(it, id); loadApps() }
    fun focusApp(bundleId: String) = withDevice { graph.api.focusApp(it, bundleId); loadApps() }
    fun setAppVolume(name: String, volume: Int) = withDevice(silent = true) { graph.api.setAppVolume(it, name, volume) }

    fun setMediaNotificationEnabled(enabled: Boolean) {
        graph.devices.setMediaNotificationEnabled(enabled)
        mutableState.update { it.copy(mediaNotificationEnabled = enabled) }
        io.github.tejasnafde.macremote.media.MediaControlService.setEnabled(getApplication(), enabled)
    }

    fun checkForUpdate(manual: Boolean = true) {
        viewModelScope.launch {
            runCatching { graph.updates.check() }
                .onSuccess { release ->
                    mutableState.update {
                        it.copy(
                            latestRelease = release,
                            message = if (manual && release == null) "macremote is up to date" else it.message,
                        )
                    }
                }
                .onFailure { if (manual) postError(it) }
        }
    }

    fun installUpdate() {
        val release = state.value.latestRelease ?: return
        viewModelScope.launch {
            mutableState.update { it.copy(updateProgress = 0) }
            runCatching {
                graph.updates.downloadAndInstall(release) { progress ->
                    mutableState.update { it.copy(updateProgress = progress) }
                }
            }.onFailure {
                mutableState.update { current -> current.copy(updateProgress = null) }
                postError(it)
            }
        }
    }

    fun consumeMessage() { mutableState.update { it.copy(message = null) } }

    private fun withDevice(silent: Boolean = false, block: suspend (Device) -> Unit) {
        val device = state.value.activeDevice ?: return
        viewModelScope.launch {
            runCatching { block(device) }
                .onSuccess { if (!silent) refresh(device) }
                .onFailure { if (!silent) postError(it) }
        }
    }

    private fun postError(error: Throwable) {
        if (error is CancellationException) return
        mutableState.update { it.copy(message = error.message ?: "Something went wrong") }
    }

    private fun rememberTab(tab: BrowserTab) {
        rememberedTabKey = tab.key
        rememberedTabAtMs = System.currentTimeMillis()
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }

    private companion object { const val POLL_MS = 3_000L }
}

enum class RemoteAction {
    PlayPause, Next, Previous, SeekBack, SeekForward, VolumeUp, VolumeDown, Mute,
    BrightnessUp, BrightnessDown, Lock, Sleep, Blackout, ScreensOn, BanishCursor,
}
