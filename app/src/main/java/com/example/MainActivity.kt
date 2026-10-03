package com.example

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import com.example.ui.theme.MyApplicationTheme

/**
 * Minimal native Android WebView wrapper for Simple Lists.
 * 
 * Responsibilities:
 * - Creates and configures a secure WebView sandbox
 * - Loads the offline bundled Vue 3 PWA via WebViewAssetLoader (with dynamic OTA support)
 * - Handles Android lifecycle and back navigation
 * - Prevents arbitrary navigation outside the app
 * - Zero application/business logic implemented here
 */
class MainActivity : ComponentActivity() {

  private var webView: WebView? = null
  private val bundleManager by lazy { WebBundleManager(applicationContext) }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

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
            }
          )
        }
      }
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

          // Disable unnecessary file and content access capabilities
          allowFileAccess = false
          allowContentAccess = false
          
          // Performance & caching
          cacheMode = WebSettings.LOAD_DEFAULT
          setSupportMultipleWindows(false)
          mediaPlaybackRequiresUserGesture = false
        }

        webChromeClient = object : WebChromeClient() {
          override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
            android.util.Log.d(
              "SimpleListsWebView",
              "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}"
            )
            return true
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
