package com.example

import android.content.Context
import android.util.Log
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream
import java.net.URLConnection

/**
 * A hybrid WebViewAssetLoader PathHandler that prioritizes dynamically downloaded
 * web assets in internal storage (context.filesDir/web_active), falling back to
 * APK-bundled assets in context.assets (web/...) if the dynamic bundle does not exist
 * or a specific asset is not found.
 */
class DynamicWebPathHandler(
    context: Context,
    private val activeWebDir: File
) : WebViewAssetLoader.PathHandler {

    private val apkAssetsHandler = WebViewAssetLoader.AssetsPathHandler(context)

    companion object {
        private const val TAG = "DynamicWebPathHandler"
    }

    override fun handle(path: String): WebResourceResponse? {
        // Strip "web/" prefix if present because asset loader maps "/assets/" -> path
        // e.g. /assets/web/index.html -> path is "web/index.html"
        val relativePath = if (path.startsWith("web/")) {
            path.removePrefix("web/")
        } else {
            path
        }

        // 1. Check if dynamic web directory has the requested file
        if (activeWebDir.exists() && activeWebDir.isDirectory) {
            val targetFile = File(activeWebDir, relativePath)
            try {
                val canonicalTarget = targetFile.canonicalPath
                val canonicalActive = activeWebDir.canonicalPath
                // Ensure no path traversal outside activeWebDir
                if (canonicalTarget.startsWith(canonicalActive) && targetFile.exists() && targetFile.isFile) {
                    val mimeType = guessMimeType(targetFile.name)
                    val encoding = if (mimeType.startsWith("text/") || 
                        mimeType.contains("javascript") || 
                        mimeType.contains("json")) "UTF-8" else null

                    val response = WebResourceResponse(mimeType, encoding, FileInputStream(targetFile))
                    val headers = HashMap<String, String>()
                    headers["Access-Control-Allow-Origin"] = "*"
                    headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                    response.responseHeaders = headers
                    return response
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error reading from active web storage: $relativePath", e)
            }
        }

        // 2. Fall back to APK-bundled assets (web/...)
        return apkAssetsHandler.handle(path)
    }

    private fun guessMimeType(fileName: String): String {
        return when {
            fileName.endsWith(".html", ignoreCase = true) || fileName.endsWith(".htm", ignoreCase = true) -> "text/html"
            fileName.endsWith(".js", ignoreCase = true) || fileName.endsWith(".mjs", ignoreCase = true) -> "application/javascript"
            fileName.endsWith(".css", ignoreCase = true) -> "text/css"
            fileName.endsWith(".json", ignoreCase = true) -> "application/json"
            fileName.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
            fileName.endsWith(".png", ignoreCase = true) -> "image/png"
            fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
            fileName.endsWith(".webp", ignoreCase = true) -> "image/webp"
            fileName.endsWith(".ico", ignoreCase = true) -> "image/x-icon"
            fileName.endsWith(".woff2", ignoreCase = true) -> "font/woff2"
            fileName.endsWith(".woff", ignoreCase = true) -> "font/woff"
            fileName.endsWith(".ttf", ignoreCase = true) -> "font/ttf"
            fileName.endsWith(".wasm", ignoreCase = true) -> "application/wasm"
            else -> URLConnection.guessContentTypeFromName(fileName) ?: "application/octet-stream"
        }
    }
}
