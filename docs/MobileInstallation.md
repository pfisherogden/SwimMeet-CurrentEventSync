# iOS & Android Mobile Installation Guide (PWA)

You can run the **Scoreboard Event & Heat Controller** as a full-screen, standalone application on any iPhone, iPad, or Android device. This configuration does **not** require any App Store or Google Play developer account, works completely offline (using service worker caching), and supports loading `events.csv` schedule files directly from your mobile device's files folder.

---

## 📲 How to Install

### iOS (iPhones & iPads)
1. Open the **Safari** browser.
2. Navigate to: 
   👉 `https://pfisherogden.github.io/SwimMeet-CurrentEventSync/controller.html`
3. Tap the **Share** button (the square icon with an arrow pointing up in the bottom/top navigation bar).
4. Scroll down and tap **Add to Home Screen** (➕).
5. Name the app (e.g., "Scoreboard Control") and tap **Add**.
6. The app icon will now appear on your Home Screen. Tap it to launch the controller in full-screen standalone mode (without standard Safari address bars).

### Android (Phones & Tablets)
1. Open the **Chrome** browser.
2. Navigate to: 
   👉 `https://pfisherogden.github.io/SwimMeet-CurrentEventSync/controller.html`
3. Tap the **three dots menu** (⋮) at the top-right corner.
4. Tap **Add to Home Screen** or **Install app**.
5. Confirm by tapping **Install**.
6. The application will be added to your home screen and app drawer as a native-feeling standalone utility.

---

## 📁 Loading `events.csv` on Mobile

To pacing the scoreboard sequentially, you can load your meet's `events.csv` program schedule directly on your mobile device:

1. **Get the File**: Email the `events.csv` file to your mobile device, or upload it to a cloud drive (such as Google Drive, Dropbox, or iCloud).
2. **Download Locally**: On iOS, save the file to the **Files** app (`On My iPhone` or `iCloud Drive`). On Android, download it to your **Downloads** folder.
3. **Load in App**:
   * Open the Scoreboard Controller app from your Home Screen.
   * Tap the **📁 Load CSV** button in the *Meet Program Flow* card.
   * Your device's native file picker will open. Locate and select the `events.csv` file.
   * The app will parse and render your events schedule immediately.
   * The parsed program schedule is automatically saved to local storage so it remains loaded even if you close and reopen the app.

---

## ☀️ Outdoor Deck Optimization

Swim meets are frequently held under bright sunlight, which can make screens difficult to read.
* Tap the **☀️ Outdoor Mode** button in the header bar.
* This toggles a high-contrast high-visibility layout: white backgrounds, thick black borders, and high-visibility text colors to ensure the event/heat counts are readable under extreme glare.

---

## 🔌 Offline Operation
The application integrates an automatic Service Worker (`sw.js`). Once loaded or installed on your home screen, the controller app can be launched and operated even when you have **no cellular connection or internet access** on the pool deck. 

*(Note: Active event/heat updates will queue or fail to sync to Google Sheets without internet, but the local visual schedule, pacing controls, and manual values remain fully operational).*
