import java.time.Instant

plugins {
  id("com.android.application")
}

val versionCodeTimestamp = providers.environmentVariable("CT_BUILD_CODE").orNull?.toInt()
  ?: (Instant.now().epochSecond / 2).toInt()
val buildChannel = providers.environmentVariable("CT_BUILD_CHANNEL").getOrElse("release")
val buildVersion = providers.environmentVariable("CT_BUILD_VERSION").getOrElse("0.0.1")
require(Regex("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)").matches(buildVersion))
val buildCommit = providers.environmentVariable("CT_BUILD_COMMIT").orNull ?: providers.exec {
  commandLine("git", "rev-parse", "HEAD")
}.standardOutput.asText.get().trim()
val commitTime = providers.environmentVariable("CT_COMMIT_TIME").orNull ?: providers.exec {
  commandLine("git", "show", "-s", "--format=%ct", "HEAD")
}.standardOutput.asText.get().trim()
require(buildChannel in listOf("release", "snapshot"))
require(Regex("[a-f0-9]{40}").matches(buildCommit))
require(commitTime.toLong() > 0)

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
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    versionCode = versionCodeTimestamp
    versionName = buildVersion
    buildConfigField("String", "UPDATE_CHANNEL", "\"$buildChannel\"")
    buildConfigField("String", "BUILD_COMMIT", "\"$buildCommit\"")
    buildConfigField("long", "COMMIT_TIME", "${commitTime}L")
  }

  buildFeatures { buildConfig = true }
  testOptions { unitTests.isIncludeAndroidResources = true }

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
  testImplementation("org.json:json:20250517")
  testImplementation("org.robolectric:robolectric:4.16.1")
  androidTestImplementation("androidx.test:runner:1.7.0")
  androidTestImplementation("junit:junit:4.13.2")
}
