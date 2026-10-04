package com.example

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.example.ui.theme.MyApplicationTheme
import org.json.JSONObject

/**
 * Minimal native Android WebView wrapper for Simple Lists.
 * 
 * Responsibilities:
 * - Creates and configures a secure WebView sandbox
 * - Loads the offline bundled Vue 3 PWA via WebViewAssetLoader (with dynamic OTA support)
 * - Exposes native bridge APIs for notifications, deadline reminders, and file attachments
 * - Handles Android file chooser requests (<input type="file">)
 * - Handles Android lifecycle, back navigation, and notification intents
 * - Prevents arbitrary navigation outside the app
 */
class MainActivity : ComponentActivity() {

  private var webView: WebView? = null
  private val bundleManager by lazy { WebBundleManager(applicationContext) }
  private var pendingNotificationIntent: Intent? = null

  // File Chooser state for <input type="file"> support in WebView
  var filePathCallback: ValueCallback<Array<Uri>>? = null

  val fileChooserLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult()
  ) { result ->
    val cb = filePathCallback
    filePathCallback = null
    if (cb == null) return@registerForActivityResult

    if (result.resultCode == Activity.RESULT_OK && result.data != null) {
      val data = result.data
      val clipData = data?.clipData
      val uris = when {
        clipData != null -> {
          (0 until clipData.itemCount).map { clipData.getItemAt(it).uri }.toTypedArray()
        }
        data?.data != null -> arrayOf(data.data!!)
        else -> null
      }
      cb.onReceiveValue(uris)
    } else {
      cb.onReceiveValue(null)
    }
  }

  // Runtime permissions launcher for notifications & media
  val permissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { results ->
    Log.d("MainActivity", "Permissions result: $results")
    val wv = webView ?: return@registerForActivityResult
    wv.post {
      val json = JSONObject()
      results.forEach { (perm, granted) -> json.put(perm, granted) }
      wv.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('permissions-updated', { detail: $json }));",
        null
      )
    }
  }

  fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
    }
  }

  fun requestMediaPermission() {
    val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_AUDIO
      )
    } else {
      arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    }
    permissionLauncher.launch(permissions)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Initialize notification channels
    NotificationHelper.createNotificationChannel(applicationContext)
    pendingNotificationIntent = intent

    // Handle Android system back button
    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          val wv = webView
          if (wv != null) {
            // Inform web app so it can close open modals/drawers first
            wv.evaluateJavascript(
              "window.dispatchEvent(new CustomEvent('android-back'));",
              null
            )
            if (wv.canGoBack()) {
              wv.goBack()
            } else {
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
            }
          } else {
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
          }
        }
      }
    )

    setContent {
      MyApplicationTheme {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFEF7FF))
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
        ) {
          SimpleListsWebView(
            activity = this@MainActivity,
            bundleManager = bundleManager,
            onWebViewCreated = { wv ->
              webView = wv
              // Check for OTA web updates in background and notify the WebView if ready
              bundleManager.checkForUpdate(lifecycleScope) { newVersion ->
                wv.post {
                  wv.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('web-update-ready', { detail: { version: $newVersion } }));",
                    null
                  )
                }
              }

              // Dispatch any pending notification click from cold start
              pendingNotificationIntent?.let {
                handleNotificationIntent(it)
                pendingNotificationIntent = null
              }
            }
          )
        }
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleNotificationIntent(intent)
  }

  private fun handleNotificationIntent(intent: Intent?) {
    val payload = intent?.getStringExtra("notification_payload") ?: return
    val id = intent.getIntExtra("notification_id", 0)
    val wv = webView ?: return
    wv.post {
      val escaped = JSONObject.quote(payload)
      wv.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('notification-clicked', { detail: { id: $id, payload: $escaped } }));",
        null
      )
    }
  }

  override fun onResume() {
    super.onResume()
    webView?.onResume()
    // Periodic check on resume (throttled by bundleManager to at most once per 5 minutes)
    bundleManager.checkForUpdate(lifecycleScope) { newVersion ->
      webView?.post {
        webView?.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('web-update-ready', { detail: { version: $newVersion } }));",
          null
        )
      }
    }
  }

  override fun onPause() {
    super.onPause()
    webView?.onPause()
  }

  override fun onDestroy() {
    webView?.let { wv ->
      wv.stopLoading()
      wv.destroy()
    }
    webView = null
    super.onDestroy()
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun SimpleListsWebView(
  modifier: Modifier = Modifier,
  activity: MainActivity,
  bundleManager: WebBundleManager,
  onWebViewCreated: (WebView) -> Unit
) {
  val context = LocalContext.current

  // Dynamic asset loader mapping https://appassets.androidplatform.net/assets/
  // Prioritizes dynamically downloaded bundles in internal storage with APK asset fallback
  val assetLoader = remember {
    val dynamicHandler = DynamicWebPathHandler(context, bundleManager.activeWebDir)
    WebViewAssetLoader.Builder()
      .setDomain("appassets.androidplatform.net")
      .addPathHandler("/assets/", dynamicHandler)
      .build()
  }

  AndroidView(
    modifier = modifier.fillMaxSize(),
    factory = { ctx ->
      WebView(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(android.graphics.Color.parseColor("#FEF7FF"))

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          
          // Identify app to the frontend for PWA / Service Worker handling
          userAgentString = "$userAgentString SimpleListsApp"

          // Allow content access for file picking and attachments
          allowFileAccess = false
          allowContentAccess = true
          
          // Performance & caching
          cacheMode = WebSettings.LOAD_DEFAULT
          setSupportMultipleWindows(false)
          mediaPlaybackRequiresUserGesture = false
        }

        // Bridge native APIs for notifications, reminders, file access, and attachments
        addJavascriptInterface(AndroidBridge(activity, this), "AndroidBridge")
        addJavascriptInterface(AndroidBridge(activity, this), "Android")

        webChromeClient = object : WebChromeClient() {
          override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
            android.util.Log.d(
              "SimpleListsWebView",
              "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}"
            )
            return true
          }

          override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?
          ): Boolean {
            activity.filePathCallback?.onReceiveValue(null)
            activity.filePathCallback = filePathCallback

            return try {
              val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
              }
              activity.fileChooserLauncher.launch(intent)
              true
            } catch (e: Exception) {
              android.util.Log.e("SimpleListsWebView", "Failed to launch file chooser", e)
              activity.filePathCallback?.onReceiveValue(null)
              activity.filePathCallback = null
              false
            }
          }
        }

        webViewClient = object : WebViewClient() {
          override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
          ): WebResourceResponse? {
            val url = request.url
            if (url.host == "appassets.androidplatform.net" && url.path == "/favicon.ico") {
              return WebResourceResponse(
                "image/x-icon",
                "UTF-8",
                java.io.ByteArrayInputStream(ByteArray(0))
              )
            }
            return assetLoader.shouldInterceptRequest(url)
          }

          override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: android.webkit.WebResourceError?
          ) {
            val urlStr = request?.url?.toString() ?: ""
            if (urlStr.endsWith("/favicon.ico")) {
              return
            }
            android.util.Log.e(
              "SimpleListsWebView",
              "WebResourceError: ${error?.description} for ${request?.url}"
            )
            super.onReceivedError(view, request, error)
          }

          override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest
          ): Boolean {
            val url = request.url.toString()
            // Allow app assets to load within WebView
            if (url.startsWith("https://appassets.androidplatform.net/")) {
              return false
            }
            // Open external URLs in the user's browser
            try {
              val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
              ctx.startActivity(intent)
            } catch (e: Exception) {
              // Ignore invalid intents
            }
            return true
          }
        }

        // Load the bundled Vue 3 PWA from assets
        loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        onWebViewCreated(this)
      }
    }
  )
}
