package io.github.tejasnafde.macremote.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Apps
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.BatteryFull
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.BrightnessHigh
import androidx.compose.material.icons.rounded.BrightnessLow
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Computer
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material.icons.rounded.Mouse
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.VolumeDown
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.tejasnafde.macremote.data.AudioApp
import io.github.tejasnafde.macremote.data.BrowserTab
import io.github.tejasnafde.macremote.data.Device
import io.github.tejasnafde.macremote.data.DisplayInfo
import io.github.tejasnafde.macremote.data.SleepMode
import io.github.tejasnafde.macremote.state.AppScreen
import io.github.tejasnafde.macremote.state.MacRemoteUiState
import io.github.tejasnafde.macremote.state.MacRemoteViewModel
import io.github.tejasnafde.macremote.state.RemoteAction
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

@Composable
fun LoadingScreen(padding: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MacColors.Green, strokeWidth = 3.dp)
    }
}

@Composable
fun SetupScreen(state: MacRemoteUiState, viewModel: MacRemoteViewModel, padding: PaddingValues) {
    val editing = state.editingDevice
    var name by remember(editing?.id) { mutableStateOf(editing?.name.orEmpty()) }
    var url by remember(editing?.id) { mutableStateOf(editing?.url.orEmpty()) }
    var token by remember(editing?.id) { mutableStateOf(editing?.token.orEmpty()) }
    var testing by remember { mutableStateOf(false) }
    var testPassed by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 26.dp,
            end = 26.dp,
            top = padding.calculateTopPadding() + 30.dp,
            bottom = padding.calculateBottomPadding() + 36.dp,
        ),
    ) {
        item {
            if (state.devices.isNotEmpty()) {
                IconButton(onClick = viewModel::back) { Icon(Icons.Rounded.ArrowBack, "Back") }
                Spacer(Modifier.height(14.dp))
            }
            Text(if (editing == null) "Connect your Mac" else "Edit your Mac", style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(10.dp))
            Text(
                "Your remote talks directly to macremote over Tailscale or your local network.",
                style = MaterialTheme.typography.bodyLarge,
                color = MacColors.Off55,
            )
            Spacer(Modifier.height(30.dp))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it; testPassed = false },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Name (optional)") },
                placeholder = { Text("Desk Mac") },
                singleLine = true,
            )
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = url,
                onValueChange = { url = it; testPassed = false },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Server address") },
                placeholder = { Text("macbook:8484") },
                singleLine = true,
            )
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = token,
                onValueChange = { token = it; testPassed = false },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("API token") },
                visualTransformation = PasswordVisualTransformation(),
                singleLine = true,
            )
            error?.let {
                Spacer(Modifier.height(10.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(22.dp))
            OutlinedButton(
                onClick = {
                    testing = true
                    error = null
                    viewModel.testConnection(url, token) { result ->
                        testing = false
                        testPassed = result.isSuccess
                        error = result.exceptionOrNull()?.message
                    }
                },
                enabled = !testing && url.isNotBlank() && token.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (testing) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Icon(if (testPassed) Icons.Rounded.Check else Icons.Rounded.Refresh, null)
                Spacer(Modifier.width(9.dp))
                Text(if (testPassed) "Connection ready" else "Test connection")
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    error = null
                    viewModel.saveDevice(name, url, token) { result -> error = result.exceptionOrNull()?.message }
                },
                enabled = url.isNotBlank() && token.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) { Text(if (editing == null) "Save and open remote" else "Save changes") }
            Spacer(Modifier.height(18.dp))
            Text(
                "The token is moved into Android Keystore-backed encrypted storage on this device.",
                style = MaterialTheme.typography.bodyMedium,
                color = MacColors.Off38,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun DevicesScreen(state: MacRemoteUiState, viewModel: MacRemoteViewModel, padding: PaddingValues) {
    var deleteTarget by remember { mutableStateOf<Device?>(null) }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, padding.calculateTopPadding() + 12.dp, 18.dp, padding.calculateBottomPadding() + 40.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            ScreenHeader("Devices", "Choose which Mac this remote controls.", viewModel::back)
            Spacer(Modifier.height(12.dp))
        }
        items(state.devices, key = { it.id }) { device ->
            val active = device.id == state.activeDevice?.id
            val probe = state.deviceProbes[device.id]
            val glance = when {
                probe == null || probe.probing -> "checking"
                !probe.online -> "offline"
                active && state.status != null -> listOfNotNull(
                    state.status.battery?.let { "battery $it%" },
                    state.status.volume?.let { "vol $it" },
                    probe.version?.let { "v$it" },
                ).joinToString(" · ")
                probe.version != null -> "online · v${probe.version}"
                else -> "online"
            }
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = if (active) MacColors.Ink800 else MacColors.Ink850,
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(1.dp, if (active) MacColors.Green.copy(alpha = .35f) else MaterialTheme.colorScheme.outlineVariant),
                onClick = { viewModel.activateDevice(device) },
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (probe == null || probe.probing) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MacColors.Off38)
                    } else {
                        Box(Modifier.size(10.dp).background(if (probe.online) MacColors.Green else MacColors.Ink600, CircleShape))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(device.name, style = MaterialTheme.typography.titleMedium)
                        Text(glance, style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55, maxLines = 1)
                    }
                    IconButton(onClick = { viewModel.beginEditDevice(device) }) { Icon(Icons.Rounded.Edit, "Edit ${device.name}") }
                    IconButton(onClick = { deleteTarget = device }) { Icon(Icons.Rounded.Delete, "Delete ${device.name}", tint = MacColors.Off55) }
                }
            }
        }
        item {
            TactileSurface(
                onClick = viewModel::beginAddDevice,
                modifier = Modifier.fillMaxWidth(),
                color = Color.Transparent,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Icon(Icons.Rounded.Add, null, tint = MacColors.Green)
                Spacer(Modifier.width(8.dp))
                Text("Add another Mac", color = MacColors.Green)
            }
            Spacer(Modifier.height(18.dp))
            SectionLabel("Android")
            Spacer(Modifier.height(8.dp))
            Surface(shape = MaterialTheme.shapes.medium, color = MacColors.Ink850) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Media notification", style = MaterialTheme.typography.titleMedium)
                        Text("Control your Mac from the lock screen", style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55)
                    }
                    Switch(
                        checked = state.mediaNotificationEnabled,
                        onCheckedChange = viewModel::setMediaNotificationEnabled,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(onClick = { viewModel.checkForUpdate() }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Rounded.Refresh, null)
                Spacer(Modifier.width(8.dp))
                Text("Check for app update")
            }
        }
    }
    deleteTarget?.let { device ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Remove ${device.name}?") },
            text = { Text("You can add this Mac again later with its URL and token.") },
            confirmButton = { Button(onClick = { viewModel.removeDevice(device); deleteTarget = null }) { Text("Remove") } },
            dismissButton = { OutlinedButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RemoteScreen(state: MacRemoteUiState, viewModel: MacRemoteViewModel, padding: PaddingValues) {
    val status = state.status
    var timerSheet by remember { mutableStateOf(false) }
    var displaySheet by remember { mutableStateOf(false) }
    var selectedTabKey by remember { mutableStateOf<String?>(null) }
    var confirmAction by remember { mutableStateOf<RemoteAction?>(null) }
    var lockGuardVisible by remember { mutableStateOf(false) }
    val selectedTab = status?.browserTabs?.firstOrNull { it.key == selectedTabKey }
    val nativeNowPlaying = status?.nowPlaying
    val mainPlaying = if (nativeNowPlaying?.title != null || nativeNowPlaying?.state != null) {
        nativeNowPlaying.isPlaying
    } else {
        status?.browserTabs?.any { it.playing && it.isDrivable } == true
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, padding.calculateTopPadding() + 8.dp, 18.dp, padding.calculateBottomPadding() + 34.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(9.dp).background(if (state.online) MacColors.Green else MacColors.Ember, CircleShape))
                Spacer(Modifier.width(9.dp))
                Text(state.activeDevice?.name ?: "Mac", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                status?.battery?.let {
                    Icon(Icons.Rounded.BatteryFull, null, tint = MacColors.Off38, modifier = Modifier.size(17.dp))
                    Text("$it%", style = MaterialTheme.typography.labelMedium, color = MacColors.Off55)
                    Spacer(Modifier.width(6.dp))
                }
                IconButton(onClick = { viewModel.navigate(AppScreen.Devices) }) { Icon(Icons.Rounded.Devices, "Devices") }
            }
        }
        if (!state.online) {
            item {
                Surface(color = MacColors.Ember.copy(alpha = .12f), shape = MaterialTheme.shapes.small) {
                    Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.WifiOff, null, tint = MacColors.Ember)
                        Spacer(Modifier.width(11.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Mac is offline", style = MaterialTheme.typography.titleMedium)
                            Text("Showing the last known state", style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55)
                        }
                        IconButton(onClick = viewModel::refreshNow) { Icon(Icons.Rounded.Refresh, "Retry") }
                    }
                }
            }
        }
        state.latestRelease?.let { release ->
            item {
                TactileSurface(
                    onClick = viewModel::installUpdate,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = state.updateProgress == null,
                    color = MacColors.Green.copy(alpha = .14f),
                    border = BorderStroke(1.dp, MacColors.Green.copy(alpha = .3f)),
                ) {
                    if (state.updateProgress != null) {
                        CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(10.dp))
                        Text("Downloading ${state.updateProgress}%", Modifier.weight(1f))
                    } else {
                        Icon(Icons.Rounded.Refresh, null, tint = MacColors.Green)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text("macremote ${release.version} is ready", style = MaterialTheme.typography.titleMedium)
                            Text("Tap to download and install", style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55)
                        }
                    }
                }
            }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MacColors.Ink850,
                shape = MaterialTheme.shapes.large,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            ) {
                Column(Modifier.padding(22.dp)) {
                    SectionLabel(status?.nowPlaying?.app ?: if (state.online) "Now playing" else "Last seen")
                    Spacer(Modifier.height(14.dp))
                    Text(
                        status?.nowPlaying?.title ?: "Ready when you are",
                        style = MaterialTheme.typography.headlineMedium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(5.dp))
                    Text(
                        status?.nowPlaying?.artist ?: "Media keys work with any frontmost player.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MacColors.Off55,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
        if (!status?.browserTabs.isNullOrEmpty()) {
            item {
                SectionLabel("Browser media")
                Spacer(Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    items(status!!.browserTabs, key = { it.key }) { tab ->
                        TactileSurface(
                            onClick = { selectedTabKey = tab.key },
                            modifier = Modifier.width(190.dp),
                            shape = MaterialTheme.shapes.small,
                            color = if (tab.playing) MacColors.Ink700 else MacColors.Ink850,
                        ) {
                            Icon(if (tab.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, tint = MacColors.Green)
                            Spacer(Modifier.width(9.dp))
                            Column(Modifier.weight(1f)) {
                                Text(tab.title, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                                Text(tab.urlHost ?: tab.browser, maxLines = 1, style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55)
                            }
                        }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                RoundControl(Icons.Rounded.SkipPrevious, "Previous", { viewModel.command(RemoteAction.Previous) }, enabled = state.online)
                RoundControl(
                    if (mainPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                    if (mainPlaying) "Pause" else "Play",
                    { viewModel.command(RemoteAction.PlayPause) },
                    emphasized = true,
                    enabled = state.online,
                )
                RoundControl(Icons.Rounded.SkipNext, "Next", { viewModel.command(RemoteAction.Next) }, enabled = state.online)
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                RoundControl(Icons.Rounded.Replay10, "Back 10", { viewModel.command(RemoteAction.SeekBack) }, enabled = state.online)
                Spacer(Modifier.width(24.dp))
                RoundControl(Icons.Rounded.Forward10, "Forward 10", { viewModel.command(RemoteAction.SeekForward) }, enabled = state.online)
            }
        }
        item { VolumeCard(state, viewModel) }
        item { BrightnessCard(state, viewModel) { displaySheet = true } }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                RoundControl(Icons.Rounded.Lock, "Lock", { confirmAction = RemoteAction.Lock }, enabled = state.online)
                RoundControl(Icons.Rounded.Timer, "Timer", { timerSheet = true }, enabled = state.online)
                RoundControl(Icons.Rounded.Mouse, "Cursor", { viewModel.command(RemoteAction.BanishCursor) }, enabled = state.online)
                RoundControl(Icons.Rounded.Visibility, "Screens", { viewModel.command(RemoteAction.ScreensOn) }, enabled = state.online)
            }
        }
        status?.sleepTimer?.let { timer ->
            item {
                TactileSurface({ timerSheet = true }, Modifier.fillMaxWidth(), color = MacColors.Green.copy(alpha = .13f), border = BorderStroke(1.dp, MacColors.Green.copy(alpha = .28f))) {
                    Icon(Icons.Rounded.Timer, null, tint = MacColors.Green)
                    Spacer(Modifier.width(10.dp))
                    Text(formatDuration(timer.remainingSeconds), modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                    Text(if (timer.mode == SleepMode.Blackout) "blackout" else "sleep", color = MacColors.Off55)
                }
            }
        }
        item {
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(Modifier.height(2.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TactileSurface({ viewModel.navigate(AppScreen.Reading) }, Modifier.weight(1f), color = MacColors.Ink900) {
                    Icon(Icons.Rounded.MenuBook, null, tint = MacColors.Green)
                    Spacer(Modifier.width(8.dp))
                    Text("Reading")
                }
                TactileSurface({ viewModel.navigate(AppScreen.Apps) }, Modifier.weight(1f), color = MacColors.Ink900) {
                    Icon(Icons.Rounded.Apps, null, tint = MacColors.Green)
                    Spacer(Modifier.width(8.dp))
                    Text("Apps")
                }
            }
        }
    }

    if (timerSheet) TimerSheet(
        remaining = status?.sleepTimer?.remainingSeconds,
        currentMode = status?.sleepTimer?.mode,
        viewModel = viewModel,
        onSleepNow = { timerSheet = false; confirmAction = RemoteAction.Sleep },
        onDismiss = { timerSheet = false },
    )
    if (displaySheet) DisplaySheet(state.displays, state.brightnessTarget, viewModel) { displaySheet = false }
    selectedTab?.let { tab -> BrowserTabSheet(tab, viewModel) { selectedTabKey = null } }
    confirmAction?.let { action ->
        AlertDialog(
            onDismissRequest = { confirmAction = null },
            title = { Text(if (action == RemoteAction.Lock) "Lock your Mac?" else "Put your Mac to sleep?") },
            text = { Text("This takes effect immediately on ${state.activeDevice?.name ?: "the active Mac"}.") },
            confirmButton = {
                Button(onClick = {
                    viewModel.command(action)
                    if (action == RemoteAction.Lock) lockGuardVisible = true
                    confirmAction = null
                }) { Text("Continue") }
            },
            dismissButton = { OutlinedButton(onClick = { confirmAction = null }) { Text("Cancel") } },
        )
    }
    if (lockGuardVisible) LockGuard { lockGuardVisible = false }
}

@Composable
private fun LockGuard(onUnlock: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MacColors.Ink950.copy(alpha = .97f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(shape = CircleShape, color = MacColors.Ink800, modifier = Modifier.size(74.dp)) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.Lock, null, tint = MacColors.Off72, modifier = Modifier.size(30.dp))
                }
            }
            Spacer(Modifier.height(22.dp))
            Text("macremote is locked", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(5.dp))
            Text("Press and hold to unlock", color = MacColors.Off55)
            Spacer(Modifier.height(24.dp))
            Surface(
                shape = CircleShape,
                color = MacColors.Ink850,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                modifier = Modifier
                    .size(88.dp)
                    .pointerInput(Unit) {
                        detectTapGestures(onLongPress = { onUnlock() })
                    },
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.Lock, "Hold to unlock", tint = MacColors.Off72)
                }
            }
            Spacer(Modifier.height(10.dp))
            Text("Hold for a moment", style = MaterialTheme.typography.labelMedium, color = MacColors.Off38)
        }
    }
}

