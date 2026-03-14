import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

plugins {
  id("com.android.application")
}

val apkBuildTimestamp: String = ZonedDateTime.now(ZoneOffset.UTC)
  .format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))

base {
  archivesName.set("collection-tracker-0.1.0-$apkBuildTimestamp")
}

android {
  namespace = "com.collectiontracker.app"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.collectiontracker.app"
    minSdk = 35
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false
      isShrinkResources = false
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.18.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("com.google.android.material:material:1.13.0")
}
