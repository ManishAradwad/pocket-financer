# pocket-financer — Project Seed

## What This Is

This folder contains **all reusable, battle-tested code** extracted from the `pocket-financer` fork of PocketPal AI. It is the foundation for building pocket-financer as a **standalone React Native app** from scratch.

The goal: hand this folder to any agent or developer and have them start building immediately — no archaeology, no guessing which PocketPal files are needed.

---

## The Vision

**Pocket Financer** is an Android app that reads your transactional SMS messages (bank alerts, UPI payments, credit card swipes) and gives you a beautiful dashboard of your finances — all processed entirely on-device with zero data leaving your phone.

### Core Architecture

```
SMS arrives → Android BroadcastReceiver → React Native event
                                        ↓
                                SmsService.ts
                                        ↓
                               PipelineService.ts
                                        ↓
                     ModelService.ts (llama.rn → SLM)
                                        ↓
                          TransactionStore.ts (MobX)
                                        ↓
                               WatermelonDB (SQLite)
                                        ↓
                      UI Screens read from TransactionStore
```

### The Four Screens

| Screen | What it shows |
|--------|--------------|
| **Home/Dashboard** | Hero balance, spend delta vs last period, Day/Week/Month switcher, sync strip, category breakdown, recent transactions |
| **Transactions** | All/Debits/Credits filter, day-grouped list, detail bottom sheet with SLM extraction output + raw SMS |
| **Insights** | 6-month spend trend bar chart, stats (6-mo avg, MTD, on-pace), top merchants ranked |
| **Settings** | SMS permissions, sync controls, model info, about |

Full design prototype: `Prototype.html` (in the pf folder, rendered as an interactive phone mockup).

---

## Key Design Decisions (as of seed creation)

1. **Single SLM call, not two.** The classification stage (YES/NO) is removed. The SLM either returns `null` for non-transactional SMS or a structured JSON. This cuts inference time in half.

2. **No date extraction from SLM.** The transaction date is always the SMS arrival timestamp from Android. The SLM never extracts a date. This eliminates a common hallucination source.

3. **No HF Store.** A single model is bundled or downloaded once. There is no HuggingFace browsing, no model switching UI, no model management in v1. Auto-selection by hardware tier may come in v1.1.

4. **GPU acceleration on Android.** If the device has an Adreno GPU with i8mm and dotprod CPU features, llama.rn uses Vulkan for 2-5x faster inference. Falls back to CPU gracefully.

5. **Minimum 2GB RAM.** Devices below this are blocked with an interstitial.

---

## What's In This Seed

### TIER 1 — Copy As-Is (these files are production-ready)

| File | Lines | Purpose |
|------|-------|---------|
| `android/.../sms/SmsModule.kt` | 118 | Turbo Module: SMS permission checks, inbox query with date/address/limit filters |
| `android/.../sms/SmsReceiver.kt` | 38 | BroadcastReceiver: catches incoming SMS, emits `onSmsReceived` event to JS |
| `android/.../sms/SmsPackage.kt` | 35 | Registers SmsModule with React Native |
| `android/.../HardwareInfoModule.kt` | 258 | Turbo Module: GPU detection (EGL/OpenGL), CPU feature parsing (/proc/cpuinfo), RAM query |
| `android/.../HardwareInfoPackage.kt` | 35 | Registers HardwareInfoModule with React Native |
| `src/specs/NativeSmsModule.ts` | 32 | TypeScript spec for the SMS Turbo Module (generates NativeSmsModuleSpec.java) |
| `src/specs/NativeHardwareInfo.ts` | 51 | TypeScript spec for the HardwareInfo Turbo Module |
| `src/services/sms/SmsService.ts` | 84 | Permission requests, SMS history fetch, real-time event listening |
| `src/services/sms/types.ts` | 14 | SmsMessage and SmsFilter interfaces |
| `src/store/TransactionStore.ts` | 141 | MobX store: add/find-or-create transactions and accounts, load from DB |
| `src/database/models/Transaction.ts` | 23 | WatermelonDB model: amount, merchant, date, type, accountId, rawMessage |
| `src/database/models/Account.ts` | 17 | WatermelonDB model: name, bank, type |
| `src/database/schema.ts` | 36 | DB schema v1: accounts + transactions tables only (PocketPal tables removed) |
| `src/database/index.ts` | 19 | Database adapter setup (WatermelonDB + SQLite, JSI enabled) |
| `src/utils/deviceCapabilities.ts` | 118 | GPU detection: Adreno + i8mm + dotprod check. iOS 18+ Metal check. Simulator rejection. |

