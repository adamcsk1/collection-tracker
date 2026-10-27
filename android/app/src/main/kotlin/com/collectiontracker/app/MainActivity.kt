package com.collectiontracker.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Uri
import android.net.NetworkCapabilities
import android.net.http.SslError
import android.os.Bundle
import android.os.Build
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast
import android.widget.TextView
import android.widget.Spinner
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.view.View
import java.util.concurrent.Executors
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.edit
import androidx.core.net.toUri
import androidx.core.view.isVisible
import androidx.core.widget.addTextChangedListener
import org.json.JSONObject

private const val PREFS_NAME = "collection_tracker_prefs"
private const val PREF_PAGE_URL = "page_url"
private const val PREF_API_URL = "api_url"
private const val PREF_TRUST_UNTRUSTED_CERTIFICATES = "trust_untrusted_certificates"
private const val PREFS_API_URL = "CT.ApiUrl"

class MainActivity : AppCompatActivity() {
  internal companion object {
    var defaultUpdateFetcher: (String) -> UpdateBuild? = UpdateClient::fetch
  }

  private lateinit var pageInput: EditText
  private lateinit var apiInput: EditText
  private lateinit var trustUntrustedCertificatesInput: CheckBox
  private lateinit var openButton: Button
  private lateinit var editButton: Button
  private lateinit var retryButton: Button
  private lateinit var permissionSettingsButton: Button
  private lateinit var errorMessage: TextView
  private lateinit var configContainer: ScrollView
  private lateinit var errorContainer: LinearLayout
  private lateinit var webView: WebView

  private var pageUrl: String = ""
  private var apiUrl: String = ""
  private var isShowingInvalidPage = false
  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
  private val navigation = WebViewNavigation()
  private lateinit var updates: UpdateSession
  private val updateExecutor = Executors.newSingleThreadExecutor()
  internal var updateFetcher: (String) -> UpdateBuild? = defaultUpdateFetcher
  private var updateDialog: AlertDialog? = null
  private var settingsDialog: AlertDialog? = null
  private var pendingUpdateRequest: UpdateRequest? = null
  private var resumed = false

