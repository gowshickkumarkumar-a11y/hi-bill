$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   BUILDING ANDROID APK FOR MEMBER TRACKER       " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$JAVA_HOME = "C:\Program Files\JetBrains\PyCharm 2026.1\jbr"
$env:JAVA_HOME = $JAVA_HOME
$JAVAC = "$JAVA_HOME\bin\javac.exe"
$KEYTOOL = "$JAVA_HOME\bin\keytool.exe"

$SDK_DIR = "$env:LOCALAPPDATA\Android\Sdk"
$BUILD_TOOLS = "$SDK_DIR\build-tools\36.0.0"
$AAPT2 = "$BUILD_TOOLS\aapt2.exe"
$D8 = "$BUILD_TOOLS\d8.bat"
$ZIPALIGN = "$BUILD_TOOLS\zipalign.exe"
$APKSIGNER = "$BUILD_TOOLS\apksigner.bat"
$ANDROID_JAR = "$SDK_DIR\platforms\android-36.1\android.jar"

$ROOT_DIR = "c:\Users\gowsh\OneDrive\Desktop\bill"
$BUILD_ROOT = "$ROOT_DIR\apk-build"

# Clean up build dir
if (Test-Path $BUILD_ROOT) {
    Remove-Item -Recurse -Force $BUILD_ROOT
}

$SRC_DIR = "$BUILD_ROOT\src\com\membertracker\app"
$RES_DIR = "$BUILD_ROOT\res"
$ASSETS_DIR = "$BUILD_ROOT\assets"
$OBJ_DIR = "$BUILD_ROOT\obj"
$BIN_DIR = "$BUILD_ROOT\bin"

New-Item -ItemType Directory -Force -Path $SRC_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$RES_DIR\values" | Out-Null
New-Item -ItemType Directory -Force -Path "$RES_DIR\drawable" | Out-Null
New-Item -ItemType Directory -Force -Path $ASSETS_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $OBJ_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null

Write-Host "[1/7] Copying web app assets..." -ForegroundColor Yellow
Copy-Item "$ROOT_DIR\index.html" "$ASSETS_DIR\"
Copy-Item "$ROOT_DIR\app.js" "$ASSETS_DIR\"
Copy-Item "$ROOT_DIR\style.css" "$ASSETS_DIR\"
Copy-Item "$ROOT_DIR\tailwind.cdn.js" "$ASSETS_DIR\"
Copy-Item "$ROOT_DIR\lucide.min.js" "$ASSETS_DIR\"
Copy-Item "$ROOT_DIR\chart.min.js" "$ASSETS_DIR\"

Write-Host "[2/7] Generating App Icon..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 192, 192
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(79, 70, 229)) # Indigo
$graphics.FillEllipse($bgBrush, 8, 8, 176, 176)

$font = [System.Drawing.Font]::new("Arial", [float]90.0, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("M", $font, $textBrush, [System.Drawing.RectangleF]::new(0, 0, 192, 192), $stringFormat)

$bmp.Save("$RES_DIR\drawable\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bmp.Dispose()

Write-Host "[3/7] Creating AndroidManifest and Resources (No-BOM)..." -ForegroundColor Yellow
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$stringsXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Member Tracker</string>
</resources>
"@
[System.IO.File]::WriteAllText("$RES_DIR\values\strings.xml", $stringsXml, $utf8NoBom)

$manifestXml = @"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.membertracker.app"
    android:versionCode="1"
    android:versionName="1.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:allowBackup="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.NoTitleBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"@
[System.IO.File]::WriteAllText("$BUILD_ROOT\AndroidManifest.xml", $manifestXml, $utf8NoBom)

$mainActivityJava = @"
package com.membertracker.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
"@
[System.IO.File]::WriteAllText("$SRC_DIR\MainActivity.java", $mainActivityJava, $utf8NoBom)

Write-Host "[4/7] Compiling Java code..." -ForegroundColor Yellow
& $JAVAC --release 8 -cp "$ANDROID_JAR" -d "$OBJ_DIR" "$SRC_DIR\MainActivity.java"

Write-Host "[5/7] Converting to DEX with D8..." -ForegroundColor Yellow
$classFiles = Get-ChildItem "$OBJ_DIR" -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
& $D8 --output "$BIN_DIR" $classFiles

Write-Host "[6/7] Packaging resources with AAPT2..." -ForegroundColor Yellow
& $AAPT2 compile --dir "$RES_DIR" -o "$BIN_DIR\compiled_res.zip"
& $AAPT2 link -I "$ANDROID_JAR" --manifest "$BUILD_ROOT\AndroidManifest.xml" -A "$ASSETS_DIR" "$BIN_DIR\compiled_res.zip" -o "$BIN_DIR\unaligned.apk"

# Inject classes.dex into the APK (ZIP)
Write-Host "Injecting classes.dex into APK..."
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$BIN_DIR\unaligned.apk", [System.IO.Compression.ZipArchiveMode]::Update)
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$BIN_DIR\classes.dex", "classes.dex") | Out-Null
$zip.Dispose()

Write-Host "[7/7] Aligning and Signing APK..." -ForegroundColor Yellow
& $ZIPALIGN -f -p 4 "$BIN_DIR\unaligned.apk" "$BIN_DIR\aligned.apk"

$KEYSTORE = "$BUILD_ROOT\debug.keystore"
if (-not (Test-Path $KEYSTORE)) {
    & $KEYTOOL -genkeypair -v -keystore $KEYSTORE -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Member Tracker Debug, O=MemberTracker, C=IN"
}

$FINAL_APK = "$ROOT_DIR\MemberTracker.apk"
& $APKSIGNER sign --ks $KEYSTORE --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out $FINAL_APK "$BIN_DIR\aligned.apk"

Write-Host "=================================================" -ForegroundColor Green
Write-Host " SUCCESS! APK GENERATED AT:                      " -ForegroundColor Green
Write-Host " $FINAL_APK " -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Green