### TIER 2 — Modified (adapted for the new app)

| File | Lines | What changed from the fork |
|------|-------|---------------------------|
| `src/services/pipeline/PipelineService.ts` | 280 | **Single LLM call** instead of two (classify + extract). No classifier method. Always uses SMS timestamp for date. References `modelService` instead of `modelStore`. |
| `src/services/pipeline/Prompts.ts` | 48 | **Combined prompt**: returns `null` for non-financial SMS or JSON for transactions. No separate classifier prompt. No date field in extraction schema. |
| `src/services/pipeline/CapabilityDetectionService.ts` | 58 | **Simplified**: checks RAM >= 2GB, detects GPU support, configures modelService with GPU layers. No model selection logic. No dependency on ModelStore. |
| `src/services/index.ts` | 5 | Exports only PipelineService and CapabilityDetectionService. |

### TIER 3 — Placeholder (needs to be built)

`src/services/model/ModelService.ts` — **This file does NOT exist yet and must be created.**

It is a thin wrapper around `llama.rn`'s `initLlama` + `completion()`. Responsibilities:
- Load the bundled GGUF model file
- Expose `complete(prompt, params)` → `Promise<string>`
- Expose `stopCompletion()` to abort inference
- Expose `isLoaded(): boolean`
- Expose `setGpuLayers(n: number)` for GPU/CPU configuration
- Single model, no switching, no downloads, no chat sessions

Expected: ~150 lines. The PocketPal `ModelStore.ts` (3054 lines) is the reference implementation but is overkill — strip it to the minimum.

---

## What Needs to Be Built From Scratch

### 1. ModelService.ts (see placeholder above)

The PipelineService imports `modelService` from `'../model/ModelService'`. This file must exist before the pipeline can work.

### 2. App.tsx (startup + navigation)

