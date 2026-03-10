package com.collectiontracker.app

import android.annotation.SuppressLint
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.view.inputmethod.InputMethodManager
import androidx.core.widget.addTextChangedListener
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import org.json.JSONObject
import androidx.core.content.edit
import androidx.core.net.toUri

private const val PREFS_NAME = "collection_tracker_prefs"
private const val PREF_PAGE_URL = "page_url"
private const val PREF_API_URL = "api_url"
private const val PREFS_API_URL = "CT.ApiUrl"

class MainActivity : AppCompatActivity() {
  private lateinit var pageInput: EditText
  private lateinit var apiInput: EditText
  private lateinit var openButton: Button
  private lateinit var editButton: Button
  private lateinit var retryButton: Button
  private lateinit var configContainer: ScrollView
  private lateinit var errorContainer: LinearLayout
  private lateinit var webView: WebView

  private var pageUrl: String = ""
  private var apiUrl: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    pageInput = findViewById(R.id.pageUrlInput)
    apiInput = findViewById(R.id.apiUrlInput)
    openButton = findViewById(R.id.openButton)
    editButton = findViewById(R.id.editButton)
    retryButton = findViewById(R.id.retryButton)
    configContainer = findViewById(R.id.configContainer)
    errorContainer = findViewById(R.id.errorContainer)
    webView = findViewById(R.id.webView)

    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    pageInput.setText(prefs.getString(PREF_PAGE_URL, ""))
    apiInput.setText(prefs.getString(PREF_API_URL, ""))
    updateApiFromPageUrl()

    setupWebView()
    configureActions()
    maybeStartFromSavedConfig()
  }

  override fun onPause() {
    super.onPause()
    CookieManager.getInstance().flush()
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

    pageInput.addTextChangedListener {
      pageInput.error = null
      updateApiFromPageUrl()
    }

    apiInput.addTextChangedListener {
      apiInput.error = null
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
          webView.goBack()
        } else {
          finish()
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
    val page = normalizeInput(pageInput.text.toString())
    val userApi = normalizeInput(apiInput.text.toString())
    val api = userApi.ifBlank { deriveApiUrlFromPage(page) }

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
      prefs.edit {putString(PREF_PAGE_URL, page).putString(PREF_API_URL, api) }
    }

    pageUrl = page
    apiUrl = api
    showWeb()
    launchWebView()
  }

  @SuppressLint("SetJavaScriptEnabled")
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

    webView.webViewClient = object : WebViewClient() {
      override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
        hideError()
        super.onPageStarted(view, url, favicon)
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)

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
    }

    webView.addJavascriptInterface(ConfigBridge(), "CollectionTrackerInterface")
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
      })();
    """.trimIndent()
    webView.evaluateJavascript(script, null)
  }

  private fun verifyCollectionTrackerContent(url: String?) {
    if (url.isNullOrBlank()) return

    val script = """
      (function() {
        const title = (document.title || "").toLowerCase();
        const hasKnownRoot = !!(
          document.getElementById("collection-tracker-root") ||
          document.querySelector("[data-collection-tracker]") ||
          document.querySelector("ct-root") ||
          document.querySelector("app-root")
        );
        const bodyText = (document.body ? document.body.innerText || "" : "").toLowerCase();
        const hasTrackerText = /collection tracker/i.test(bodyText) || /collection tracker/i.test(title);
        const path = window.location.pathname || "";
        const hasTrackerRoute = /(^|\/)(collection|client)(\/|$)/i.test(path);
        return hasKnownRoot || hasTrackerText || hasTrackerRoute;
      })();
    """.trimIndent()

    webView.evaluateJavascript(script) { result ->
      if (result == "true") {
        injectRuntimeConfig()
        return@evaluateJavascript
      }
      runOnUiThread {
        showInvalidPage()
      }
    }
  }

  private fun isLikelyCollectionTrackerPage(url: String?): Boolean {
    if (url.isNullOrBlank() || pageUrl.isBlank()) return false

    val configured = pageUrl.toUri()
    val loaded = url.toUri()
    val configuredPort = configured.port
    val loadedPort = loaded.port

    if (configured.scheme?.isNotBlank() == true && loaded.scheme != configured.scheme) {
      return false
    }

    if (configured.host?.isNotBlank() == true && loaded.host != configured.host) {
      return false
    }

    if (configuredPort != -1 && loadedPort != -1 && configuredPort != loadedPort) {
      return false
    }

    return true
  }

  private fun showInvalidPage() {
    pageInput.error = getString(R.string.error_invalid_collection_tracker_page)
    webView.stopLoading()
    webView.loadUrl("about:blank")
    showConfig()
  }

  private fun clearStoredConfig() {
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    prefs.edit {
      remove(PREF_PAGE_URL)
      remove(PREF_API_URL)
    }

    pageUrl = ""
    apiUrl = ""
    pageInput.setText("")
    apiInput.setText("")
    webView.stopLoading()
    webView.loadUrl("about:blank")
    webView.clearHistory()
    webView.clearCache(true)
    showConfig()
    webView.evaluateJavascript("localStorage.removeItem('${PREFS_API_URL}');", null)
  }

  private fun launchWebView() {
    if (pageUrl.isBlank() || apiUrl.isBlank()) return

    if (!isNetworkAvailable()) {
      showError()
      return
    }

    errorContainer.isVisible = false
    configContainer.isVisible = false
    webView.isVisible = true
    webView.loadUrl(pageUrl)
  }

  private fun showError() {
    webView.isVisible = false
    errorContainer.isVisible = true
    configContainer.isVisible = false
  }

  private fun hideError() {
    errorContainer.isVisible = false
  }

  private fun showWeb() {
    configContainer.isVisible = false
    errorContainer.isVisible = false
    webView.isVisible = true
  }

  private fun showConfig() {
    configContainer.isVisible = true
    webView.isVisible = false
    errorContainer.isVisible = false
  }

  private fun normalizeInput(input: String): String {
    var cleaned = input.trim()
    if (cleaned.isBlank()) return cleaned
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      cleaned = "https://$cleaned"
    }
    return cleaned
  }

  private fun updateApiFromPageUrl() {
    val page = normalizeInput(pageInput.text.toString())
    val derivedApi = deriveApiUrlFromPage(page)
    if (derivedApi.isBlank()) {
      return
    }

    apiInput.setText(derivedApi)
  }

  private fun deriveApiUrlFromPage(inputPageUrl: String): String {
    val trimmed = normalizeInput(inputPageUrl).trimEnd('/')
    if (trimmed.isBlank()) return ""
    return if (trimmed.endsWith("/api/v1")) trimmed else "$trimmed/api/v1"
  }

  private fun isNetworkAvailable(): Boolean {
    val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private inner class ConfigBridge {
    @Suppress("unused")
    @JavascriptInterface
    fun resetAppConfig(): Boolean {
      runOnUiThread { clearStoredConfig() }
      return true
    }
  }

  private fun hideKeyboard() {
    val view = currentFocus ?: webView
    val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
    imm.hideSoftInputFromWindow(view.windowToken, 0)
  }
}
