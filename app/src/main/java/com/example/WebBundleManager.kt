package com.example

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

/**
 * Manages OTA (Over-The-Air) updates for the web bundle.
 * 
 * Responsibilities:
 * - Checks remote version.json on launch or background
 * - Downloads web-dist.zip to staging
 * - Validates package integrity (Zip Slip protection & index.html verification)
 * - Atomically replaces active web directory
 * - Maintains version tracking in SharedPreferences
 */
class WebBundleManager(context: Context) {

    private val appContext = context.applicationContext

    companion object {
        private const val TAG = "WebBundleManager"
        private const val PREFS_NAME = "web_bundle_prefs"
        private const val KEY_CURRENT_VERSION = "current_web_version"
        private const val KEY_LAST_CHECK_TIMESTAMP = "last_check_timestamp"

        // Default GitHub Pages endpoint where version.json and web-dist.zip are published
        const val DEFAULT_VERSION_URL = "https://wurzelkuchen.github.io/SimpleLists/version.json"

        // Minimum time interval between update checks (5 minutes)
        private const val MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000L
    }

    val activeWebDir: File = File(appContext.filesDir, "web_active")
    private val stagingWebDir: File = File(appContext.filesDir, "web_staging")
    private val backupWebDir: File = File(appContext.filesDir, "web_backup")
    private val tempZipFile: File = File(appContext.cacheDir, "web_update.zip")

    private val prefs: SharedPreferences =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var currentVersion: Long
        get() {
            return try {
                prefs.getLong(KEY_CURRENT_VERSION, 0L)
            } catch (e: ClassCastException) {
                // Recover and migrate if previously stored as Int
                val oldInt = prefs.getInt(KEY_CURRENT_VERSION, 0).toLong()
                prefs.edit().putLong(KEY_CURRENT_VERSION, oldInt).apply()
                oldInt
            }
        }
        set(value) = prefs.edit().putLong(KEY_CURRENT_VERSION, value).apply()

    init {
        // Automatically sync with APK-bundled baseline if APK was upgraded
        val baseline = readBundledBaselineVersion()
        if (currentVersion < baseline) {
            Log.i(TAG, "Bundled baseline v$baseline is newer than stored v$currentVersion. Resetting to bundled assets.")
            currentVersion = baseline
            deleteDirectory(activeWebDir)
        }
    }

    private fun readBundledBaselineVersion(): Long {
        return try {
            appContext.assets.open("web/version.json").use { stream ->
                val jsonStr = stream.bufferedReader().use { it.readText() }
                JSONObject(jsonStr).optLong("version", 1L)
            }
        } catch (e: Exception) {
            1L
        }
    }

