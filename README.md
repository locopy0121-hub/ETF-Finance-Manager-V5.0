# ETF財務管家 V5.0.6 NATIVE

Global Editor 2.1 + Floating Monitor Native 2.0 + Settings Layout 2.1 + Chart Engine 2.1 + AI Assistant 3.0 + App Icon Center + Native UI Foundation。

## 先看
- `V3.6.0_BLUEPRINT.png`
- `V3.6.0_NATIVE_BLUEPRINT.md`
- `V3.6.0_FULL_AUDIT.md`
- `VALIDATION_V3.6.0_NATIVE.md`
- `Documentation/V3.6.0_APK_INSTALL_GUIDE.md`

## 建置 APK

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_V3.6.0_APK.ps1
```

## 重要
V3.6.0 是新的 Native baseline (`runtimeVersion 3.6.0`)。V3.5.x APK 無法用 OTA 取得本版 Kotlin Overlay、排程 Receiver、App Icon activity-alias 或 Navigation Bar Native 控制能力。

## V5.0.6 Global 360 Editor Update

V5.0.6 360 Editor Stability Update：Settings 下拉改為單一展開＋延遲掛載；360 總開關作為總權限、各頁設定模式作為頁面權限；修正 Modern Screen 重複 PageFrame 攔截層；背景與文字背景規則完全分離，背景／圖片支援相簿選取、縮放、位移、旋轉、透明度與顯示模式。
