# ETF財務管家 V5.0.10 NATIVE

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


## V5.0.10 360 Gated Repair

V5.0.10 360 Gated Repair：依序完成拖曳、Resize、Nudge、Snap / ZERO OVERLAP、Block 命名、A→B→C→D→E 層級、Grid 純輔助、手勢互斥、Z 圖層、文字/文字背景/方塊背景損益色、raw numeric 判色、背景分層、真實預覽、生命週期與 Settings 單一 360 主開關修復；同步版本鏈至 5.0.10 / 50010 / build 57；5.1.x 圖表進階功能維持延後，不混入本輪。