    /**
     * Checks for updates asynchronously in background.
     * @param scope CoroutineScope to launch the network and disk I/O operations
     * @param force If true, ignores the throttle window and forces an immediate check
     * @param onUpdateInstalled Called on the Main thread when a newer bundle has been unpacked and activated
     */
    fun checkForUpdate(
        scope: CoroutineScope,
        force: Boolean = false,
        onUpdateInstalled: ((newVersion: Long) -> Unit)? = null
    ) {
        val now = System.currentTimeMillis()
        val lastCheck = prefs.getLong(KEY_LAST_CHECK_TIMESTAMP, 0L)
        if (!force && (now - lastCheck) < MIN_CHECK_INTERVAL_MS) {
            Log.d(TAG, "Skipping update check; checked within the last 5 minutes.")
            return
        }

        scope.launch(Dispatchers.IO) {
            prefs.edit().putLong(KEY_LAST_CHECK_TIMESTAMP, now).apply()
            try {
                // Bust CDN edge cache (GitHub Pages / Fastly caches version.json for 10 minutes)
                val checkUrl = if (DEFAULT_VERSION_URL.contains("?")) {
                    "$DEFAULT_VERSION_URL&t=$now"
                } else {
                    "$DEFAULT_VERSION_URL?t=$now"
                }
                Log.d(TAG, "Checking for web updates at: $checkUrl")
                val updateInfo = fetchRemoteVersionInfo(checkUrl) ?: return@launch
                val remoteVersion = updateInfo.optLong("version", 0L)
                val zipUrl = updateInfo.optString("zipUrl", "")

                Log.d(TAG, "Current local version: $currentVersion, Remote version: $remoteVersion")

                if (remoteVersion > currentVersion && zipUrl.isNotEmpty()) {
                    Log.i(TAG, "New web update detected: v$remoteVersion > v$currentVersion. Downloading from $zipUrl...")

                    val downloadSuccess = downloadZip(zipUrl, tempZipFile)
                    if (!downloadSuccess) {
                        Log.e(TAG, "Failed to download update ZIP.")
                        return@launch
                    }

                    val unpackSuccess = unpackAndValidate(tempZipFile, stagingWebDir)
                    tempZipFile.delete()

                    if (!unpackSuccess) {
                        Log.e(TAG, "Failed to unpack or validate update bundle.")
                        deleteDirectory(stagingWebDir)
                        return@launch
                    }

                    // Apply update by swapping directories
                    val applied = applyStagingBundle()
                    if (applied) {
                        currentVersion = remoteVersion
                        Log.i(TAG, "Web bundle updated successfully to v$remoteVersion")
                        withContext(Dispatchers.Main) {
                            onUpdateInstalled?.invoke(remoteVersion)
                        }
                    } else {
                        Log.e(TAG, "Failed to apply staging bundle to active storage.")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error during web bundle update check", e)
            }
        }
    }

    private fun fetchRemoteVersionInfo(urlStr: String): JSONObject? {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 7000
            connection.readTimeout = 7000
            connection.useCaches = false
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", "SimpleListsApp-Android")
            connection.setRequestProperty("Cache-Control", "no-cache, no-store")
            connection.setRequestProperty("Pragma", "no-cache")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                val jsonStr = connection.inputStream.bufferedReader().use { it.readText() }
                JSONObject(jsonStr)
            } else {
                Log.w(TAG, "Version check returned HTTP ${connection.responseCode}")
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch version info: ${e.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun downloadZip(urlStr: String, destinationFile: File): Boolean {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 20000
            connection.useCaches = false
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", "SimpleListsApp-Android")

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                BufferedInputStream(connection.inputStream).use { input ->
                    FileOutputStream(destinationFile).use { output ->
                        input.copyTo(output)
                    }
                }
                true
            } else {
                Log.w(TAG, "Download zip returned HTTP ${connection.responseCode}")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Download zip failed: ${e.message}", e)
            false
        } finally {
            connection?.disconnect()
        }
    }

    private fun unpackAndValidate(zipFile: File, destDir: File): Boolean {
        deleteDirectory(destDir)
        destDir.mkdirs()

        try {
            val destCanonical = destDir.canonicalPath
            ZipInputStream(FileInputStream(zipFile)).use { zis ->
                var entry: ZipEntry? = zis.nextEntry
                while (entry != null) {
                    val entryFile = File(destDir, entry.name)
                    val entryCanonical = entryFile.canonicalPath

                    // Zip Slip security verification
                    if (!entryCanonical.startsWith(destCanonical)) {
                        Log.e(TAG, "Zip Slip vulnerability detected in entry: ${entry.name}")
                        return false
                    }

                    if (entry.isDirectory) {
                        entryFile.mkdirs()
                    } else {
                        entryFile.parentFile?.mkdirs()
                        FileOutputStream(entryFile).use { fos ->
                            zis.copyTo(fos)
                        }
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            // Verify essential web entrypoint exists
            val indexFile = File(destDir, "index.html")
            if (!indexFile.exists() || indexFile.length() == 0L) {
                Log.e(TAG, "Bundle validation failed: index.html is missing or empty")
                return false
            }

            return true
        } catch (e: Exception) {
            Log.e(TAG, "Unpacking zip failed: ${e.message}", e)
            return false
        }
    }

    private fun applyStagingBundle(): Boolean {
        return try {
            deleteDirectory(backupWebDir)

            if (activeWebDir.exists()) {
                if (!activeWebDir.renameTo(backupWebDir)) {
                    Log.e(TAG, "Could not move activeWebDir to backup")
                    return false
                }
            }

            if (!stagingWebDir.renameTo(activeWebDir)) {
                Log.e(TAG, "Could not move stagingWebDir to activeWebDir; restoring backup")
                backupWebDir.renameTo(activeWebDir)
                return false
            }

            deleteDirectory(backupWebDir)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error applying staging bundle", e)
            if (backupWebDir.exists() && !activeWebDir.exists()) {
                backupWebDir.renameTo(activeWebDir)
            }
            false
        }
    }

    private fun deleteDirectory(dir: File): Boolean {
        if (dir.exists()) {
            dir.listFiles()?.forEach { file ->
                if (file.isDirectory) {
                    deleteDirectory(file)
                } else {
                    file.delete()
                }
            }
            return dir.delete()
        }
        return true
    }
}
