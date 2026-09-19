# ETF財務管家 V5.0.5 NATIVE

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

## V5.0.5 Global 360 Frame + Block Workspace

V5.0.5 Global 360 Frame + Block Workspace：採 A-B / B-C / C-D / D-E 分層；補齊主框架位置尺寸、Block 拖移/Resize/基準線磁吸、px 編輯、真實資料預覽、Data Binding 鎖定與重新指向、圖表資料連接、完整色盤、圖片背景、Draft/Commit、取消/還原/刪除。Settings 僅保留 360 全局開關，本頁永久不接受 360 編輯。