Pattern (from the fork's App.tsx):

```typescript
useEffect(() => {
  CapabilityDetectionService.checkAndInit().then(supported => {
    if (supported) {
      SmsService.hasPermissions().then(hasPerms => {
        if (hasPerms) {
          SmsService.startListening(sms => {
            PipelineService.processSms(sms);
          });
        }
      });
    }
  });
}, []);
```

Then render a `BottomTabNavigator` with 4 tabs: Home, Transactions, Insights, Settings.

### 3. Four Screens

- `DashboardScreen` — Hero balance, period switcher, sync strip, categories, recent transactions
- `TransactionsScreen` — SectionList with day groups, segment filter, detail bottom sheet
- `InsightsScreen` — Bar chart, stats row, top merchants
- `SettingsScreen` — SMS permissions, sync controls, about

All screens read from `TransactionStore.transactions` and `TransactionStore.accounts`.

### 4. Theme

Dark theme from the prototype:
- Background: `#0B0D11`
- Surface: `#14171E`
- Text: `#F4EEE2`
- Accent: `#F2A137` (amber/gold)
- Credit/Positive: `#4ADE80`
- Debit/Negative: `#F87171`

Implemented via React Native Paper's `Provider` theme.

---

## Dependencies (from the fork's package.json)

These are the dependencies the seed code requires:

```json
{
  "@dr.pogodin/react-native-fs": "required by model loading",
  "@gorhom/bottom-sheet": "required by detail sheets",
  "@nozbe/watermelondb": "required by database layer",
  "@react-native-async-storage/async-storage": "required by mobx-persist-store",
  "@react-navigation/bottom-tabs": "NEW — not in fork, install for bottom tabs",
  "@react-navigation/native": "required",
  "llama.rn": "required by ModelService",
  "mobx": "required by TransactionStore",
  "mobx-react": "required",
  "react-native-device-info": "required by RAM check + GPU detection",
  "react-native-gesture-handler": "required by bottom sheets",
  "react-native-paper": "required by theme/UI components",
  "react-native-safe-area-context": "required",
  "react-native-keyboard-controller": "optional"
}
```

**NOT needed** (PocketPal baggage removed):
- `@react-navigation/drawer` (using bottom tabs instead)
- `react-native-get-random-values`, `uuid` (no chat sessions)
- HF-related dependencies (no model download)

---

## Development Workflow

1. `npx react-native init PocketFinancer --template react-native-template-typescript`
2. Copy all files from this seed into the new project (preserving directory structure)
3. Install dependencies: `yarn add` the required ones listed above
4. Register native modules in `MainApplication.kt`:
   - `SmsPackage()` — SMS Turbo Module
   - `HardwareInfoPackage()` — Hardware detection
5. Register `SmsReceiver` in `AndroidManifest.xml` for SMS_RECEIVED broadcast
6. Build `ModelService.ts` (the placeholder)
7. Build `App.tsx` with bottom tabs + startup flow
8. Build the four screens
9. Apply the theme
10. Test: `npx react-native run-android`

---

## Reference: The Fork

The complete working fork is at `/mnt/c/pf` (Windows path, WSL2 path is `/mnt/c/pf`). It contains:

- `antigravity-build` branch: the PocketPal fork with our SMS pipeline changes
- `main` branch: upstream PocketPal (kept for reference)

Key reference files in the fork (if you need to look at how something was done):
- `App.tsx` — startup flow pattern (permissions + SMS listener + pipeline init)
- `src/store/ModelStore.ts` — full ModelStore (3054 lines, use as reference for ModelService)
- `android/app/src/main/AndroidManifest.xml` — permissions + receiver registration
- `android/app/src/main/java/com/pocketpalai/MainApplication.kt` — native module registration
- `Prototype.html` — interactive design prototype (open in browser)

---

## Git Strategy

The fork lives at `antigravity-build` and serves as a reference. The new standalone project should:

1. Start with a fresh git repo (`git init` in the new project root)
2. First commit: "Initial project scaffold (React Native init)"
3. Second commit: "Add seed files — SMS pipeline, database layer, native modules"
4. Develop from there with incremental commits per screen/feature

This keeps a clean history separate from PocketPal's 600+ commits.

---

## Quick Start Checklist for the Next Agent

- [ ] Run `npx react-native init PocketFinancer --template react-native-template-typescript`
- [ ] Copy all files from this seed into the new project
- [ ] Install dependencies (see list above)
- [ ] Register `SmsPackage` and `HardwareInfoPackage` in `MainApplication.kt`
- [ ] Register `SmsReceiver` in `AndroidManifest.xml` with SMS permissions
- [ ] Build `src/services/model/ModelService.ts` — thin llama.rn wrapper
- [ ] Build `App.tsx` — bottom tabs + startup flow from the pattern above
- [ ] Build `DashboardScreen.tsx` — see Prototype.html for design
- [ ] Build `TransactionsScreen.tsx` — see Prototype.html for design
- [ ] Build `InsightsScreen.tsx` — see Prototype.html for design
- [ ] Build `SettingsScreen.tsx` — SMS permissions + sync + about
- [ ] Apply dark theme from prototype
- [ ] Run `npx tsc --noEmit` — fix type errors
- [ ] Build and test on Android device
