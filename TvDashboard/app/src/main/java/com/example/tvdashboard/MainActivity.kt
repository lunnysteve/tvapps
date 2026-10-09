package com.example.tvdashboard

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var rootContainer: FrameLayout
    private lateinit var webViewA: WebView
    private lateinit var webViewB: WebView
    private lateinit var hudPill: LinearLayout
    private lateinit var hudTitle: TextView
    private lateinit var hudStatus: TextView
    private lateinit var settingsOverlay: FrameLayout
    private lateinit var txtCurrentTv: TextView
    private lateinit var txtCurrentSource: TextView
    private lateinit var txtCurrentInterval: TextView
    private lateinit var btnToggleTv: Button
    private lateinit var btnToggleSource: Button
    private lateinit var btnReload: Button
    private lateinit var btnCloseSettings: Button

    private lateinit var txtAppVersion: TextView
    private lateinit var txtUpdateStatus: TextView
    private lateinit var btnCheckUpdate: Button
    private lateinit var btnInstallUpdate: Button
    private lateinit var btnSetToken: Button
    private var availableUpdate: ReleaseInfo? = null

    private lateinit var prefs: SharedPreferences
    private var wakeLock: PowerManager.WakeLock? = null
    private var configReceiver: android.content.BroadcastReceiver? = null

    private var activeWebView: WebView? = null
    private var preloadWebView: WebView? = null

    private var currentIndex = 0
    private var isPaused = false
    private var rotationIntervalMs = 60_000L
    private var sourceMode = DashboardConfig.SOURCE_LIVE_RUNNER
    private var screenId = DashboardConfig.DEFAULT_SCREEN_ID

    private val rotationHandler = Handler(Looper.getMainLooper())
    private var lastSwapTimestamp = System.currentTimeMillis()
    private var backPressCount = 0
    private val backResetHandler = Handler(Looper.getMainLooper())

    private val preloadRunnable = Runnable {
        if (!isPaused && sourceMode == DashboardConfig.SOURCE_LIVE_PAGES) {
            val nextIndex = (currentIndex + 1) % DashboardConfig.PLAYLIST.size
            val url = buildDashboardUrl(nextIndex)
            Log.d(TAG, "Preloading next dashboard [$nextIndex]: $url")
            preloadWebView?.loadUrl(url)
        }
    }

    private val swapRunnable = Runnable {
        if (!isPaused && sourceMode == DashboardConfig.SOURCE_LIVE_PAGES) {
            performCrossfadeSwap()
        }
    }

    private val watchdogRunnable = object : Runnable {
        override fun run() {
            if (!isPaused && sourceMode == DashboardConfig.SOURCE_LIVE_PAGES) {
                val elapsed = System.currentTimeMillis() - lastSwapTimestamp
                if (elapsed > (rotationIntervalMs + 20_000L)) {
                    Log.w(TAG, "Watchdog triggered: rotation stalled for ${elapsed}ms. Forcing swap.")
                    performCrossfadeSwap()
                }
            }
            rotationHandler.postDelayed(this, 30_000L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Inflate content view first so DecorView is initialized
        setContentView(R.layout.activity_main)
        setupKioskScreenFlags()

        prefs = getSharedPreferences(DashboardConfig.PREFS_NAME, Context.MODE_PRIVATE)
        rotationIntervalMs = prefs.getInt(DashboardConfig.KEY_ROTATION_INTERVAL_SEC, DashboardConfig.DEFAULT_ROTATION_SECONDS) * 1000L
        sourceMode = prefs.getString(DashboardConfig.KEY_SOURCE_MODE, DashboardConfig.SOURCE_LIVE_RUNNER) ?: DashboardConfig.SOURCE_LIVE_RUNNER
        screenId = prefs.getString(DashboardConfig.KEY_SCREEN_ID, DashboardConfig.DEFAULT_SCREEN_ID) ?: DashboardConfig.DEFAULT_SCREEN_ID

        initViews()
        setupWebViews()
        setupConfigReceiver()

        // 2. Load active TV dashboard / runner
        loadInitialDashboard()

        // 3. Start watchdog
        rotationHandler.postDelayed(watchdogRunnable, 30_000L)

        // 4. Background check for GitHub updates (delayed 3s after startup)
        rotationHandler.postDelayed({
            triggerCheckForUpdates(manual = false)
        }, 3000L)
    }

    override fun onDestroy() {
        super.onDestroy()
        configReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
    }

    override fun onResume() {
        super.onResume()
        acquireWakeLock()
        hideSystemUi()
    }

    override fun onPause() {
        super.onPause()
        releaseWakeLock()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUi()
        }
    }

    private fun setupKioskScreenFlags() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        hideSystemUi()
    }

    private fun hideSystemUi() {
        try {
            val decor = window.peekDecorView() ?: window.decorView
            if (decor != null) {
                val controller = androidx.core.view.WindowCompat.getInsetsController(window, decor)
                controller.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars())
            }
        } catch (e: Exception) {
            Log.w(TAG, "hideSystemUi warning: ${e.message}")
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            wakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "TvDashboard::ScreenAwakeLock"
            ).apply {
                setReferenceCounted(false)
            }
        }
        wakeLock?.acquire(12 * 60 * 60 * 1000L)
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {}
    }

    private fun initViews() {
        rootContainer = findViewById(R.id.rootContainer)
        webViewA = findViewById(R.id.webViewA)
        webViewB = findViewById(R.id.webViewB)
        hudPill = findViewById(R.id.hudPill)
        hudTitle = findViewById(R.id.hudTitle)
        hudStatus = findViewById(R.id.hudStatus)
        settingsOverlay = findViewById(R.id.settingsOverlay)
        txtCurrentTv = findViewById(R.id.txtCurrentTv)
        txtCurrentSource = findViewById(R.id.txtCurrentSource)
        txtCurrentInterval = findViewById(R.id.txtCurrentInterval)
        btnToggleTv = findViewById(R.id.btnToggleTv)
        btnToggleSource = findViewById(R.id.btnToggleSource)
        btnReload = findViewById(R.id.btnReload)
        btnCloseSettings = findViewById(R.id.btnCloseSettings)

        txtAppVersion = findViewById(R.id.txtAppVersion)
        txtUpdateStatus = findViewById(R.id.txtUpdateStatus)
        btnCheckUpdate = findViewById(R.id.btnCheckUpdate)
        btnInstallUpdate = findViewById(R.id.btnInstallUpdate)
        btnSetToken = findViewById(R.id.btnSetToken)

        val owner = prefs.getString(DashboardConfig.KEY_GITHUB_OWNER, DashboardConfig.DEFAULT_GITHUB_OWNER) ?: DashboardConfig.DEFAULT_GITHUB_OWNER
        val repo = prefs.getString(DashboardConfig.KEY_GITHUB_REPO, DashboardConfig.DEFAULT_GITHUB_REPO) ?: DashboardConfig.DEFAULT_GITHUB_REPO
        txtAppVersion.text = "App Version: v${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE}) · GitHub: $owner/$repo"

        btnCheckUpdate.setOnClickListener {
            triggerCheckForUpdates(manual = true)
        }

        btnSetToken.setOnClickListener {
            showTokenDialog()
        }

        btnInstallUpdate.setOnClickListener {
            val update = availableUpdate
            if (update != null) {
                btnInstallUpdate.isEnabled = false
                txtUpdateStatus.visibility = View.VISIBLE
                txtUpdateStatus.text = "Starting download..."
                showHud("Downloading update ${update.tagName}...", 3000)

                GitHubUpdateManager.downloadAndInstall(
                    activity = this,
                    releaseInfo = update,
                    token = prefs.getString(DashboardConfig.KEY_GITHUB_TOKEN, null),
                    onProgress = { percent ->
                        txtUpdateStatus.text = "Downloading: $percent%"
                        showHud("Downloading update: $percent%", 2000)
                    },
                    onDownloaded = {
                        txtUpdateStatus.text = "Download complete. Launching installer..."
                        btnInstallUpdate.isEnabled = true
                        showHud("Update downloaded! Follow prompt to install.", 4000)
                    },
                    onError = { error ->
                        txtUpdateStatus.text = "Download error: $error"
                        btnInstallUpdate.isEnabled = true
                        showHud("Update failed: $error", 4000)
                    }
                )
            }
        }

        activeWebView = webViewA
        preloadWebView = webViewB

        activeWebView?.alpha = 1f
        preloadWebView?.alpha = 0f

        btnToggleTv.setOnClickListener {
            cycleTvScreen()
        }

        btnToggleSource.setOnClickListener {
            cycleSourceMode()
        }

        btnReload.setOnClickListener {
            activeWebView?.reload()
            hideSettingsOverlay()
            showHud("Reloading $screenId...", 2500)
        }

        btnCloseSettings.setOnClickListener {
            hideSettingsOverlay()
        }

        updateSettingsUI()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebViews() {
        val setupView = { wv: WebView ->
            wv.setBackgroundColor(0xFF081117.toInt())
            wv.setInitialScale(50)
            wv.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                loadWithOverviewMode = true
                useWideViewPort = true
                textZoom = 100 // Prevent TV system text scaling from enlarging fonts
                setSupportZoom(true)
                builtInZoomControls = false
                displayZoomControls = false
                cacheMode = WebSettings.LOAD_DEFAULT
                userAgentString = "${userAgentString} ArchitainmentFireStick/1.2"
            }

            wv.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(cm: ConsoleMessage?): Boolean {
                    Log.d("DashboardConsole", "[${cm?.messageLevel()}] ${cm?.message()} -- line ${cm?.lineNumber()} of ${cm?.sourceId()}")
                    return true
                }
            }

            wv.webViewClient = object : WebViewClient() {
                override fun onPageCommitVisible(view: WebView?, url: String?) {
                    super.onPageCommitVisible(view, url)
                    inject1080pViewport(view)
                }

                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    val host = uri.host ?: ""
                    val path = uri.path ?: ""

                    if (host == "intranet.local" || host == "appassets.androidplatform.net") {
                        if (path.startsWith("/api/")) {
                            return forwardApiRequest(uri.toString(), request.method)
                        }

                        val assetPath = when {
                            path.startsWith("/assets/") -> path.removePrefix("/assets/")
                            path.startsWith("/dashboards/") -> "dashboards/" + path.removePrefix("/dashboards/")
                            path.startsWith("/tools/") -> "tools/" + path.removePrefix("/tools/")
                            path == "/" || path.isEmpty() -> "dashboards/charging-status.html"
                            else -> path.removePrefix("/")
                        }

                        try {
                            val stream = assets.open(assetPath)
                            val mime = getMimeType(assetPath)
                            val headers = mapOf(
                                "Access-Control-Allow-Origin" to "*",
                                "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
                                "Access-Control-Allow-Headers" to "*"
                            )
                            return WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream)
                        } catch (e: Exception) {
                            Log.w(TAG, "Asset not found: $assetPath: ${e.message}")
                        }
                    }

                    return super.shouldInterceptRequest(view, request)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    inject1080pViewport(view)
                    view?.evaluateJavascript("window.postMessage({ type: 'signage-activate' }, '*');", null)
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        val failingUrl = request.url?.toString() ?: ""
                        Log.w(TAG, "Main frame failed to load: $failingUrl (${error?.description}). Scheduling auto-retry in 5s...")
                        showHud("Reconnecting to server... (Auto-retrying in 5s)", 4000)
                        view?.postDelayed({
                            if (activeWebView == view) {
                                view.loadUrl(buildDashboardUrl(currentIndex))
                            }
                        }, 5000L)
                    }
                }

                @Suppress("DEPRECATION")
                override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    Log.w(TAG, "Legacy onReceivedError: $failingUrl ($description). Scheduling auto-retry in 5s...")
                    showHud("Reconnecting to server... (Auto-retrying in 5s)", 4000)
                    view?.postDelayed({
                        if (activeWebView == view) {
                            view.loadUrl(buildDashboardUrl(currentIndex))
                        }
                    }, 5000L)
                }

                override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                    Log.e(TAG, "WebView render process gone! Auto-reloading.")
                    activeWebView?.reload()
                    return true
                }
            }
        }

        setupView(webViewA)
        setupView(webViewB)
    }

    private fun getMimeType(path: String): String {
        return when {
            path.endsWith(".html", true) -> "text/html"
            path.endsWith(".js", true) || path.endsWith(".mjs", true) -> "application/javascript"
            path.endsWith(".css", true) -> "text/css"
            path.endsWith(".json", true) -> "application/json"
            path.endsWith(".png", true) -> "image/png"
            path.endsWith(".jpg", true) || path.endsWith(".jpeg", true) -> "image/jpeg"
            path.endsWith(".svg", true) -> "image/svg+xml"
            path.endsWith(".woff2", true) -> "font/woff2"
            path.endsWith(".woff", true) -> "font/woff"
            else -> "text/plain"
        }
    }

    private fun forwardApiRequest(requestUrl: String, method: String): WebResourceResponse? {
        val serverHost = prefs.getString(DashboardConfig.KEY_CUSTOM_HOST, DashboardConfig.DEFAULT_SERVER_HOST) ?: DashboardConfig.DEFAULT_SERVER_HOST
        val uri = android.net.Uri.parse(requestUrl)
        val target = "http://$serverHost${uri.path}" + (if (uri.query != null) "?${uri.query}" else "")

        return try {
            val url = URL(target)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 3000
            conn.readTimeout = 5000
            val stream: InputStream = conn.inputStream
            val mime = conn.contentType ?: "application/json"
            WebResourceResponse(mime, "UTF-8", conn.responseCode, conn.responseMessage, emptyMap(), stream)
        } catch (_: Exception) {
            null
        }
    }

    private fun buildDashboardUrl(index: Int = 0): String {
        val serverHost = prefs.getString(DashboardConfig.KEY_CUSTOM_HOST, DashboardConfig.DEFAULT_SERVER_HOST) ?: DashboardConfig.DEFAULT_SERVER_HOST

        return when (sourceMode) {
            DashboardConfig.SOURCE_LIVE_RUNNER -> {
                // Central Kiosk Runner: loads dashboard_runner.html directly so relative scripts (schedule.js, runner.js) load correctly!
                "http://$serverHost/tools/dashboard_runner/dashboard_runner.html?screen=$screenId"
            }
            DashboardConfig.SOURCE_BUNDLED -> {
                // Standalone local offline runner
                "http://intranet.local/tools/dashboard_runner/dashboard_runner.html?screen=$screenId"
            }
            DashboardConfig.SOURCE_LIVE_PAGES -> {
                val item = DashboardConfig.PLAYLIST[index % DashboardConfig.PLAYLIST.size]
                "http://$serverHost/${item.relativePath}"
            }
            else -> {
                "http://$serverHost/tools/dashboard_runner/dashboard_runner.html?screen=$screenId"
            }
        }
    }

    private fun loadInitialDashboard() {
        val url = buildDashboardUrl(currentIndex)
        Log.i(TAG, "Loading initial dashboard ($screenId) [mode: $sourceMode]: $url")
        activeWebView?.loadUrl(url)

        if (sourceMode == DashboardConfig.SOURCE_LIVE_PAGES) {
            scheduleNextCycle()
            showHud("${DashboardConfig.PLAYLIST[currentIndex].title} (${currentIndex + 1}/${DashboardConfig.PLAYLIST.size})", 3500)
        } else {
            showHud("Connected: Screen $screenId", 3500)
        }
    }

    private fun scheduleNextCycle() {
        rotationHandler.removeCallbacks(preloadRunnable)
        rotationHandler.removeCallbacks(swapRunnable)

        if (sourceMode != DashboardConfig.SOURCE_LIVE_PAGES || isPaused) {
            return
        }

        val preloadDelay = (rotationIntervalMs - 8_000L).coerceAtLeast(2_000L)
        rotationHandler.postDelayed(preloadRunnable, preloadDelay)
        rotationHandler.postDelayed(swapRunnable, rotationIntervalMs)
    }

    private fun performCrossfadeSwap() {
        currentIndex = (currentIndex + 1) % DashboardConfig.PLAYLIST.size
        lastSwapTimestamp = System.currentTimeMillis()

        val incomingView = preloadWebView ?: return
        val outgoingView = activeWebView ?: return

        incomingView.animate()
            .alpha(1f)
            .setDuration(800)
            .start()

        outgoingView.animate()
            .alpha(0f)
            .setDuration(800)
            .withEndAction {
                activeWebView = incomingView
                preloadWebView = outgoingView

                val currentItem = DashboardConfig.PLAYLIST[currentIndex]
                showHud("${currentItem.title} (${currentIndex + 1}/${DashboardConfig.PLAYLIST.size})", 3000)

                scheduleNextCycle()
            }
            .start()
    }

    private fun jumpToDashboard(newIndex: Int) {
        if (sourceMode != DashboardConfig.SOURCE_LIVE_PAGES) return

        rotationHandler.removeCallbacks(preloadRunnable)
        rotationHandler.removeCallbacks(swapRunnable)

        currentIndex = (newIndex + DashboardConfig.PLAYLIST.size) % DashboardConfig.PLAYLIST.size
        lastSwapTimestamp = System.currentTimeMillis()

        val url = buildDashboardUrl(currentIndex)
        activeWebView?.loadUrl(url)

        val item = DashboardConfig.PLAYLIST[currentIndex]
        showHud("${item.title} (${currentIndex + 1}/${DashboardConfig.PLAYLIST.size})", 3000)

        scheduleNextCycle()
    }

    private fun togglePause() {
        isPaused = !isPaused
        if (isPaused) {
            rotationHandler.removeCallbacks(preloadRunnable)
            rotationHandler.removeCallbacks(swapRunnable)
            showHud("⏸ Rotation Paused", 3500)
        } else {
            scheduleNextCycle()
            showHud("▶ Rotating every ${rotationIntervalMs / 1000}s", 3500)
        }
    }

    private fun showHud(text: String, durationMs: Long) {
        hudTitle.text = text
        hudStatus.text = if (isPaused) "· Paused" else "· Screen: $screenId"
        hudPill.animate().alpha(1f).setDuration(250).start()

        hudPill.removeCallbacks(hideHudRunnable)
        hudPill.postDelayed(hideHudRunnable, durationMs)
    }

    private val hideHudRunnable = Runnable {
        hudPill.animate().alpha(0f).setDuration(400).start()
    }

    private fun toggleSettingsOverlay() {
        if (settingsOverlay.visibility == View.VISIBLE) {
            hideSettingsOverlay()
        } else {
            showSettingsOverlay()
        }
    }

    private fun showSettingsOverlay() {
        updateSettingsUI()
        settingsOverlay.visibility = View.VISIBLE
        btnCloseSettings.requestFocus()
    }

    private fun hideSettingsOverlay() {
        settingsOverlay.visibility = View.GONE
        hideSystemUi()
    }

    private fun cycleTvScreen() {
        val list = DashboardConfig.AVAILABLE_SCREENS
        val currIdx = list.indexOf(screenId)
        val nextIdx = (if (currIdx >= 0) currIdx + 1 else 0) % list.size
        screenId = list[nextIdx]
        prefs.edit().putString(DashboardConfig.KEY_SCREEN_ID, screenId).apply()
        updateSettingsUI()
        loadInitialDashboard()
        showHud("Assigned to: $screenId", 3000)
    }

    private fun cycleSourceMode() {
        sourceMode = when (sourceMode) {
            DashboardConfig.SOURCE_LIVE_RUNNER -> DashboardConfig.SOURCE_BUNDLED
            DashboardConfig.SOURCE_BUNDLED -> DashboardConfig.SOURCE_LIVE_PAGES
            else -> DashboardConfig.SOURCE_LIVE_RUNNER
        }
        prefs.edit().putString(DashboardConfig.KEY_SOURCE_MODE, sourceMode).apply()
        updateSettingsUI()
        loadInitialDashboard()
    }

    private fun updateSettingsUI() {
        txtCurrentTv.text = "Screen Assignment: ${screenId.uppercase()} ($screenId)"
        btnToggleTv.text = "Assign This Firestick: [ ${screenId.uppercase()} ]"

        val sourceLabel = when (sourceMode) {
            DashboardConfig.SOURCE_LIVE_RUNNER -> "Live Admin Screen Managed (${DashboardConfig.DEFAULT_SERVER_HOST})"
            DashboardConfig.SOURCE_BUNDLED -> "Bundled Local Offline Assets"
            DashboardConfig.SOURCE_LIVE_PAGES -> "Direct Live Pages"
            else -> sourceMode
        }
        txtCurrentSource.text = "Source Mode: $sourceLabel"
        btnToggleSource.text = "Switch Mode (Current: ${sourceMode.uppercase()})"
        txtCurrentInterval.text = if (sourceMode == DashboardConfig.SOURCE_LIVE_RUNNER) {
            "Interval & Playlist: Controlled by Central Admin Screen"
        } else {
            "Interval: ${rotationIntervalMs / 1000} seconds"
        }

        val owner = prefs.getString(DashboardConfig.KEY_GITHUB_OWNER, DashboardConfig.DEFAULT_GITHUB_OWNER) ?: DashboardConfig.DEFAULT_GITHUB_OWNER
        val repo = prefs.getString(DashboardConfig.KEY_GITHUB_REPO, DashboardConfig.DEFAULT_GITHUB_REPO) ?: DashboardConfig.DEFAULT_GITHUB_REPO
        txtAppVersion.text = "App Version: v${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE}) · GitHub: $owner/$repo"

        val hasToken = !prefs.getString(DashboardConfig.KEY_GITHUB_TOKEN, null).isNullOrBlank()
        btnSetToken.text = if (hasToken) "GitHub Token: Configured ✓ (Tap to edit)" else "Configure GitHub Token (Private Repo)"
    }

    private fun inject1080pViewport(view: WebView?) {
        val js = """
            (function() {
                function enforce1080p(targetDoc) {
                    if (!targetDoc) return;
                    try {
                        var meta = targetDoc.querySelector('meta[name="viewport"]');
                        if (!meta) {
                            meta = targetDoc.createElement('meta');
                            meta.name = 'viewport';
                            (targetDoc.head || targetDoc.documentElement).appendChild(meta);
                        }
                        meta.content = 'width=1920, initial-scale=0.5, minimum-scale=0.5, maximum-scale=1.0, user-scalable=no';
                        
                        var w = targetDoc.documentElement ? targetDoc.documentElement.clientWidth : window.innerWidth;
                        if (w && w < 1900 && targetDoc.body) {
                            var scale = w / 1920;
                            if (scale < 0.99) {
                                targetDoc.body.style.zoom = scale;
                            }
                        }

                        if (targetDoc.documentElement) {
                            targetDoc.documentElement.style.overflow = 'hidden';
                        }
                        if (targetDoc.body) {
                            targetDoc.body.style.overflow = 'hidden';
                        }
                    } catch(e) {}
                }

                enforce1080p(document);
                try {
                    var frames = document.querySelectorAll('iframe');
                    frames.forEach(function(f) {
                        try {
                            if (f.contentDocument) enforce1080p(f.contentDocument);
                            f.removeEventListener('load', f._vpHook);
                            f._vpHook = function() {
                                try { enforce1080p(f.contentDocument); } catch(e) {}
                            };
                            f.addEventListener('load', f._vpHook);
                        } catch(e) {}
                    });
                } catch(e) {}
            })();
        """.trimIndent()
        view?.evaluateJavascript(js, null)
    }

    private fun triggerCheckForUpdates(manual: Boolean) {
        val owner = prefs.getString(DashboardConfig.KEY_GITHUB_OWNER, DashboardConfig.DEFAULT_GITHUB_OWNER) ?: DashboardConfig.DEFAULT_GITHUB_OWNER
        val repo = prefs.getString(DashboardConfig.KEY_GITHUB_REPO, DashboardConfig.DEFAULT_GITHUB_REPO) ?: DashboardConfig.DEFAULT_GITHUB_REPO
        val token = prefs.getString(DashboardConfig.KEY_GITHUB_TOKEN, null)

        if (manual) {
            btnCheckUpdate.isEnabled = false
            txtUpdateStatus.visibility = View.VISIBLE
            txtUpdateStatus.text = "Checking GitHub ($owner/$repo)..."
        }

        GitHubUpdateManager.checkForUpdate(
            context = this,
            owner = owner,
            repo = repo,
            token = token,
            onResult = { release ->
                btnCheckUpdate.isEnabled = true
                if (release != null) {
                    availableUpdate = release
                    txtUpdateStatus.visibility = View.VISIBLE
                    txtUpdateStatus.text = "New version available: ${release.tagName} (${release.apkFileName})"
                    btnInstallUpdate.visibility = View.VISIBLE
                    btnInstallUpdate.text = "Download & Install Update (${release.tagName})"
                    btnInstallUpdate.requestFocus()
                    showHud("Update available: ${release.tagName}! Press Menu to install", 6000)
                } else {
                    if (manual) {
                        txtUpdateStatus.visibility = View.VISIBLE
                        txtUpdateStatus.text = "Up to date (v${BuildConfig.VERSION_NAME})"
                        showHud("App is up to date (v${BuildConfig.VERSION_NAME})", 3000)
                    }
                }
            },
            onError = { err ->
                btnCheckUpdate.isEnabled = true
                if (manual) {
                    txtUpdateStatus.visibility = View.VISIBLE
                    txtUpdateStatus.text = "Check failed: $err"
                }
            }
        )
    }

    private fun showTokenDialog() {
        val currentToken = prefs.getString(DashboardConfig.KEY_GITHUB_TOKEN, "") ?: ""
        val input = android.widget.EditText(this).apply {
            setText(currentToken)
            hint = "Paste GitHub Personal Access Token (classic or fine-grained)"
            setSingleLine(true)
        }
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("GitHub Token (Private Repo)")
            .setMessage("Enter a GitHub Personal Access Token with 'repo' scope to check updates for private repository (or leave blank):")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val token = input.text.toString().trim()
                prefs.edit().putString(DashboardConfig.KEY_GITHUB_TOKEN, token.ifEmpty { null }).apply()
                showHud(if (token.isEmpty()) "Token cleared" else "GitHub token saved!", 2500)
                updateSettingsUI()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun setupConfigReceiver() {
        configReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val editor = prefs.edit()
                intent.getStringExtra("token")?.let { editor.putString(DashboardConfig.KEY_GITHUB_TOKEN, it) }
                intent.getStringExtra("github_token")?.let { editor.putString(DashboardConfig.KEY_GITHUB_TOKEN, it) }
                intent.getStringExtra("screen_id")?.let {
                    editor.putString(DashboardConfig.KEY_SCREEN_ID, it)
                    screenId = it
                }
                intent.getStringExtra("custom_host")?.let { editor.putString(DashboardConfig.KEY_CUSTOM_HOST, it) }
                intent.getStringExtra("source_mode")?.let {
                    editor.putString(DashboardConfig.KEY_SOURCE_MODE, it)
                    sourceMode = it
                }
                editor.apply()
                updateSettingsUI()
                showHud("Settings updated via broadcast", 3000)
                if (intent.hasExtra("reload") || intent.hasExtra("screen_id") || intent.hasExtra("source_mode")) {
                    loadInitialDashboard()
                }
            }
        }
        val filter = android.content.IntentFilter("com.example.tvdashboard.SET_CONFIG").apply {
            addAction("com.example.tvdashboard.SET_TOKEN")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(configReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(configReceiver, filter)
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_MEDIA_NEXT,
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> {
                if (settingsOverlay.visibility != View.VISIBLE) {
                    jumpToDashboard(currentIndex + 1)
                    return true
                }
            }
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_MEDIA_PREVIOUS,
            KeyEvent.KEYCODE_MEDIA_REWIND -> {
                if (settingsOverlay.visibility != View.VISIBLE) {
                    jumpToDashboard(currentIndex - 1)
                    return true
                }
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                togglePause()
                return true
            }
            KeyEvent.KEYCODE_MENU -> {
                toggleSettingsOverlay()
                return true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (settingsOverlay.visibility == View.VISIBLE) {
                    hideSettingsOverlay()
                    return true
                }

                backPressCount++
                if (backPressCount >= 2) {
                    finish()
                } else {
                    showHud("Press Back again to exit kiosk", 2000)
                    backResetHandler.postDelayed({ backPressCount = 0 }, 2000)
                }
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    companion object {
        private const val TAG = "TvDashboardActivity"
    }
}