@Composable
private fun VolumeCard(state: MacRemoteUiState, viewModel: MacRemoteViewModel) {
    val serverVolume = state.status?.volume ?: 0
    var localVolume by remember(serverVolume) { mutableFloatStateOf(serverVolume.toFloat()) }
    Surface(color = MacColors.Ink850, shape = MaterialTheme.shapes.medium, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionLabel("Volume", Modifier.weight(1f))
                Text("${localVolume.roundToInt()}%", style = MaterialTheme.typography.labelMedium, color = MacColors.Off72)
            }
            Slider(
                value = localVolume,
                onValueChange = { localVolume = it; viewModel.setVolume(it.roundToInt(), false) },
                onValueChangeFinished = { viewModel.setVolume(localVolume.roundToInt(), true) },
                valueRange = 0f..100f,
                enabled = state.online,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TactileSurface({ viewModel.command(RemoteAction.VolumeDown) }, Modifier.weight(1f), enabled = state.online) {
                    Icon(Icons.Rounded.VolumeDown, "Volume down")
                }
                TactileSurface({ viewModel.command(RemoteAction.Mute) }, Modifier.weight(1f), enabled = state.online) {
                    Icon(if (state.status?.muted == true) Icons.Rounded.VolumeOff else Icons.Rounded.VolumeUp, "Mute")
                }
                TactileSurface({ viewModel.command(RemoteAction.VolumeUp) }, Modifier.weight(1f), enabled = state.online) {
                    Icon(Icons.Rounded.VolumeUp, "Volume up")
                }
            }
        }
    }
}

