package com.collectiontracker.app

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.CheckBox
import android.widget.ImageButton
import android.widget.Spinner
import android.widget.Button
import android.view.View
import android.webkit.WebView
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import org.robolectric.shadows.ShadowToast
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.android.controller.ActivityController
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowAlertDialog
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MainActivityUpdateTest {
  private val prefs get() = RuntimeEnvironment.getApplication().getSharedPreferences("collection_tracker_prefs", Context.MODE_PRIVATE)
  private var controller: ActivityController<MainActivity>? = null
  private var fetchCount = 0
  private val candidate = UpdateBuild("release", "99.0.0", "b".repeat(40), BuildConfig.COMMIT_TIME + 1000, 2000000000)

  @Before fun clearPreferences() {
    prefs.edit().clear().commit()
    fetchCount = 0
    MainActivity.defaultUpdateFetcher = { fetchCount++; candidate }
  }
  @After fun closeActivity() {
    controller?.pause()?.stop()?.destroy()
    MainActivity.defaultUpdateFetcher = UpdateClient::fetch
  }

  private fun launch(state: UpdateState? = null): MainActivity {
    state?.let { prefs.edit().putString("updates", UpdateCodec.encode(it)).commit() }
    controller = Robolectric.buildActivity(MainActivity::class.java).setup()
    return controller!!.get()
  }

  @Test fun settingsOnConfigurationScreenDefaultToOptOut() {
    val activity = launch()
    val settingsButton = activity.findViewById<ImageButton>(R.id.nativeSettingsButton)
    assertTrue(settingsButton.isShown)
    assertEquals("App settings", settingsButton.contentDescription.toString())
    assertNotNull(settingsButton.drawable)
    settingsButton.performClick()
    val dialog = ShadowAlertDialog.getLatestAlertDialog()
    assertFalse(dialog.findViewById<CheckBox>(R.id.updateEnabled).isChecked)
    assertEquals(0, dialog.findViewById<Spinner>(R.id.updateChannel).selectedItemPosition)
    dialog.findViewById<Spinner>(R.id.updateChannel).setSelection(1)
    shadowOf(android.os.Looper.getMainLooper()).idle()
    val state = UpdateCodec.decode(prefs.getString("updates", null), "release")
    assertEquals("snapshot", state.channel)
    assertFalse(state.enabled)
    assertEquals(0L, state.lastAttempt)
  }

  private fun bridge(activity: MainActivity): CollectionTrackerBridge =
    shadowOf(activity.findViewById<WebView>(R.id.webView)).getJavascriptInterface("CollectionTrackerInterface") as CollectionTrackerBridge

  @Test fun savedInstanceHidesWholeBarAndBridgeOpensSameSettingsDialog() {
    prefs.edit().putString("page_url", "https://collection.example/client/").commit()
    val activity = launch()
    assertEquals(View.GONE, activity.findViewById<View>(R.id.nativeSettingsBar).visibility)
    Thread { bridge(activity).showSettings() }.apply { start(); join() }
    shadowOf(android.os.Looper.getMainLooper()).idle()
    val dialog = ShadowAlertDialog.getLatestAlertDialog()
    assertNotNull(dialog.findViewById<Button>(R.id.checkUpdates))
    bridge(activity).showSettings()
    assertSame(dialog, ShadowAlertDialog.getLatestAlertDialog())
    dialog.getButton(AlertDialog.BUTTON_NEUTRAL).performClick()
    shadowOf(android.os.Looper.getMainLooper()).idle()
    assertTrue(activity.findViewById<View>(R.id.nativeSettingsBar).isShown)
    activity.findViewById<Button>(R.id.openButton).performClick()
    assertEquals(View.GONE, activity.findViewById<View>(R.id.nativeSettingsBar).visibility)
    bridge(activity).resetAppConfig()
    shadowOf(android.os.Looper.getMainLooper()).idle()
    assertTrue(activity.findViewById<View>(R.id.nativeSettingsBar).isShown)
  }

  @Test fun openingWebViewAndLoadFailureKeepBarHiddenUntilEditingUrls() {
    val activity = launch()
    val connectivity = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val capabilities = NetworkCapabilities()
    shadowOf(capabilities).addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    shadowOf(connectivity).setNetworkCapabilities(connectivity.activeNetwork, capabilities)
    activity.findViewById<android.widget.EditText>(R.id.pageUrlInput).setText("https://collection.example/client/")
    activity.findViewById<Button>(R.id.openButton).performClick()
    val webView = activity.findViewById<WebView>(R.id.webView)
    assertTrue(webView.isShown)
    assertEquals(View.GONE, activity.findViewById<View>(R.id.nativeSettingsBar).visibility)
    webView.webViewClient.onReceivedSslError(webView, null, null)
    assertTrue(activity.findViewById<View>(R.id.errorContainer).isShown)
    assertEquals(View.GONE, activity.findViewById<View>(R.id.nativeSettingsBar).visibility)
    activity.findViewById<Button>(R.id.editButton).performClick()
    assertTrue(activity.findViewById<View>(R.id.nativeSettingsBar).isShown)
  }

  private fun waitForUpdate(condition: () -> Boolean) {
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
    while (!condition() && System.nanoTime() < deadline) {
      shadowOf(android.os.Looper.getMainLooper()).idle()
      Thread.sleep(10)
    }
    assertTrue(condition())
  }

  @Test fun manualCheckWorksWhenDisabledAndSuppressesDuplicateRequests() {
    val started = CountDownLatch(1)
    val release = CountDownLatch(1)
    MainActivity.defaultUpdateFetcher = {
      fetchCount++
      started.countDown()
      release.await(5, TimeUnit.SECONDS)
      candidate
    }
    val activity = launch(UpdateState(false, "release", System.currentTimeMillis(), skipped = mapOf("release" to candidate)))
    bridge(activity).showSettings()
    val button = ShadowAlertDialog.getLatestAlertDialog().findViewById<Button>(R.id.checkUpdates)
    button.performClick()
    assertTrue(started.await(5, TimeUnit.SECONDS))
    button.performClick()
    release.countDown()
    waitForUpdate { ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).text == "Open release" }
    assertEquals(1, fetchCount)
    assertFalse(UpdateCodec.decode(prefs.getString("updates", null), "release").enabled)
  }

  @Test fun manualCheckReportsNoUpdateAndFailure() {
    MainActivity.defaultUpdateFetcher = { null }
    val activity = launch()
    bridge(activity).showSettings()
    val button = ShadowAlertDialog.getLatestAlertDialog().findViewById<Button>(R.id.checkUpdates)
    button.performClick()
    waitForUpdate { ShadowToast.getTextOfLatestToast() == activity.getString(R.string.update_current) }
    activity.updateFetcher = { error("offline") }
    button.performClick()
    waitForUpdate { ShadowToast.getTextOfLatestToast() == activity.getString(R.string.update_failed) }
    assertFalse(UpdateCodec.decode(prefs.getString("updates", null), "release").enabled)
  }

  @Test fun manualCheckSupersedesAutomaticRequestAndReportsItsResult() {
    val started = CountDownLatch(1)
    val release = CountDownLatch(1)
    MainActivity.defaultUpdateFetcher = {
      fetchCount++
      started.countDown()
      release.await(5, TimeUnit.SECONDS)
      null
    }
    val activity = launch(UpdateState(enabled = true))
    assertTrue(started.await(5, TimeUnit.SECONDS))
    bridge(activity).showSettings()
    ShadowAlertDialog.getLatestAlertDialog().findViewById<Button>(R.id.checkUpdates).performClick()
    release.countDown()
    waitForUpdate { ShadowToast.getTextOfLatestToast() == activity.getString(R.string.update_current) }
    assertEquals(2, fetchCount)
  }

  @Test fun recreationRetriesManualCheckWhileAutomaticChecksRemainDisabled() {
    val started = CountDownLatch(1)
    MainActivity.defaultUpdateFetcher = {
      started.countDown()
      CountDownLatch(1).await(5, TimeUnit.SECONDS)
      candidate
    }
    val activity = launch()
    bridge(activity).showSettings()
    ShadowAlertDialog.getLatestAlertDialog().findViewById<Button>(R.id.checkUpdates).performClick()
    assertTrue(started.await(5, TimeUnit.SECONDS))
    val savedState = Bundle()
    controller!!.saveInstanceState(savedState)
    assertTrue(savedState.getBoolean("updateManual"))
    controller!!.pause().stop().destroy()
    MainActivity.defaultUpdateFetcher = { candidate }
    controller = Robolectric.buildActivity(MainActivity::class.java).setup(savedState)
    waitForUpdate { ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).text == "Open release" }
    assertFalse(UpdateCodec.decode(prefs.getString("updates", null), "release").enabled)
  }

  @Test fun channelChangeDoesNotRestoreObsoleteManualRequestAfterRotation() {
    val release = CountDownLatch(1)
    MainActivity.defaultUpdateFetcher = {
      release.await(5, TimeUnit.SECONDS)
      candidate
    }
    val activity = launch()
    bridge(activity).showSettings()
    val dialog = ShadowAlertDialog.getLatestAlertDialog()
    dialog.findViewById<Button>(R.id.checkUpdates).performClick()
    dialog.findViewById<Spinner>(R.id.updateChannel).setSelection(1)
    shadowOf(android.os.Looper.getMainLooper()).idle()
    val savedState = Bundle()
    controller!!.saveInstanceState(savedState)
    release.countDown()
    assertFalse(savedState.getBoolean("updatePending"))
    assertFalse(savedState.getBoolean("updateManual"))
    assertEquals("snapshot", UpdateCodec.decode(prefs.getString("updates", null), "release").channel)
  }

  @Test fun cachedDialogSkipPersistsWithoutFetching() {
    val state = UpdateState(true, "release", System.currentTimeMillis(), candidate)
    launch(state)
    val dialog = ShadowAlertDialog.getLatestAlertDialog()
    assertTrue(dialog.isShowing)
    assertEquals("Open release", dialog.getButton(AlertDialog.BUTTON_POSITIVE).text.toString())
    dialog.getButton(AlertDialog.BUTTON_NEUTRAL).performClick()
    shadowOf(android.os.Looper.getMainLooper()).idle()
    val saved = UpdateCodec.decode(prefs.getString("updates", null), "release")
    assertEquals(candidate, saved.skipped["release"])
    assertEquals(state.lastAttempt, saved.lastAttempt)
    assertFalse(dialog.isShowing)
  }

  @Test fun openReleaseUsesExternalTrustedIntent() {
    val activity = launch(UpdateState(true, "release", System.currentTimeMillis(), candidate))
    ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick()
    shadowOf(android.os.Looper.getMainLooper()).idle()
    val intent = shadowOf(activity).nextStartedActivity
    assertEquals(Intent.ACTION_VIEW, intent.action)
    assertEquals(candidate.releaseUrl, intent.data.toString())
  }

  @Test fun cancelDoesNotSkipAndDoesNotReappearOnResume() {
    launch(UpdateState(true, "release", System.currentTimeMillis(), candidate))
    val dialog = ShadowAlertDialog.getLatestAlertDialog()
    dialog.getButton(AlertDialog.BUTTON_NEGATIVE).performClick()
    shadowOf(android.os.Looper.getMainLooper()).idle()
    controller!!.pause().resume()
    assertFalse(dialog.isShowing)
    assertTrue(UpdateCodec.decode(prefs.getString("updates", null), "release").skipped.isEmpty())
  }

  @Test fun recreationRetriesInterruptedCheckWithoutWaitingForDailyInterval() {
    shadowOf(android.os.Looper.getMainLooper()).pause()
    val previousAttempt = System.currentTimeMillis() - 1000
    val activity = launch(UpdateState(lastAttempt = previousAttempt))
    activity.findViewById<ImageButton>(R.id.nativeSettingsButton).performClick()
    ShadowAlertDialog.getLatestAlertDialog().findViewById<CheckBox>(R.id.updateEnabled).isChecked = true
    val savedState = Bundle()
    controller!!.saveInstanceState(savedState)
    assertTrue(savedState.getBoolean("updatePending"))
    controller!!.pause().stop().destroy()
    controller = Robolectric.buildActivity(MainActivity::class.java).setup(savedState)
    shadowOf(android.os.Looper.getMainLooper()).idle()
    assertEquals(2, fetchCount)
    assertEquals(candidate, UpdateCodec.decode(prefs.getString("updates", null), "release").cached)
  }

  @Test fun disabledCachedUpdateDoesNotDisplayDialog() {
    val activity = launch(UpdateState(false, "release", 0, candidate))
    assertNull(ShadowAlertDialog.getLatestAlertDialog())
    activity.findViewById<ImageButton>(R.id.nativeSettingsButton).performClick()
    assertNotNull(ShadowAlertDialog.getLatestAlertDialog().findViewById<CheckBox>(R.id.updateEnabled))
    assertEquals(0L, UpdateCodec.decode(prefs.getString("updates", null), "release").lastAttempt)
  }
}
