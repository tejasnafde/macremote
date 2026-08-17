package io.github.tejasnafde.macremote.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.github.tejasnafde.macremote.state.AppScreen
import io.github.tejasnafde.macremote.state.MacRemoteViewModel

@Composable
fun MacRemoteApp(viewModel: MacRemoteViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) viewModel.setMediaNotificationEnabled(false)
    }

    LaunchedEffect(state.mediaNotificationEnabled) {
        if (
            state.mediaNotificationEnabled &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    BackHandler(enabled = state.screen !in setOf(AppScreen.Loading, AppScreen.Remote)) { viewModel.back() }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MacColors.Ink950,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        AnimatedContent(
            targetState = state.screen,
            transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(120)) },
            label = "screen",
        ) { screen ->
            when (screen) {
                AppScreen.Loading -> LoadingScreen(padding)
                AppScreen.Setup -> SetupScreen(state, viewModel, padding)
                AppScreen.Remote -> RemoteScreen(state, viewModel, padding)
                AppScreen.Devices -> DevicesScreen(state, viewModel, padding)
                AppScreen.Reading -> ReadingScreen(state, viewModel, padding)
                AppScreen.Apps -> AppsScreen(state, viewModel, padding)
            }
        }
    }
}