@Composable
private fun BrightnessCard(
    state: MacRemoteUiState,
    viewModel: MacRemoteViewModel,
    onChooseDisplay: () -> Unit,
) {
    val selectedDisplay = state.displays.firstOrNull { it.id == state.brightnessTarget }
    val serverBrightness = selectedDisplay?.let { it.brightness ?: it.gammaLevel } ?: state.status?.brightness
    var localBrightness by remember(serverBrightness) { mutableFloatStateOf((serverBrightness ?: 50).toFloat()) }
    Surface(color = MacColors.Ink850, shape = MaterialTheme.shapes.medium, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionLabel("Brightness", Modifier.weight(1f))
                Text("${localBrightness.roundToInt()}%", style = MaterialTheme.typography.labelMedium, color = MacColors.Off72)
                if (state.displays.size > 1) {
                    Spacer(Modifier.width(8.dp))
                    FilledTonalButton(onClick = onChooseDisplay, contentPadding = PaddingValues(horizontal = 11.dp, vertical = 4.dp)) {
                        Text(selectedDisplay?.name ?: "Display", maxLines = 1)
                        Icon(Icons.Rounded.KeyboardArrowDown, null, Modifier.size(18.dp))
                    }
                }
            }
            Slider(
                value = localBrightness,
                onValueChange = { localBrightness = it },
                onValueChangeFinished = { viewModel.setBrightness(localBrightness.roundToInt()) },
                valueRange = 0f..100f,
                enabled = state.online && serverBrightness != null,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TactileSurface({ viewModel.command(RemoteAction.BrightnessDown) }, Modifier.weight(1f), enabled = state.online) {
                    Icon(Icons.Rounded.BrightnessLow, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Dim")
                }
                TactileSurface({ viewModel.command(RemoteAction.BrightnessUp) }, Modifier.weight(1f), enabled = state.online) {
                    Icon(Icons.Rounded.BrightnessHigh, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Brighten")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimerSheet(
    remaining: Int?,
    currentMode: SleepMode?,
    viewModel: MacRemoteViewModel,
    onSleepNow: () -> Unit,
    onDismiss: () -> Unit,
) {
    var selection by remember {
        mutableStateOf(SleepTimerSelection.forEditing(remaining?.let { (it + 59) / 60 } ?: 60))
    }
    var mode by remember { mutableStateOf(currentMode ?: SleepMode.Sleep) }
    var editing by remember { mutableStateOf(false) }
    var displayedRemaining by remember { mutableIntStateOf(remaining ?: 0) }
    LaunchedEffect(remaining) {
        displayedRemaining = remaining ?: 0
        while (displayedRemaining > 0) {
            delay(1_000)
            displayedRemaining = (displayedRemaining - 1).coerceAtLeast(0)
        }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MacColors.Ink850) {
        Column(Modifier.padding(horizontal = 22.dp).padding(bottom = 36.dp)) {
            Text("Sleep timer", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text("Fade the volume during the final minute, then finish quietly.", color = MacColors.Off55)
            Spacer(Modifier.height(22.dp))
            if (remaining != null && !editing) {
                Text(formatDuration(displayedRemaining), style = MaterialTheme.typography.displaySmall, color = MacColors.Green)
                Spacer(Modifier.height(16.dp))
                OutlinedButton(onClick = { viewModel.cancelSleepTimer(); onDismiss() }, modifier = Modifier.fillMaxWidth()) { Text("Cancel timer") }
                OutlinedButton(onClick = { editing = true }, modifier = Modifier.fillMaxWidth()) { Text("Change timer") }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SleepTimerSelection.presets.forEach { value ->
                        FilledTonalButton(onClick = { selection = selection.choosePreset(value) }, colors = ButtonDefaults.filledTonalButtonColors(containerColor = if (!selection.custom && selection.minutes == value) MacColors.Green.copy(alpha = .25f) else MacColors.Ink700)) {
                            Text("$value min")
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                FilledTonalButton(
                    onClick = { selection = selection.beginCustom() },
                    colors = ButtonDefaults.filledTonalButtonColors(containerColor = if (selection.custom) MacColors.Green.copy(alpha = .25f) else MacColors.Ink700),
                ) { Text("Custom") }
                if (selection.custom) {
                    Spacer(Modifier.height(10.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { selection = selection.adjust(-5) }) { Icon(Icons.Rounded.Remove, "Remove five minutes") }
                        Text("${selection.minutes} min", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(horizontal = 18.dp))
                        IconButton(onClick = { selection = selection.adjust(5) }) { Icon(Icons.Rounded.Add, "Add five minutes") }
                    }
                }
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilledTonalButton(
                        onClick = { mode = SleepMode.Sleep },
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = if (mode == SleepMode.Sleep) MacColors.Green.copy(alpha = .25f) else MacColors.Ink700,
                        ),
                    ) { Icon(Icons.Rounded.Bedtime, null); Spacer(Modifier.width(7.dp)); Text("Sleep") }
                    FilledTonalButton(
                        onClick = { mode = SleepMode.Blackout },
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = if (mode == SleepMode.Blackout) MacColors.Green.copy(alpha = .25f) else MacColors.Ink700,
                        ),
                    ) { Icon(Icons.Rounded.Visibility, null); Spacer(Modifier.width(7.dp)); Text("Blackout") }
                }
                Spacer(Modifier.height(20.dp))
                Button(onClick = { viewModel.setSleepTimer(selection.minutes, mode); onDismiss() }, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                    Text("Arm ${selection.minutes} minute timer")
                }
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = onSleepNow, modifier = Modifier.fillMaxWidth()) { Text("Sleep now") }
                OutlinedButton(onClick = { viewModel.command(RemoteAction.Blackout); onDismiss() }, modifier = Modifier.fillMaxWidth()) { Text("Blackout now") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DisplaySheet(displays: List<DisplayInfo>, selected: String?, viewModel: MacRemoteViewModel, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MacColors.Ink850) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 30.dp)) {
            Text("Brightness display", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(14.dp))
            displays.forEach { display ->
                TactileSurface(
                    onClick = { viewModel.selectBrightnessTarget(display.id); onDismiss() },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    color = if (display.id == selected) MacColors.Ink700 else MacColors.Ink900,
                ) {
                    Icon(Icons.Rounded.Computer, null, tint = if (display.id == selected) MacColors.Green else MacColors.Off55)
                    Spacer(Modifier.width(10.dp))
                    Text(display.name, Modifier.weight(1f))
                    display.brightness?.let { Text("$it%", color = MacColors.Off55) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BrowserTabSheet(tab: BrowserTab, viewModel: MacRemoteViewModel, onDismiss: () -> Unit) {
    var volume by remember(tab.key, tab.volume) { mutableFloatStateOf((tab.volume ?: 100).toFloat()) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MacColors.Ink850) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp)) {
            SectionLabel(tab.browser)
            Spacer(Modifier.height(8.dp))
            Text(tab.title, style = MaterialTheme.typography.headlineMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(20.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TactileSurface({ viewModel.tabCommand(tab, if (tab.playing) "pause" else "play") }, Modifier.weight(1f), enabled = tab.isDrivable) {
                    Icon(if (tab.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (tab.playing) "Pause" else "Play")
                }
                TactileSurface({ viewModel.tabCommand(tab, "mute") }, Modifier.weight(1f), enabled = tab.isDrivable) {
                    Icon(if (tab.muted) Icons.Rounded.VolumeOff else Icons.Rounded.VolumeUp, null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (tab.muted) "Unmute" else "Mute")
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TactileSurface({ viewModel.tabCommand(tab, "seek", -10) }, Modifier.weight(1f), enabled = tab.isDrivable) { Icon(Icons.Rounded.Replay10, "Back 10") }
                TactileSurface({ viewModel.tabCommand(tab, "seek", 10) }, Modifier.weight(1f), enabled = tab.isDrivable) { Icon(Icons.Rounded.Forward10, "Forward 10") }
                TactileSurface({ viewModel.tabCommand(tab, "focus") }, Modifier.weight(1f)) { Icon(Icons.Rounded.OpenInNew, "Focus tab") }
                TactileSurface({ viewModel.tabFullscreen(tab) }, Modifier.weight(1f), enabled = tab.isDrivable) { Icon(Icons.Rounded.Fullscreen, "Fullscreen") }
            }
            if (tab.volume != null) {
                Spacer(Modifier.height(18.dp))
                Text("Tab volume ${volume.roundToInt()}%", style = MaterialTheme.typography.labelMedium)
                Slider(volume, { volume = it }, valueRange = 0f..100f, onValueChangeFinished = { viewModel.tabCommand(tab, "setvolume", volume.roundToInt()) })
            }
        }
    }
}

@Composable
fun ReadingScreen(state: MacRemoteUiState, viewModel: MacRemoteViewModel, padding: PaddingValues) {
    var accumulated by remember { mutableFloatStateOf(0f) }
    var lastSentAt by remember { mutableLongStateOf(0L) }
    var surfaceWidth by remember { mutableIntStateOf(1) }
    Column(
        Modifier.fillMaxSize().padding(
            start = 18.dp,
            end = 18.dp,
            top = padding.calculateTopPadding() + 8.dp,
            bottom = padding.calculateBottomPadding() + 18.dp,
        ),
    ) {
        ScreenHeader("Reading", "A quiet trackpad for the frontmost Mac app.", viewModel::back)
        Spacer(Modifier.height(16.dp))
        Surface(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .onSizeChanged { surfaceWidth = it.width.coerceAtLeast(1) }
                .pointerInput(state.readingMode, surfaceWidth) {
                    detectTapGestures { tap ->
                        when {
                            tap.x < surfaceWidth / 3f -> viewModel.inputKey(if (state.readingMode == "space") "pageup" else "left")
                            tap.x > surfaceWidth * 2f / 3f -> viewModel.inputKey(if (state.readingMode == "space") "space" else "right")
                        }
                    }
                }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { accumulated = 0f; lastSentAt = 0L },
                        onDragEnd = {
                            if (accumulated.roundToInt() != 0) viewModel.scroll(accumulated.roundToInt())
                            accumulated = 0f
                        },
                    ) { change, drag ->
                        change.consume()
                        accumulated += -drag.y * 1.6f
                        val now = System.currentTimeMillis()
                        if (now - lastSentAt >= 55 && accumulated.roundToInt() != 0) {
                            viewModel.scroll(accumulated.roundToInt())
                            accumulated = 0f
                            lastSentAt = now
                        }
                    }
                },
            color = MacColors.Ink900,
            shape = MaterialTheme.shapes.large,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        ) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Row(Modifier.fillMaxSize()) {
                    Box(Modifier.weight(1f).fillMaxHeight())
                    Box(Modifier.width(1.dp).fillMaxHeight().background(MaterialTheme.colorScheme.outlineVariant))
                    Box(Modifier.weight(1f).fillMaxHeight())
                    Box(Modifier.width(1.dp).fillMaxHeight().background(MaterialTheme.colorScheme.outlineVariant))
                    Box(Modifier.weight(1f).fillMaxHeight())
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Rounded.MenuBook, null, tint = MacColors.Off38, modifier = Modifier.size(40.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("Drag up to read on", style = MaterialTheme.typography.titleLarge)
                    Text("Tap a side to turn the page", color = MacColors.Off55)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TactileSurface(
                { viewModel.inputKey(if (state.readingMode == "space") "pageup" else "left") },
                Modifier.weight(1f).height(58.dp),
            ) { Icon(Icons.Rounded.ChevronLeft, null); Spacer(Modifier.width(6.dp)); Text("Previous") }
            TactileSurface(
                { viewModel.inputKey(if (state.readingMode == "space") "space" else "right") },
                Modifier.weight(1f).height(58.dp),
            ) { Text("Next"); Spacer(Modifier.width(6.dp)); Icon(Icons.Rounded.ChevronRight, null) }
        }
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledTonalButton(onClick = { viewModel.setReadingMode("arrows") }, modifier = Modifier.weight(1f)) { Text("Arrow keys") }
            FilledTonalButton(onClick = { viewModel.setReadingMode("space") }, modifier = Modifier.weight(1f)) { Text("Space / Page") }
        }
    }
}

@Composable
fun AppsScreen(state: MacRemoteUiState, viewModel: MacRemoteViewModel, padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp, padding.calculateTopPadding() + 8.dp, 18.dp, padding.calculateBottomPadding() + 38.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        item {
            ScreenHeader("Apps", "Focus a window and balance app audio.", viewModel::back) {
                IconButton(onClick = viewModel::loadApps) { Icon(Icons.Rounded.Refresh, "Refresh") }
            }
            Spacer(Modifier.height(12.dp))
        }
        if (state.loadingApps) item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
        state.windows.forEach { display ->
            if (display.windows.isNotEmpty()) item { SectionLabel(display.name) }
            items(display.windows, key = { "window_${it.id}" }) { window ->
                ListRow(window.app, window.title.ifBlank { "Untitled window" }, window.active) { viewModel.focusWindow(window.id) }
            }
        }
        items(state.fallbackApps, key = { it.bundleId }) { app ->
            ListRow(app.name, if (app.active) "frontmost" else "tap to switch", app.active) { viewModel.focusApp(app.bundleId) }
        }
        if (state.audioAvailable != null) {
            item { Spacer(Modifier.height(8.dp)); SectionLabel("App volume") }
            if (state.audioAvailable == false) item {
                Text("Install Background Music on the Mac to control each app separately.", color = MacColors.Off55, modifier = Modifier.padding(12.dp))
            }
            items(state.audioApps, key = { it.name }) { app -> AppVolumeRow(app, viewModel) }
        }
    }
}

@Composable
private fun AppVolumeRow(app: AudioApp, viewModel: MacRemoteViewModel) {
    var volume by remember(app.name, app.volume) { mutableFloatStateOf(app.volume.toFloat()) }
    Surface(color = MacColors.Ink850, shape = MaterialTheme.shapes.small) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row { Text(app.name, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium); Text("${volume.roundToInt()}%", color = MacColors.Off55) }
            Slider(volume, { volume = it }, valueRange = 0f..100f, onValueChangeFinished = { viewModel.setAppVolume(app.name, volume.roundToInt()) })
        }
    }
}

@Composable
private fun ListRow(title: String, detail: String, active: Boolean, onClick: () -> Unit) {
    TactileSurface(onClick, Modifier.fillMaxWidth(), color = if (active) MacColors.Ink700 else MacColors.Ink850) {
        Box(Modifier.size(9.dp).background(if (active) MacColors.Green else MacColors.Ink600, CircleShape))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun ScreenHeader(title: String, detail: String, onBack: () -> Unit, trailing: @Composable () -> Unit = {}) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onBack) { Icon(Icons.Rounded.ArrowBack, "Back") }
        Spacer(Modifier.width(6.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.headlineMedium)
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MacColors.Off55)
        }
        trailing()
    }
}

private fun formatDuration(totalSeconds: Int): String {
    val safe = totalSeconds.coerceAtLeast(0)
    return "%d:%02d".format(safe / 60, safe % 60)
}
