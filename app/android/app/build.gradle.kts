import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "io.github.tejasnafde.macremote"
    compileSdk = 36

    val localKeystoreInfo = Properties()
    val localKeystoreInfoFile = file("${System.getProperty("user.home")}/.macremote/keystore.info")
    if (localKeystoreInfoFile.isFile) {
        localKeystoreInfoFile.inputStream().use(localKeystoreInfo::load)
    }
    val releaseKeystoreFile = System.getenv("ANDROID_KEYSTORE_PATH")
        ?.let(::file)
        ?: file("${System.getProperty("user.home")}/.macremote/release.keystore")

    defaultConfig {
        minSdk = 24
        targetSdk = 36
        versionCode = 26
        versionName = "0.5.6"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "distribution"
    productFlavors {
        create("github") {
            dimension = "distribution"
            applicationId = "io.github.tejasnafde.macremote"
            buildConfigField("boolean", "ENABLE_SELF_UPDATES", "true")
        }
        create("play") {
            dimension = "distribution"
            applicationId = "app.tn07.macremote"
            buildConfigField("boolean", "ENABLE_SELF_UPDATES", "false")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            val storePasswordValue = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                ?: localKeystoreInfo.getProperty("STOREPASS")
            val keyAliasValue = System.getenv("ANDROID_KEY_ALIAS")
                ?: localKeystoreInfo.getProperty("ALIAS")
            val keyPasswordValue = System.getenv("ANDROID_KEY_PASSWORD")
                ?: localKeystoreInfo.getProperty("KEYPASS")
                ?: storePasswordValue

            if (releaseKeystoreFile.isFile && storePasswordValue != null && keyAliasValue != null && keyPasswordValue != null) {
                storeFile = releaseKeystoreFile
                storePassword = storePasswordValue
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }

    buildTypes {
        release {
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile != null) {
                signingConfig = releaseSigning
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.core)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.json)
}
