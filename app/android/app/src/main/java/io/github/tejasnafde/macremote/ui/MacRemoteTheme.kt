package io.github.tejasnafde.macremote.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object MacColors {
    val Ink950 = Color(0xFF0B0E12)
    val Ink900 = Color(0xFF10141A)
    val Ink850 = Color(0xFF131820)
    val Ink800 = Color(0xFF171D26)
    val Ink700 = Color(0xFF1E2530)
    val Ink600 = Color(0xFF2A323E)
    val Off = Color(0xFFF3F5F1)
    val Off72 = Color(0xB8F3F5F1)
    val Off55 = Color(0x8CF3F5F1)
    val Off38 = Color(0x61F3F5F1)
    val Green = Color(0xFF4ADE80)
    val GreenStrong = Color(0xFF7BEDAA)
    val GreenInk = Color(0xFF04140B)
    val Ember = Color(0xFFF2795B)
}

private val colors = darkColorScheme(
    primary = MacColors.Green,
    onPrimary = MacColors.GreenInk,
    primaryContainer = Color(0xFF153422),
    onPrimaryContainer = MacColors.GreenStrong,
    secondary = MacColors.Off72,
    onSecondary = MacColors.Ink950,
    background = MacColors.Ink950,
    onBackground = MacColors.Off,
    surface = MacColors.Ink850,
    onSurface = MacColors.Off,
    surfaceVariant = MacColors.Ink800,
    onSurfaceVariant = MacColors.Off55,
    outline = Color(0xFF353D48),
    outlineVariant = Color(0xFF242B34),
    error = MacColors.Ember,
)

private val typography = androidx.compose.material3.Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, fontSize = 34.sp, letterSpacing = (-1.2).sp),
    headlineLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, fontSize = 28.sp, letterSpacing = (-0.8).sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.ExtraBold, fontSize = 23.sp, letterSpacing = (-0.4).sp),
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 13.sp, letterSpacing = 0.2.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 0.8.sp),
)

@Composable
fun MacRemoteTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        typography = typography,
        shapes = Shapes(
            extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(11.dp),
            small = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            medium = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
            large = androidx.compose.foundation.shape.RoundedCornerShape(32.dp),
        ),
        content = content,
    )
}
