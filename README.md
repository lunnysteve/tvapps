# Architainment Fire TV & Android TV Dashboard System

Hardware-accelerated TV signage app built for Amazon Fire TV Sticks and Android TV displays. Autoloads on startup, stays awake 24/7 with no sleep, and features central remote management for multi-TV deployments.

## Ready-to-Install APK

* **Download**: [ArchitainmentDashboards-FireStick.apk](file:///C:/Users/slunn/Projects/tvapps/ArchitainmentDashboards-FireStick.apk) *(8.97 MB, signed release build)*
* **Project Directory**: [TvDashboard](file:///C:/Users/slunn/Projects/tvapps/TvDashboard)

---

## 3-TV Multi-Display Architecture

Your office intranet already includes a dedicated central **Kiosk Manager** admin panel:
* **Admin Screen URL (LAN)**: `http://192.168.0.194:8082/tools/kiosk_manager/kiosk_manager.html` (or via portal at `http://192.168.0.194:8082/`)
* **Screen Profiles**:
  * `tv1` (e.g., Reception / Front Office)
  * `tv2` (e.g., Manufacturing & Assembly)
  * `tv3` (e.g., Warehouse & Logistics)
  * `default`

### How Each Fire Stick Binds to a Screen
On each TV, launch the app and press **Menu** (or long-press **Center**) on the remote:
1. **Fire Stick 1**: Click **Assign This Firestick** -> select **`[ TV 1 ]`**.
2. **Fire Stick 2**: Click **Assign This Firestick** -> select **`[ TV 2 ]`**.
3. **Fire Stick 3**: Click **Assign This Firestick** -> select **`[ TV 3 ]`**.

Each Fire Stick connects to `http://192.168.0.194:8082/?screen=<tvX>`. The app polls for playlist updates every 10 seconds. Whenever you add, remove, or reorder HTML dashboards in the Admin Screen, the TVs update automatically without rebooting!

---

## Deployment to Fire TV Sticks (Remote-Free / Unattended)

Once installed and configured, remotes can be removed from the screens completely.

### Step 1: Enable Developer Options on Fire Stick
1. Go to **Settings** > **My Fire TV** > **About**.
2. Highlight your device name and press the **Select** button 7 times (until it says *"You are already a developer"*).
3. Press **Back** to enter **Developer Options**.
4. Enable **ADB Debugging** and **Apps from Unknown Sources**.
5. Go to **Settings** > **My Fire TV** > **About** > **Network** to note down the Fire Stick IP address (e.g. `192.168.0.xxx`).

### Step 2: Install via ADB over Wi-Fi
From your computer (in PowerShell or CMD):
```powershell
# 1. Connect to Fire Stick IP over Wi-Fi port 5555
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" connect 192.168.0.XXX:5555

# 2. Push and install the release APK
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s 192.168.0.XXX:5555 install -r "C:\Users\slunn\Projects\tvapps\ArchitainmentDashboards-FireStick.apk"

# 3. Launch the app directly from ADB
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s 192.168.0.XXX:5555 shell monkey -p com.example.tvdashboard -c android.intent.category.LAUNCHER 1
```

*(Repeat for each of the 3 Fire Sticks)*

### Step 3: One-Time Device Assignment
1. Launch the app.
2. Tap the screen or press the **Menu** button on the Fire TV remote.
3. In the Settings HUD dialog, click **Assign This Firestick** and pick `TV 1`, `TV 2`, or `TV 3`.
4. The stick saves this preference permanently in `SharedPreferences`.

### Step 4: Unattended Boot & Screen Wake
* **Boot Autoload**: Registered with `RECEIVE_BOOT_COMPLETED` at maximum priority (`1000`). When power is turned on or the stick restarts, the kiosk launches immediately.
* **Network Wait Watchdog**: If the TV stick boots faster than the office Wi-Fi connects, a built-in retry watchdog retries connection every 5 seconds without crashing or showing error screens.
* **No Sleep / Never Turn Off**: Flagged with `FLAG_KEEP_SCREEN_ON` and native `PowerManager.FULL_WAKE_LOCK` to suppress screensavers and standby timeouts 24/7.
* **Accidental Dismissal Protection**: Pressing Back once is ignored. Double-pressing Back is required to exit.

---

## Remote Access for the Admin Screen

To control and change what displays on the 3 TVs from home or your mobile phone:

### Method 1: Cloudflare Tunnel (Zero Trust) — Recommended & Secure
Since the project already uses Cloudflare (`wrangler.jsonc`), a Cloudflare Tunnel is the cleanest solution:
1. Run `cloudflared` on the office server (`192.168.0.194`):
   ```bash
   cloudflared tunnel create tv-admin
   cloudflared tunnel route dns tv-admin screens.architainment.co.uk
   ```
2. Point the tunnel to `http://localhost:8082`.
3. Add a free Cloudflare Zero Trust Access Application with email PIN verification.
4. You can now securely manage the 3 TVs from anywhere at `https://screens.architainment.co.uk/tools/kiosk_manager/kiosk_manager.html`.

### Method 2: Tailscale Mesh VPN
1. Install Tailscale on the server machine (`192.168.0.194`) and on your phone/laptop.
2. Open `http://<tailscale-ip>:8082/tools/kiosk_manager/kiosk_manager.html` from anywhere in the world.

---

## Fire TV Remote Shortcuts

| Remote Button | Action |
|---|---|
| **D-Pad Right / Fast-Forward** | Skip immediately to next dashboard |
| **D-Pad Left / Rewind** | Return to previous dashboard |
| **Play / Pause** | Pause or resume auto-rotation |
| **Menu Button** | Open Display Settings (assign TV 1/2/3, switch offline/online mode) |
| **Back Button (Double-press)** | Exit kiosk (single press is ignored to prevent accidental exit) |

---

## Technical Notes & Fixes Applied

* **Android 15 / Modern Devices Window Insets**:
  - `DecorView.getWindowInsetsController()` throws a `NullPointerException` if invoked prior to `setContentView()`.
  - Fixed in `MainActivity.kt` by binding the view hierarchy first and using backward/forward compatible `WindowCompat.getInsetsController(window, window.decorView)`.
* **AAPT Resource Parsing**:
  - Unescaped `&` in XML layout text replaced with `&amp;`.
* **Dual-Buffered WebView Cross-Fading**:
  - Uses two WebViews (`webViewA` and `webViewB`) to preload the next page in the background and smoothly cross-fade over 800ms, eliminating white flashes between dashboards.
* **WebView Process Auto-Recovery**:
  - Implements `onRenderProcessGone()` on both WebViews to automatically recreate and reload without crashing if the Android system runs low on memory.
