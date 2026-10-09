package com.example.tvdashboard

data class DashboardItem(
    val title: String,
    val relativePath: String,
    val defaultDurationSeconds: Int = 60
)

object DashboardConfig {
    const val PREFS_NAME = "architainment_tv_kiosk"
    const val KEY_SOURCE_MODE = "source_mode"
    const val KEY_CUSTOM_HOST = "custom_host"
    const val KEY_SCREEN_ID = "screen_id"
    const val KEY_ROTATION_INTERVAL_SEC = "rotation_interval_sec"
    const val KEY_GITHUB_OWNER = "github_owner"
    const val KEY_GITHUB_REPO = "github_repo"
    const val KEY_GITHUB_TOKEN = "github_token"

    const val DEFAULT_GITHUB_OWNER = "lunnysteve"
    const val DEFAULT_GITHUB_REPO = "tvapps"

    const val SOURCE_LIVE_RUNNER = "live_runner" // Managed by remote Admin Screen (default)
    const val SOURCE_BUNDLED = "bundled"         // Standalone local offline rotation
    const val SOURCE_LIVE_PAGES = "live_pages"   // Direct pages from server

    const val DEFAULT_SERVER_HOST = "192.168.0.194:8082"
    const val DEFAULT_ROTATION_SECONDS = 60
    const val DEFAULT_SCREEN_ID = "tv1"

    val AVAILABLE_SCREENS = listOf("tv1", "tv2", "tv3", "default")

    // Standard fallback playlist matching rotation_config.json Business Hours
    val PLAYLIST = listOf(
        DashboardItem("Charging Status", "dashboards/charging-status.html", 60),
        DashboardItem("Manufacturing", "dashboards/manufacturing-24hrs.html", 60),
        DashboardItem("Subscriptions", "dashboards/subscriptions.html", 60),
        DashboardItem("Weather Forecast", "dashboards/weather-forecast.html", 60),
        DashboardItem("Digital Clock", "dashboards/digital-clock.html", 60),
        DashboardItem("Shipping Weight", "dashboards/shipping_weight-overview.html", 60),
        DashboardItem("Website Projects", "dashboards/website_projects.html", 60),
        DashboardItem("Company Overview", "dashboards/company-overview.html", 60),
        DashboardItem("Goods In (24h)", "dashboards/goods-in-24hrs.html", 60),
        DashboardItem("Goods Out (24h)", "dashboards/goods-out-24hrs.html", 60)
    )
}
