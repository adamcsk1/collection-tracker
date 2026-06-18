package com.collectiontracker.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Uri
import android.net.NetworkCapabilities
import android.net.http.SslError
import android.os.Bundle
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
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast
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
  private lateinit var pageInput: EditText
  private lateinit var apiInput: EditText
  private lateinit var trustUntrustedCertificatesInput: CheckBox
  private lateinit var openButton: Button
  private lateinit var editButton: Button
  private lateinit var retryButton: Button
  private lateinit var configContainer: ScrollView
  private lateinit var errorContainer: LinearLayout
  private lateinit var webView: WebView

  private var pageUrl: String = ""
  private var apiUrl: String = ""
  private var isShowingInvalidPage = false
  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

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
        hideError()
        super.onPageStarted(view, url, favicon)
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)

        if (url.isNullOrBlank() || url == "about:blank") return

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

    webView.addJavascriptInterface(CollectionTrackerBridge(this, ::clearStoredConfig, downloadHandler), "CollectionTrackerInterface")
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
    if (url.isNullOrBlank()) return

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

    if (!isNetworkAvailable()) {
      showError()
      return
    }

    isShowingInvalidPage = false
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
