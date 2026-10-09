# TV Dashboard Deployment & Setup Guide

This guide covers everything needed to configure, deploy, and maintain the 3-TV signage setup with Amazon Fire TV Sticks.

---

## 1. Quick File Reference

- **Ready-to-Install APK**: [`ArchitainmentDashboards-FireStick.apk`](file:///C:/Users/slunn/Projects/tvapps/ArchitainmentDashboards-FireStick.apk) *(8.97 MB)*
- **Android Studio Project**: [`TvDashboard/`](file:///C:/Users/slunn/Projects/tvapps/TvDashboard)
- **Central Admin Kiosk Manager**: [`http://192.168.0.194:8082/tools/kiosk_manager/kiosk_manager.html`](http://192.168.0.194:8082/tools/kiosk_manager/kiosk_manager.html)
- **Dashboard Source Files**: `C:\Users\slunn\Projects\office intranet\dashboards`

---

## 2. Deploying to the 3 Fire Sticks (Over Wi-Fi)

You do not need to connect each Fire Stick with a USB cable. Once connected to the office Wi-Fi network, you can push the APK over the network:

### Step 1: Enable Developer Options on Fire Stick
1. On each Fire TV Stick, go to **Settings** > **My Fire TV** > **About**.
2. Highlight the device name and press the remote's **Center / Select button 7 times** until the prompt *"No need, you are already a developer"* appears.
3. Press **Back** to return to **My Fire TV**, select **Developer Options**.
4. Turn **ON** both **ADB Debugging** and **Apps from Unknown Sources**.
5. Go back to **Settings** > **My Fire TV** > **About** > **Network** and note the stick's IP address (e.g. `192.168.0.110`, `192.168.0.111`, `192.168.0.112`).

### Step 2: Push the APK from PC
Run the following in PowerShell from `C:\Users\slunn\Projects\tvapps`:

```powershell
# Set adb alias if not in system PATH
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

# Connect to Fire Stick 1
& $adb connect 192.168.0.110:5555

# Install APK
& $adb -s 192.168.0.110:5555 install -r "ArchitainmentDashboards-FireStick.apk"

# Start the application
& $adb -s 192.168.0.110:5555 shell monkey -p com.example.tvdashboard -c android.intent.category.LAUNCHER 1
```
*(Repeat for Fire Stick 2 and Fire Stick 3 with their respective IP addresses).*

---

## 3. One-Time Hardware Configuration

After the app launches on each TV:
1. Press the **Menu** button (button with 3 horizontal lines) on the Fire TV remote (or tap/click if using a mouse/touchscreen).
2. The **TV & Display Settings** modal will appear.
3. Click **Assign This Firestick**:
   - For TV 1: Click **`[ TV 1 ]`**
   - For TV 2: Click **`[ TV 2 ]`**
   - For TV 3: Click **`[ TV 3 ]`**
4. Click **Done / Close**.

The device will save this assignment permanently. It now connects to:
`http://192.168.0.194:8082/?screen=tv1` (or `tv2`, `tv3`).

---

## 4. Unattended 24/7 Kiosk Behaviour

Once assigned, **the remotes can be removed from the TVs**. The system is built to operate completely headless:

1. **Auto-Start on Boot (`RECEIVE_BOOT_COMPLETED`)**:
   - When the TV or Fire Stick is plugged in or power-cycled, Android broadcasts `ACTION_BOOT_COMPLETED`.
   - `BootReceiver.kt` listens with maximum priority (`priority="1000"`) and immediately launches `MainActivity`.
2. **Network Boot Resilience**:
   - If the Fire Stick powers up before the office Wi-Fi router connects, the app will not crash or show an ugly 404 page. It shows a subtle reconnect badge and retries every 5 seconds until the intranet is reached.
3. **Always-On / No Sleep**:
   - Uses `FLAG_KEEP_SCREEN_ON` on the Window hierarchy.
   - Holds an active `PowerManager.FULL_WAKE_LOCK` to ensure the Fire OS screensaver and low-power standby modes never engage.
4. **Accidental Exit Prevention**:
   - Pressing the Back button once does nothing.
   - Only a rapid double-press of Back will exit the kiosk.
5. **Memory & Process Watchdog**:
   - Implements `onRenderProcessGone()` on both WebViews to automatically recreate and reload without crashing if the Android system runs low on memory.

---

## 5. Changing Dashboards Remotely (Admin Screen)

To change which dashboards display, reorder them, or adjust rotation times:

1. Open your web browser on any PC or phone connected to the office network:
   `http://192.168.0.194:8082/tools/kiosk_manager/kiosk_manager.html`
2. Select the screen profile tab you want to change:
   - **`tv1`**: Controls Fire Stick 1
   - **`tv2`**: Controls Fire Stick 2
   - **`tv3`**: Controls Fire Stick 3
3. Add, remove, or reorder dashboard URLs and adjust the display seconds (e.g. 60 seconds).
4. Click **Save Configuration**.
5. **No TV interaction needed**: The Fire Sticks poll the server config API every 10 seconds and automatically adopt the new playlist on the fly.

---

## 6. Remote Access From Outside the Office (Mobile / Home)

To access the admin screen when you are away from the office LAN:

### Option A: Cloudflare Zero Trust Tunnel (Recommended)
1. Run `cloudflared` on the server machine (`192.168.0.194`):
   ```bash
   cloudflared tunnel create tv-admin
   cloudflared tunnel route dns tv-admin screens.architainment.co.uk
   ```
2. Route incoming traffic to `http://localhost:8082`.
3. Protect with Cloudflare Zero Trust Access (one-time email PIN).
4. You can now manage all 3 screens from your phone anywhere in the world at `https://screens.architainment.co.uk`.

### Option B: Tailscale VPN
1. Install Tailscale on the server machine (`192.168.0.194`) and on your phone.
2. Open `http://<tailscale-ip>:8082/tools/kiosk_manager/kiosk_manager.html`.

---

## 7. Remote Control Button Reference (For Setup / Testing)

| Button | Action |
|---|---|
| **Menu Button** | Open Display & Assignment Settings |
| **Play / Pause** | Pause / resume dashboard rotation |
| **Fast Forward / Right** | Skip to next dashboard |
| **Rewind / Left** | Go back to previous dashboard |
| **Back (Double-press)** | Exit application |
