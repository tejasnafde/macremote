package io.github.tejasnafde.macremote

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import io.github.tejasnafde.macremote.state.MacRemoteViewModel
import io.github.tejasnafde.macremote.ui.MacRemoteApp
import io.github.tejasnafde.macremote.ui.MacRemoteTheme

class MainActivity : ComponentActivity() {
    private val viewModel: MacRemoteViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MacRemoteTheme {
                MacRemoteApp(viewModel)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        viewModel.setForeground(true)
    }

    override fun onStop() {
        viewModel.setForeground(false)
        super.onStop()
    }
}
