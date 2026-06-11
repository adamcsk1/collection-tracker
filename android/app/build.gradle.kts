import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

plugins {
  id("com.android.application")
}

val versionCodeTimestamp: Int = ZonedDateTime.now(ZoneOffset.UTC)
  .format(DateTimeFormatter.ofPattern("yyMMddHH")).toInt()

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
    versionName = "0.1.0"
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildTypes {
    getByName("release") {
      isMinifyEnabled = false
      //noinspection NotShrinkingResources
      isShrinkResources = false
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.19.0")
  implementation("androidx.appcompat:appcompat:1.7.1")
  implementation("com.google.android.material:material:1.14.0")
  testImplementation("org.jetbrains.kotlin:kotlin-test-junit:2.2.21")
}
