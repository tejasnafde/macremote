package io.github.tejasnafde.macremote.state

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.github.tejasnafde.macremote.MacRemoteApplication
import io.github.tejasnafde.macremote.data.ApiException
import io.github.tejasnafde.macremote.data.AppEntry
import io.github.tejasnafde.macremote.data.AppListMerger
import io.github.tejasnafde.macremote.data.AudioApp
import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.BrightnessRecovery
import io.github.tejasnafde.macremote.data.BrightnessResult
import io.github.tejasnafde.macremote.data.BrightnessTargetResolver
import io.github.tejasnafde.macremote.data.DisplayRefresh
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
    val checkingForUpdate: Boolean = false,
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
    private var displayRefreshJob: Job? = null
    private var displaySyncJob: Job? = null
    private var volumeJob: Job? = null
    private var volumeQueue = FinalWinsQueue<VolumeWrite>()
    private var volumeSignal = Channel<Unit>(Channel.CONFLATED)
    private val volumeSync = VolumeSync()
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
                else graph.devices.updateAndActivate(editing.id, name, url, token)
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
        volumeSync.reset()
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
        scheduleDisplayRefresh(device)
        pollJob = viewModelScope.launch {
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
            if (responseGate.accepts(token)) {
                mutableState.update {
                    it.copy(
                        status = status.copy(volume = volumeSync.displayed(status.volume)),
                        online = true,
                        refreshing = false,
                    )
                }
            }
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
        displayRefreshJob?.cancel()
        displayRefreshJob = null
        displaySyncJob?.cancel()
        displaySyncJob = null
    }

    private fun startVolumeWriter(device: Device) {
        volumeQueue = FinalWinsQueue()
        volumeSignal = Channel(Channel.CONFLATED)
        volumeJob = viewModelScope.launch {
            for (ignored in volumeSignal) {
                var next = volumeQueue.takeNext()
                while (next != null) {
                    val result = runCatching { graph.api.setVolume(device, next.level) }
                    volumeQueue.completeInFlight()
                    if (next.committed) {
                        if (result.isSuccess) reconcileVolume(device, next)
                        else {
                            volumeSync.settle(next.generation)
                            postError(result.exceptionOrNull()!!)
                            refresh(device)
                        }
                    } else {
                        result.onFailure { postError(it) }
                    }
                    next = volumeQueue.takeNext()
                }
            }
        }
    }

    fun setVolume(level: Int, committed: Boolean) {
        val safe = level.coerceIn(0, 100)
        val generation = volumeSync.offer(safe)
        mutableState.update { current ->
            current.copy(status = current.status?.copy(volume = safe, muted = if (safe > 0) false else current.status.muted))
        }
        val write = VolumeWrite(safe, generation, committed)
        if (committed) volumeQueue.commit(write) else volumeQueue.offerPreview(write)
        volumeSignal.trySend(Unit)
    }

    private suspend fun reconcileVolume(device: Device, write: VolumeWrite) {
        volumeSync.complete(write.generation)
        val token = responseGate.nextRequest()
        try {
            val status = graph.api.status(device)
            if (!responseGate.accepts(token)) return
            mutableState.update {
                it.copy(
                    status = status.copy(volume = volumeSync.displayed(status.volume)),
                    online = true,
                    refreshing = false,
                )
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            if (responseGate.accepts(token)) {
                mutableState.update { it.copy(online = false, refreshing = false) }
            }
        }
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
        withDevice { device ->
            val result = graph.api.setBrightness(device, safe, target)
            applyBrightnessFollowUp(device, BrightnessRecovery.after(result, target))
            requireBrightnessSuccess(result)
        }
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
            RemoteAction.SeekBack -> seek(device, -10)
            RemoteAction.SeekForward -> seek(device, 10)
            RemoteAction.VolumeUp -> graph.api.volumeUp(device)
            RemoteAction.VolumeDown -> graph.api.volumeDown(device)
            RemoteAction.Mute -> graph.api.mute(device)
            RemoteAction.BrightnessUp -> changeBrightness(device, "up")
            RemoteAction.BrightnessDown -> changeBrightness(device, "down")
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

    fun tabFullscreen(tab: BrowserTab) = withDevice { device ->
        val result = graph.api.tabFullscreen(device, tab)
        if (!result.ok) {
            mutableState.update { it.copy(message = result.note ?: "Could not enter fullscreen") }
        }
    }

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
            val apps = runCatching { graph.api.apps(device) }.getOrDefault(emptyList())
            val fallback = AppListMerger.withoutListedWindows(
                windowsResult.getOrDefault(emptyList()),
                apps,
            )
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
        if (manual && state.value.checkingForUpdate) return
        if (manual) mutableState.update { it.copy(checkingForUpdate = true) }
        viewModelScope.launch {
            try {
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
            } finally {
                if (manual) {
                    mutableState.update { current -> current.copy(checkingForUpdate = false) }
                }
            }
        }
    }

    fun installUpdate() {
        val release = state.value.latestRelease ?: return
        if (state.value.updateProgress != null) return
        mutableState.update { it.copy(updateProgress = 0) }
        viewModelScope.launch {
            runCatching {
                graph.updates.downloadAndInstall(release) { progress ->
                    mutableState.update { it.copy(updateProgress = progress) }
                }
            }.onSuccess {
                mutableState.update { current -> current.copy(updateProgress = null) }
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

    private suspend fun changeBrightness(device: Device, direction: String) {
        val target = state.value.brightnessTarget
        val result = graph.api.brightnessStep(device, direction, target)
        applyBrightnessFollowUp(device, BrightnessRecovery.after(result, target))
        requireBrightnessSuccess(result)
    }

    private suspend fun applyBrightnessFollowUp(device: Device, refresh: DisplayRefresh) {
        when (refresh) {
            DisplayRefresh.None -> Unit
            DisplayRefresh.Immediate -> {
                displaySyncJob?.cancel()
                displaySyncJob = null
                refreshDisplaysBestEffort(device)
            }
            DisplayRefresh.Debounced -> scheduleDisplaySync(device)
        }
    }

    private suspend fun refreshDisplays(device: Device) {
        val displays = graph.api.displays(device)
        if (state.value.activeDevice?.id != device.id) return
        val savedTarget = graph.devices.brightnessTarget(device.id)
        val resolvedTarget = BrightnessTargetResolver.resolve(savedTarget, displays)
        mutableState.update { it.copy(displays = displays, brightnessTarget = resolvedTarget) }
    }

    private suspend fun refreshDisplaysBestEffort(device: Device) {
        runCatching { refreshDisplays(device) }
    }

    private fun scheduleDisplayRefresh(device: Device) {
        displayRefreshJob?.cancel()
        displayRefreshJob = viewModelScope.launch {
            while (isActive && state.value.activeDevice?.id == device.id) {
                refreshDisplaysBestEffort(device)
                delay(DISPLAY_REFRESH_MS)
            }
        }
    }

    private fun scheduleDisplaySync(device: Device) {
        displaySyncJob?.cancel()
        displaySyncJob = viewModelScope.launch {
            delay(DISPLAY_SYNC_DELAY_MS)
            refreshDisplaysBestEffort(device)
        }
    }

    private fun requireBrightnessSuccess(result: BrightnessResult) {
        result.failureMessage()?.let { throw ApiException(it) }
    }

    private fun rememberTab(tab: BrowserTab) {
        rememberedTabKey = tab.key
        rememberedTabAtMs = System.currentTimeMillis()
    }

    private suspend fun seek(device: Device, seconds: Int) {
        val tab = MediaTargetSelector.select(
            state.value.status,
            rememberedTabKey,
            rememberedTabAtMs,
            System.currentTimeMillis(),
        )
        if (tab == null) graph.api.seek(device, seconds)
        else {
            rememberTab(tab)
            graph.api.tabCommand(device, tab, "seek", seconds)
        }
    }

    override fun onCleared() {
        stopPolling()
        super.onCleared()
    }

    private companion object {
        const val POLL_MS = 3_000L
        const val DISPLAY_REFRESH_MS = 30_000L
        const val DISPLAY_SYNC_DELAY_MS = 800L
    }
}

enum class RemoteAction {
    PlayPause, Next, Previous, SeekBack, SeekForward, VolumeUp, VolumeDown, Mute,
    BrightnessUp, BrightnessDown, Lock, Sleep, Blackout, ScreensOn, BanishCursor,
}

private data class VolumeWrite(
    val level: Int,
    val generation: Long,
    val committed: Boolean,
)