  private val localNetworkPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    if (granted) {
      launchWebView()
    } else {
      showError(R.string.error_local_network_permission)
      permissionSettingsButton.isVisible = true
    }
  }

  private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
    val callback = fileChooserCallback ?: return@registerForActivityResult
    fileChooserCallback = null
    val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
    callback.onReceiveValue(uris)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    pageInput = findViewById(R.id.pageUrlInput)
    apiInput = findViewById(R.id.apiUrlInput)
    trustUntrustedCertificatesInput = findViewById(R.id.trustUntrustedCertificatesInput)
    openButton = findViewById(R.id.openButton)
    editButton = findViewById(R.id.editButton)
    retryButton = findViewById(R.id.retryButton)
    permissionSettingsButton = findViewById(R.id.permissionSettingsButton)
    errorMessage = findViewById(R.id.errorMessage)
    configContainer = findViewById(R.id.configContainer)
    errorContainer = findViewById(R.id.errorContainer)
    webView = findViewById(R.id.webView)

    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    pageInput.setText(prefs.getString(PREF_PAGE_URL, ""))
    apiInput.setText(prefs.getString(PREF_API_URL, ""))
    trustUntrustedCertificatesInput.isChecked = prefs.getBoolean(PREF_TRUST_UNTRUSTED_CERTIFICATES, false)
    updateApiFromPageUrl()

    setupWebView()
    configureActions()
    maybeStartFromSavedConfig()
    updates = UpdateSession(
      UpdateBuild(BuildConfig.UPDATE_CHANNEL, BuildConfig.VERSION_NAME, BuildConfig.BUILD_COMMIT,
        BuildConfig.COMMIT_TIME, BuildConfig.VERSION_CODE.toLong()),
      UpdateCodec.decode(prefs.getString("updates", null), BuildConfig.UPDATE_CHANNEL),
    ) { state -> prefs.edit { putString("updates", UpdateCodec.encode(state)) } }
    updates.dismissed = savedInstanceState?.getBoolean("updateDismissed") ?: false
    findViewById<ImageButton>(R.id.nativeSettingsButton).setOnClickListener { showNativeSettings() }
    if (savedInstanceState?.getBoolean("updatePending") == true) checkUpdates(force = true, manual = savedInstanceState.getBoolean("updateManual"))
    else if (savedInstanceState == null) checkUpdates()
  }

  override fun onResume() {
    super.onResume()
    resumed = true
    if (::updates.isInitialized) showAvailableUpdate()
  }

  override fun onSaveInstanceState(outState: Bundle) {
    if (::updates.isInitialized) {
      val pending = pendingUpdateRequest?.takeIf { updates.accepts(it) }
      outState.putBoolean("updateDismissed", updates.dismissed)
      outState.putBoolean("updatePending", pending != null)
      outState.putBoolean("updateManual", pending?.manual == true)
    }
    super.onSaveInstanceState(outState)
  }

  override fun onDestroy() {
    updateExecutor.shutdownNow()
    updateDialog?.dismiss()
    settingsDialog?.dismiss()
    super.onDestroy()
  }

  override fun onPause() {
    resumed = false
    super.onPause()
    CookieManager.getInstance().flush()
  }

  private fun showNativeSettings() {
    if (isFinishing || isDestroyed || settingsDialog?.isShowing == true) return
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      val padding = (24 * resources.displayMetrics.density).toInt()
      setPadding(padding, padding, padding, padding)
    }
    val enabled = CheckBox(this).apply {
      id = R.id.updateEnabled
      setText(R.string.update_enabled)
      isChecked = updates.state.enabled
    }
    val label = TextView(this).apply { setText(R.string.update_channel); labelFor = R.id.updateChannel }
    val channels = listOf("release", "snapshot")
    val channel = Spinner(this).apply {
      id = R.id.updateChannel
      contentDescription = getString(R.string.update_channel)
      adapter = ArrayAdapter.createFromResource(this@MainActivity, R.array.update_channels, android.R.layout.simple_spinner_dropdown_item)
      setSelection(channels.indexOf(updates.state.channel))
    }
    fun changed() {
      if (updates.configure(enabled.isChecked, channels[channel.selectedItemPosition])) {
        updateDialog?.dismiss()
        checkUpdates(force = true)
      }
    }
    enabled.setOnCheckedChangeListener { _, _ -> changed() }
    channel.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
      override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) = changed()
      override fun onNothingSelected(parent: AdapterView<*>?) = Unit
    }
    content.addView(enabled)
    content.addView(label)
    content.addView(channel)
    content.addView(Button(this).apply {
      id = R.id.checkUpdates
      setText(R.string.update_check)
      setOnClickListener { checkUpdates(manual = true) }
    })
    settingsDialog = AlertDialog.Builder(this).setTitle(R.string.native_settings).setView(content)
      .setPositiveButton(android.R.string.ok, null)
      .setNeutralButton(R.string.edit_settings) { _, _ -> showConfig() }.show()
  }

  private fun checkUpdates(force: Boolean = false, manual: Boolean = false) {
    if (pendingUpdateRequest?.let { updates.accepts(it) && (!manual || it.manual) } == true) {
      if (manual) Toast.makeText(this, R.string.update_checking, Toast.LENGTH_SHORT).show()
      return
    }
    if (!manual) showAvailableUpdate()
    val request = updates.begin(System.currentTimeMillis(), force, manual) ?: return
    pendingUpdateRequest = request
    if (manual) Toast.makeText(this, R.string.update_checking, Toast.LENGTH_SHORT).show()
    updateExecutor.execute {
      val result = runCatching { updateFetcher(request.channel) }
      runOnUiThread {
        if (isDestroyed || isFinishing) return@runOnUiThread
        if (pendingUpdateRequest == request) pendingUpdateRequest = null
        if (!updates.accepts(request)) return@runOnUiThread
        if (result.isSuccess) updates.complete(request, result.getOrNull())
        if (manual) {
          if (result.isFailure || updates.available() == null) {
            Toast.makeText(this, if (result.isFailure) R.string.update_failed else R.string.update_current, Toast.LENGTH_LONG).show()
            return@runOnUiThread
          }
          settingsDialog?.dismiss()
        }
        showAvailableUpdate()
      }
    }
  }

  private fun showAvailableUpdate() {
    if (!resumed || isFinishing || isDestroyed) return
    val build = updates.available() ?: return
    updates.dismissed = true
    updateDialog = AlertDialog.Builder(this)
      .setTitle(R.string.update_available)
      .setMessage(getString(R.string.update_message, build.version, build.commit.take(12)))
      .setPositiveButton(R.string.update_open) { _, _ ->
        try {
          startActivity(Intent(Intent.ACTION_VIEW, build.releaseUrl.toUri()))
        } catch (_: ActivityNotFoundException) {
          Toast.makeText(this, R.string.update_browser_unavailable, Toast.LENGTH_LONG).show()
        }
      }
      .setNegativeButton(android.R.string.cancel, null)
      .setNeutralButton(R.string.update_skip) { _, _ -> updates.skip(build) }
      .show()
  }

  private fun configureActions() {
    openButton.setOnClickListener {
      hideKeyboard()
      openConfiguredWebApp(save = true)
    }
    editButton.setOnClickListener {
      hideError()
      showConfig()
    }
    retryButton.setOnClickListener {
      hideError()
      launchWebView()
    }
    permissionSettingsButton.setOnClickListener {
      startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "package:$packageName".toUri()))
    }

    pageInput.addTextChangedListener {
      pageInput.error = null
      updateApiFromPageUrl()
    }

    apiInput.addTextChangedListener {
      apiInput.error = null
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (!::webView.isInitialized || !webView.isVisible) {
          finish()
          return
        }

        webView.evaluateJavascript(
          "Boolean(window.CollectionTrackerAndroidBack && window.CollectionTrackerAndroidBack())",
        ) { handled ->
          if (handled != "true") {
            runOnUiThread { finish() }
          }
        }
      }
    })
  }

  private fun maybeStartFromSavedConfig() {
    val hasPage = pageInput.text.toString().trim().isNotBlank()
    if (hasPage) {
      updateApiFromPageUrl()
      openConfiguredWebApp(save = false)
    } else {
      showConfig()
    }
  }

  private fun openConfiguredWebApp(save: Boolean) {
    val page = AndroidUrlConfig.normalizeInput(pageInput.text.toString())
    val userApi = AndroidUrlConfig.normalizeInput(apiInput.text.toString())
    val api = userApi.ifBlank { AndroidUrlConfig.deriveApiUrlFromPage(page) }

    if (api != userApi) {
      apiInput.setText(api)
    }

    if (page.isBlank() || api.isBlank()) {
      pageInput.error = if (page.isBlank()) getString(R.string.error_page_url_required) else null
      apiInput.error = if (api.isBlank()) getString(R.string.error_api_url_required) else null
      showConfig()
      return
    }
    pageInput.error = null
    apiInput.error = null

    if (save) {
      val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      prefs.edit {
        putString(PREF_PAGE_URL, page)
        putString(PREF_API_URL, api)
        putBoolean(PREF_TRUST_UNTRUSTED_CERTIFICATES, trustUntrustedCertificatesInput.isChecked)
      }
    }

    pageUrl = page
    apiUrl = api
    showWeb()
    launchWebView()
  }

  @SuppressLint("SetJavaScriptEnabled", "WebViewClientOnReceivedSslError")
  private fun setupWebView() {
    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      setSupportZoom(false)
      builtInZoomControls = false
      displayZoomControls = false
      mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
    }
    val cookieManager = CookieManager.getInstance()
    cookieManager.setAcceptCookie(true)
    cookieManager.setAcceptThirdPartyCookies(webView, true)

    webView.webChromeClient = object : WebChromeClient() {
      override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?,
      ): Boolean {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = filePathCallback

        val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "*/*"
        }

        return try {
          fileChooserLauncher.launch(intent)
          true
        } catch (_: ActivityNotFoundException) {
          fileChooserCallback = null
          filePathCallback?.onReceiveValue(null)
          Toast.makeText(this@MainActivity, getString(R.string.error_file_picker_unavailable), Toast.LENGTH_LONG).show()
          true
        }
      }

      override fun onJsAlert(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult,
      ): Boolean {
        if (isFinishing || isDestroyed) {
          result.cancel()
          return true
        }

        showJsDialog(
          message = message,
          result = result,
          isConfirm = false,
        )
        return true
      }

      override fun onJsConfirm(
        view: WebView?,
        url: String?,
        message: String?,
        result: JsResult,
      ): Boolean {
        if (isFinishing || isDestroyed) {
          result.cancel()
          return true
        }

        showJsDialog(
          message = message,
          result = result,
          isConfirm = true,
        )
        return true
      }
    }

    val downloadHandler = AndroidDownloadHandler(this, webView)
    webView.setDownloadListener(downloadHandler.createDownloadListener())

    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        if (isLikelyCollectionTrackerPage(url)) return false
        startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
        return true
      }

      override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
        if (webView.isVisible) {
          navigation.start(url)
          hideError()
        }
        super.onPageStarted(view, url, favicon)
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)

        if (!navigation.canVerify(url)) return

        if (!isLikelyCollectionTrackerPage(url)) {
          showInvalidPage()
          return
        }

        verifyCollectionTrackerContent(url)
      }

      override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?,
      ) {
        if (request?.isForMainFrame == true) {
          showError()
        }
      }

      override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?,
      ) {
        if (request?.isForMainFrame == true) {
          showError()
        }
      }

      override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        if (trustUntrustedCertificatesInput.isChecked) {
          handler?.proceed()
        } else {
          handler?.cancel()
          showError()
        }
      }
    }

    webView.addJavascriptInterface(CollectionTrackerBridge(this, ::clearStoredConfig, downloadHandler, ::showNativeSettings), "CollectionTrackerInterface")
  }

  private fun injectRuntimeConfig() {
    if (pageUrl.isBlank() || apiUrl.isBlank()) {
      return
    }

    val script = """
      (function() {
        window.COLLECTION_TRACKER_CONFIG = {
          pageUrl: ${JSONObject.quote(pageUrl)},
          apiUrl: ${JSONObject.quote(apiUrl)}
        };
        try {
          localStorage.setItem('${PREFS_API_URL}', ${JSONObject.quote(apiUrl)});
        } catch (_ignored) {}

        if (!URL.__collectionTrackerRevokeObjectUrlPatched) {
          URL.__collectionTrackerRevokeObjectUrlPatched = true;
          var revokeObjectURL = URL.revokeObjectURL.bind(URL);
          URL.revokeObjectURL = function(url) {
            window.setTimeout(function() { revokeObjectURL(url); }, 30000);
          };
        }
      })();
    """.trimIndent()
    webView.evaluateJavascript(script, null)
  }

  private fun verifyCollectionTrackerContent(url: String?) {
    val generation = navigation.generation
    if (!navigation.canVerify(url, generation)) return

    val script = """
      (function() {
        const title = (document.title || "").toLowerCase();
        const hasKnownRoot = !!(
          document.getElementById("collection-tracker-root") ||
          document.querySelector("[data-collection-tracker]") ||
          document.querySelector("ct-root") ||
          document.querySelector("lo-root") ||
          document.querySelector("he-root") ||
          document.querySelector("app-root")
        );
        const bodyText = (document.body ? document.body.innerText || "" : "").toLowerCase();
        const hasTrackerText = /collection tracker/i.test(bodyText) || /collection tracker/i.test(title);
        const path = window.location.pathname || "";
        const hasTrackerRoute = /(^|\/)(collection|client|login|health)(\/|$)/i.test(path);
        return hasKnownRoot || hasTrackerText || hasTrackerRoute;
      })();
    """.trimIndent()

    webView.evaluateJavascript(script) { result ->
      if (isFinishing || isDestroyed || !navigation.canVerify(url, generation)) return@evaluateJavascript
      if (result == "true") {
        injectRuntimeConfig()
        return@evaluateJavascript
      }
      showInvalidPage()
    }
  }

  private fun isLikelyCollectionTrackerPage(url: String?): Boolean {
    return AndroidUrlConfig.isLikelyCollectionTrackerPage(pageUrl, url)
  }

  private fun showInvalidPage() {
    if (isShowingInvalidPage) return
    isShowingInvalidPage = true
    Toast.makeText(this, getString(R.string.error_invalid_collection_tracker_page), Toast.LENGTH_LONG).show()
    webView.stopLoading()
    webView.loadUrl("about:blank")
    showConfig()
  }

  private fun clearStoredConfig() {
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    prefs.edit {
      remove(PREF_PAGE_URL)
      remove(PREF_API_URL)
      remove(PREF_TRUST_UNTRUSTED_CERTIFICATES)
    }

    pageUrl = ""
    apiUrl = ""
    pageInput.setText("")
    apiInput.setText("")
    trustUntrustedCertificatesInput.isChecked = false

    clearWebViewStoredData()
    showConfig()
  }

  private fun clearWebViewStoredData() {
    val cookieManager = CookieManager.getInstance()
    cookieManager.removeAllCookies(null)
    cookieManager.flush()

    WebStorage.getInstance().deleteAllData()

    webView.stopLoading()
    webView.loadUrl("about:blank")
    webView.clearHistory()
    webView.clearFormData()
    webView.clearCache(true)
    webView.clearSslPreferences()
  }

  private fun launchWebView() {
    if (pageUrl.isBlank() || apiUrl.isBlank()) return
    navigation.invalidate()

    // DNS names and separate API hosts may reach the LAN even when the page URL looks public.
    if (Build.VERSION.SDK_INT >= 37 && checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) != PackageManager.PERMISSION_GRANTED) {
      localNetworkPermissionLauncher.launch(Manifest.permission.ACCESS_LOCAL_NETWORK)
      return
    }

    if (!isNetworkAvailable()) {
      showError()
      return
    }

    isShowingInvalidPage = false
    errorContainer.isVisible = false
    configContainer.isVisible = false
    webView.isVisible = true
    findViewById<View>(R.id.nativeSettingsBar).isVisible = false
    webView.loadUrl(pageUrl)
  }

  private fun showError(message: Int = R.string.error_message) {
    findViewById<View>(R.id.nativeSettingsBar).isVisible = false
    navigation.invalidate()
    webView.stopLoading()
    errorMessage.setText(message)
    permissionSettingsButton.isVisible = false
    webView.isVisible = false
    errorContainer.isVisible = true
    configContainer.isVisible = false
  }

  private fun hideError() {
    errorContainer.isVisible = false
  }

  private fun showWeb() {
    findViewById<View>(R.id.nativeSettingsBar).isVisible = false
    configContainer.isVisible = false
    errorContainer.isVisible = false
    webView.isVisible = true
  }

  private fun showConfig() {
    findViewById<View>(R.id.nativeSettingsBar).isVisible = true
    navigation.invalidate()
    webView.stopLoading()
    configContainer.isVisible = true
    webView.isVisible = false
    errorContainer.isVisible = false
  }

  private fun updateApiFromPageUrl() {
    val page = AndroidUrlConfig.normalizeInput(pageInput.text.toString())
    val derivedApi = AndroidUrlConfig.deriveApiUrlFromPage(page)
    if (derivedApi.isBlank()) {
      return
    }

    apiInput.setText(derivedApi)
  }

  private fun isNetworkAvailable(): Boolean {
    val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private fun hideKeyboard() {
    val view = currentFocus ?: webView
    val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
    imm.hideSoftInputFromWindow(view.windowToken, 0)
  }

  private fun showJsDialog(message: String?, result: JsResult, isConfirm: Boolean) {
    val dialogButtonColor = getColor(R.color.dialog_button)
    val dialog = AlertDialog.Builder(this)
      .setMessage(message.orEmpty())
      .setOnCancelListener { result.cancel() }
      .apply {
        if (!isConfirm) {
          setCancelable(false)
        }
        setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
        if (isConfirm) {
          setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
        }
      }
      .show()

    dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(dialogButtonColor)
    dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.setTextColor(dialogButtonColor)
  }
}
