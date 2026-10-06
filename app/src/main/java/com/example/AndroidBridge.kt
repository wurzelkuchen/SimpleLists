package com.example

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * JavaScript interface exposed to the WebView as `window.AndroidBridge` (and `window.Android`).
 * Provides native bridge capabilities for notifications, scheduled reminders, file storage,
 * and attachment handling.
 */
class AndroidBridge(
    private val activity: MainActivity,
    private val webView: WebView
) {
    companion object {
        private const val TAG = "AndroidBridge"
    }

    private val context: Context get() = activity.applicationContext
    private val attachmentsDir: File get() = File(context.filesDir, "attachments").apply { mkdirs() }

    // ==========================================
    // NOTIFICATION & REMINDER APIS
    // ==========================================

    @JavascriptInterface
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        activity.runOnUiThread {
            activity.requestNotificationPermission()
        }
    }

    @JavascriptInterface
    fun postNotification(id: Int, title: String, message: String, payload: String? = null) {
        NotificationHelper.showNotification(context, id, title, message, payload)
    }

    @JavascriptInterface
    fun scheduleNotification(
        id: Int,
        title: String,
        message: String,
        triggerAtMillis: Long,
        payload: String? = null
    ) {
        NotificationHelper.scheduleNotification(context, id, title, message, triggerAtMillis, payload)
    }

    @JavascriptInterface
    fun scheduleNotification(
        id: Int,
        title: String,
        message: String,
        triggerAtMillis: Double,
        payload: String? = null
    ) {
        NotificationHelper.scheduleNotification(context, id, title, message, triggerAtMillis.toLong(), payload)
    }

    @JavascriptInterface
    fun cancelNotification(id: Int) {
        NotificationHelper.cancelNotification(context, id)
    }

    // ==========================================
    // FILES, MEDIA & ATTACHMENT APIS
    // ==========================================

    @JavascriptInterface
    fun hasMediaPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    @JavascriptInterface
    fun requestMediaPermission() {
        activity.runOnUiThread {
            activity.requestMediaPermission()
        }
    }

    @JavascriptInterface
    fun saveAttachment(fileName: String, base64Data: String): String {
        return try {
            val safeName = File(fileName).name
            val targetFile = File(attachmentsDir, safeName)
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }
            val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            FileOutputStream(targetFile).use { it.write(bytes) }
            Log.d(TAG, "Saved attachment: ${targetFile.absolutePath} (${bytes.size} bytes)")
            targetFile.name
        } catch (e: Exception) {
            Log.e(TAG, "Error saving attachment $fileName: ${e.message}", e)
            ""
        }
    }

    @JavascriptInterface
    fun readAttachmentBase64(fileName: String): String? {
        return try {
            val safeName = File(fileName).name
            val targetFile = File(attachmentsDir, safeName)
            if (!targetFile.exists() || !targetFile.isFile) return null
            val bytes = targetFile.readBytes()
            Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading attachment $fileName: ${e.message}", e)
            null
        }
    }

    @JavascriptInterface
    fun deleteAttachment(fileName: String): Boolean {
        return try {
            val safeName = File(fileName).name
            val targetFile = File(attachmentsDir, safeName)
            if (targetFile.exists()) targetFile.delete() else true
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting attachment $fileName: ${e.message}", e)
            false
        }
    }

    @JavascriptInterface
    fun listAttachments(): String {
        val array = JSONArray()
        try {
            attachmentsDir.listFiles()?.forEach { file ->
                if (file.isFile) {
                    val obj = JSONObject().apply {
                        put("name", file.name)
                        put("size", file.length())
                        put("lastModified", file.lastModified())
                    }
                    array.put(obj)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error listing attachments: ${e.message}", e)
        }
        return array.toString()
    }

    @JavascriptInterface
    fun shareText(title: String, text: String) {
        activity.runOnUiThread {
            try {
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                activity.startActivity(Intent.createChooser(intent, title))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to share text: ${e.message}")
            }
        }
    }

    @JavascriptInterface
    fun shareAttachment(fileName: String) {
        activity.runOnUiThread {
            try {
                val safeName = File(fileName).name
                val targetFile = File(attachmentsDir, safeName)
                if (!targetFile.exists()) {
                    Log.e(TAG, "Attachment does not exist: $safeName")
                    return@runOnUiThread
                }

                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    targetFile
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "*/*"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                activity.startActivity(Intent.createChooser(intent, "Share Attachment"))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to share attachment: ${e.message}", e)
            }
        }
    }

    // ==========================================
    // OTA UPDATE & VERSION APIS
    // ==========================================

    @JavascriptInterface
    fun checkForUpdate(force: Boolean = true) {
        activity.runOnUiThread {
            activity.triggerUpdateCheck(force)
        }
    }

    @JavascriptInterface
    fun reloadApp() {
        activity.runOnUiThread {
            activity.reloadWebView()
        }
    }

    @JavascriptInterface
    fun getStoredWebVersion(): Long {
        return activity.bundleManager.currentVersion
    }

    @JavascriptInterface
    fun isNativeApp(): Boolean = true
}
