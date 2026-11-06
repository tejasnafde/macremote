package io.github.tejasnafde.macremote

import android.os.Build
import android.os.Bundle
import android.view.View
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
        // The API token field triggered "Save password to Google Password
        // Manager". No field here should be autofilled or saved, so opt the
        // whole window out of Autofill.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.decorView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS
        }
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
