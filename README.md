# ETF財務管家 V5.0.9 NATIVE

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

## V5.0.8 Canvas / Block Foundation Update

V5.0.8：360 編輯器改以 Frame=Canvas、Block=內容的座標模型為主；Cell/Grid 僅保留舊資料 migration/輔助線用途。同步修正 Block 拖移與尺寸輸入回彈、浮動即時預覽、真正色盤、全域損益色設定與附加框架 Runtime。


## V5.0.9 CI Recovery Update

V5.0.9 CI Recovery Update：同步版本鏈至 5.0.9 / 50009 / build 56，修正 360 zero-legacy audit 被 migration 註解中的 Legacy 字樣誤觸發；保留既有 360 Canvas / Block 功能，不擴充 5.1.x 延後項目。
