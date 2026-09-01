import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

plugins {
  id("com.android.application")
}

val versionCodeTimestamp: Int = ZonedDateTime.now(ZoneOffset.UTC)
  .format(DateTimeFormatter.ofPattern("yyMMddHH")).toInt()

val releaseKeystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
val releaseKeystorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD")
val hasReleaseSigning = releaseKeystorePath.isPresent &&
  releaseKeystorePassword.isPresent &&
  releaseKeyAlias.isPresent &&
  releaseKeyPassword.isPresent

base {
  archivesName.set("collection-tracker")
}

android {
  namespace = "com.collectiontracker.app"
  compileSdk = 37

  defaultConfig {
    applicationId = "com.collectiontracker.app"
    minSdk = 35
    targetSdk = 37
    versionCode = versionCodeTimestamp
    versionName = "0.0.1"
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("release") {
        storeFile = file(releaseKeystorePath.get())
        storePassword = releaseKeystorePassword.get()
        keyAlias = releaseKeyAlias.get()
        keyPassword = releaseKeyPassword.get()
      }
    }
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false
      //noinspection NotShrinkingResources
      isShrinkResources = false
      if (hasReleaseSigning) {
        signingConfig = signingConfigs.getByName("release")
      }
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.19.0")
  implementation("androidx.appcompat:appcompat:1.8.0")
  implementation("com.google.android.material:material:1.14.0")
  testImplementation("org.jetbrains.kotlin:kotlin-test-junit:2.2.21")
}
