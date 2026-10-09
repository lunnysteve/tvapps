package com.example.tvdashboard

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

data class ReleaseInfo(
    val tagName: String,
    val name: String,
    val body: String,
    val apkDownloadUrl: String,
    val apkFileName: String,
    val apkSize: Long
)

object GitHubUpdateManager {

    private const val TAG = "GitHubUpdateManager"
    const val DEFAULT_REPO_OWNER = "lunnysteve"
    const val DEFAULT_REPO_NAME = "tvapps"

    private val mainHandler = Handler(Looper.getMainLooper())

    fun checkForUpdate(
        context: Context,
        owner: String = DEFAULT_REPO_OWNER,
        repo: String = DEFAULT_REPO_NAME,
        token: String? = null,
        onResult: (ReleaseInfo?) -> Unit,
        onError: (String) -> Unit
    ) {
        Thread {
            try {
                val apiUrl = "https://api.github.com/repos/$owner/$repo/releases/latest"
                Log.d(TAG, "Checking for update at: $apiUrl")
                val url = URL(apiUrl)
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/vnd.github.v3+json")
                    setRequestProperty("User-Agent", "TvDashboard-FireStick/${BuildConfig.VERSION_NAME}")
                    if (!token.isNullOrBlank()) {
                        setRequestProperty("Authorization", "Bearer $token")
                    }
                }

                val responseCode = conn.responseCode
                if (responseCode == 404) {
                    mainHandler.post { onError("No releases found on GitHub ($owner/$repo).") }
                    return@Thread
                }
                if (responseCode !in 200..299) {
                    mainHandler.post { onError("GitHub API error HTTP $responseCode") }
                    return@Thread
                }

                val jsonStr = conn.inputStream.bufferedReader().use { it.readText() }
                val root = JSONObject(jsonStr)

                val tagName = root.optString("tag_name", "").trim()
                val releaseName = root.optString("name", tagName)
                val body = root.optString("body", "")

                val assets = root.optJSONArray("assets")
                var apkUrl: String? = null
                var apkName: String? = null
                var apkSize: Long = 0

                if (assets != null) {
                    for (i in 0 until assets.length()) {
                        val asset = assets.getJSONObject(i)
                        val name = asset.optString("name", "")
                        if (name.endsWith(".apk", ignoreCase = true)) {
                            apkUrl = asset.optString("browser_download_url")
                            apkName = name
                            apkSize = asset.optLong("size", 0)
                            break
                        }
                    }
                }

                if (apkUrl.isNullOrBlank()) {
                    mainHandler.post { onResult(null) }
                    return@Thread
                }

                val isNewer = isVersionNewer(tagName, BuildConfig.VERSION_NAME)
                Log.i(TAG, "Latest GitHub tag: $tagName (current: v${BuildConfig.VERSION_NAME}). Newer: $isNewer")

                if (isNewer) {
                    val info = ReleaseInfo(
                        tagName = tagName,
                        name = releaseName,
                        body = body,
                        apkDownloadUrl = apkUrl,
                        apkFileName = apkName ?: "update.apk",
                        apkSize = apkSize
                    )
                    mainHandler.post { onResult(info) }
                } else {
                    mainHandler.post { onResult(null) }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Update check failed: ${e.message}", e)
                mainHandler.post { onError(e.message ?: "Failed to check for updates") }
            }
        }.start()
    }

    fun downloadAndInstall(
        activity: Activity,
        releaseInfo: ReleaseInfo,
        token: String? = null,
        onProgress: (Int) -> Unit,
        onDownloaded: () -> Unit,
        onError: (String) -> Unit
    ) {
        Thread {
            try {
                val updatesDir = File(activity.cacheDir, "updates").apply { mkdirs() }
                val targetFile = File(updatesDir, "ArchitainmentDashboards-FireStick.apk")
                if (targetFile.exists()) {
                    targetFile.delete()
                }

                Log.i(TAG, "Downloading APK from: ${releaseInfo.apkDownloadUrl}")
                var currentUrl = releaseInfo.apkDownloadUrl
                var conn: HttpURLConnection
                var redirects = 0

                // Follow GitHub redirect to AWS S3/Azure CDN
                while (true) {
                    val url = URL(currentUrl)
                    conn = url.openConnection() as HttpURLConnection
                    conn.instanceFollowRedirects = true
                    conn.connectTimeout = 15000
                    conn.readTimeout = 30000
                    conn.setRequestProperty("User-Agent", "TvDashboard-FireStick/${BuildConfig.VERSION_NAME}")
                    if (!token.isNullOrBlank() && currentUrl.contains("api.github.com")) {
                        conn.setRequestProperty("Authorization", "Bearer $token")
                        conn.setRequestProperty("Accept", "application/octet-stream")
                    }

                    val code = conn.responseCode
                    if (code in 300..399) {
                        val newLocation = conn.getHeaderField("Location")
                        if (!newLocation.isNullOrBlank()) {
                            currentUrl = newLocation
                            redirects++
                            if (redirects > 5) throw Exception("Too many redirects")
                            continue
                        }
                    }
                    if (code !in 200..299) {
                        throw Exception("Download failed with HTTP $code")
                    }
                    break
                }

                val totalLength = conn.contentLength.let { if (it > 0) it.toLong() else releaseInfo.apkSize }
                var downloaded: Long = 0

                conn.inputStream.use { input: InputStream ->
                    FileOutputStream(targetFile).use { output: FileOutputStream ->
                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        var lastReportedPercent = -1

                        while (input.read(buffer).also { bytesRead = it } != -1) {
                            output.write(buffer, 0, bytesRead)
                            downloaded += bytesRead
                            if (totalLength > 0) {
                                val percent = ((downloaded * 100) / totalLength).toInt()
                                if (percent != lastReportedPercent) {
                                    lastReportedPercent = percent
                                    mainHandler.post { onProgress(percent) }
                                }
                            }
                        }
                        output.flush()
                    }
                }

                Log.i(TAG, "APK download complete (${targetFile.length()} bytes). Launching package installer...")
                mainHandler.post {
                    onDownloaded()
                    launchPackageInstaller(activity, targetFile)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Download failed: ${e.message}", e)
                mainHandler.post { onError(e.message ?: "Download failed") }
            }
        }.start()
    }

    private fun launchPackageInstaller(activity: Activity, apkFile: File) {
        try {
            val authority = "${activity.packageName}.fileprovider"
            val apkUri: Uri = FileProvider.getUriForFile(activity, authority, apkFile)

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            activity.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch installer intent: ${e.message}", e)
        }
    }

    private fun isVersionNewer(remoteTag: String, currentVersion: String): Boolean {
        val cleanRemote = remoteTag.trim().removePrefix("v").removePrefix("V")
        val cleanCurrent = currentVersion.trim().removePrefix("v").removePrefix("V")

        if (cleanRemote == cleanCurrent) return false

        val remoteParts = cleanRemote.split(".", "-").mapNotNull { it.toIntOrNull() }
        val currentParts = cleanCurrent.split(".", "-").mapNotNull { it.toIntOrNull() }

        val maxLen = maxOf(remoteParts.size, currentParts.size)
        for (i in 0 until maxLen) {
            val r = remoteParts.getOrElse(i) { 0 }
            val c = currentParts.getOrElse(i) { 0 }
            if (r > c) return true
            if (r < c) return false
        }
        return false
    }
}
