# Project Context: Pocket-Financer (Fork of PocketPal)

## 📌 Project Vision
**Pocket-Financer** is an Android-focused, privacy-first financial tracking application designed for the **Indian market**. It leverages **on-device LLMs (Local Large Language Models)** to automatically parse SMS transaction messages from banks and financial institutions, providing users with a comprehensive view of their finances without their data ever leaving the device.

## 🏗️ Architecture & Tech Stack
- **Base Project**: [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai) (Forked)
- **Framework**: React Native (Android focus)
- **Language**: TypeScript
- **LLM Engine**: `llama.rn` (React Native bindings for `llama.cpp`)
- **State Management**: MobX
- **Navigation**: React Navigation
- **UI Component Library**: React Native Paper
- **Database**: WatermelonDB (already a dependency in the base project)

## 🎯 Key Objectives
1.  **Android First**: Primary target is Android due to SMS access permissions.
2.  **Multi-Agent SMS Workflow**:
    -   **Agent 1 (Classifier)**: Detects if an incoming SMS is financial (Transaction/Bank/Credit Card) or spam/irrelevant.
    -   **Agent 2 (Extractor)**: Extracts structured data (Amount, Merchant, Date, Type) from financial SMS.
3.  **Local Intelligence**: Zero data egress.
4.  **Indian Context**: Optimized for Indian financial SMS formats.
5.  **Device Capability Awareness**: The app must detect device capabilities (RAM, CPU) at launch and select the best-performing LLM that can run on that device. If the device is not capable of running any suitable LLM, the user should be informed upfront before proceeding.

## 📱 MVP UI Structure
1.  **Dashboard**:
    -   Financial Health Score (0-100).
    -   Monthly Spend, Income, Savings Rate.
2.  **Transactions**:
    -   List of parsed transactions with clean merchant names and category icons.
3.  **AI Assistant**:
    -   Chat interface with context-aware financial assistant.
    -   User can ask "How much did I spend on food?" or "What is my health score?".
4.  **Settings**: Model management and preferences.
 
## 📂 Project Structure Highlights

### Existing (from PocketPal)
- `android/`: Native Android code. **Critical** for implementing the SMS Listener.
- `src/screens/`: Current screens — `ChatScreen`, `ModelsScreen`, `PalsScreen`, `SettingsScreen`, `BenchmarkScreen`, `AboutScreen`, `DevToolsScreen`.
- `src/store/`: MobX stores — `ModelStore.ts`, `ChatSessionStore.ts`, `PalStore.ts`, `HFStore.ts`, `UIStore.ts`, `BenchmarkStore.ts`, etc.
- `src/services/`: Current services — `DeepLinkService.ts`, `downloads/`, `palshub/`.
- `src/database/`: WatermelonDB setup — `schema.ts`, `migrations.ts`, `models/`.
- `src/components/`: Reusable UI components (Chat, Markdown, Settings, etc.).

### Planned (to be created)
- `src/services/sms/`: SMS listening and retrieval logic (Completed in Phase 2).
- `src/services/pipeline/`: The "Multi-Agent" workflow logic (Orchestrator).
- `src/store/TransactionStore.ts`: MobX store for parsed transactions.
- `src/screens/DashboardScreen/`: Main home summary.
- `src/screens/TransactionsScreen/`: Transaction list view.
- `src/screens/AssistantScreen/`: Chat interface reusing existing chat infrastructure.

## 🛠️ Transformation Roadmap

### Phase 1: Cleanup & Foundation
- **Remove** (Almost Done):
  - [x] Pals system: `PalsScreen/`, `PalStore.ts`, `PalsHub/`, `PalsSheets/`, Pal-related components.
  - [x] Roleplay and Public Hub browsing features.
  - [x] Cloud dependencies: `@supabase/supabase-js`, `@react-native-firebase/app`, `@react-native-firebase/app-check`, `@react-native-google-signin/google-signin`.
  - [x] iOS specific configurations and `ios/` directory (Project is now Android-only).
- **Keep** (Verified):
  - [x] `llama.rn` and model management infrastructure.
  - [x] `HFStore.ts` (HuggingFace model downloads).
  - [x] `ModelStore.ts` (LLM model lifecycle management).
  - [x] `ChatSessionStore.ts` (basis for AI Assistant).
  - [x] ESLint, Prettier, commitlint configs.
- **Decide (per-screen)** (Completed):
  - [x] `ChatScreen` → evolved into `AssistantScreen` (financial context-aware).
  - [x] `BenchmarkScreen` / `DevToolsScreen` → keep during development, remove or hide for release.
  - [x] `AboutScreen` → keep, rebranded for Pocket-Financer.
  - [x] `SettingsScreen` → keep, extend with financial preferences.

### Phase 2: Android SMS Layer (Completed)
- [x] **Permissions**: `READ_SMS`, `RECEIVE_SMS` configured in AndroidManifest.xml along with a background `SmsReceiver`.
- [x] **Native Module**: Created `com.pocketpal.sms` Turbo Module to pass SMS history and `onSmsReceived` events to React Native.
- [x] **Service Layer**: Created `src/services/sms/SmsService.ts` as a singleton wrapper to safely check permissions and fetch history.

### Phase 3: Intelligence Pipeline (Multi-Agent)
- **Classifier Agent**: Prompt to decide `Financial` vs `Non-Financial`.
- **Extractor Agent**: JSON extraction prompt.
- **Orchestrator**: TypeScript logic to chain these steps.
- **Database**: Extend existing WatermelonDB schema with new `Transaction` and `Account` models (adding to the existing `src/database/` setup).
- **State**: New `TransactionStore` (MobX) for managing parsed transaction data.
- **Device Capability**: Detect device specs and auto-select the lightest viable LLM. Show a clear warning/blocker if the device cannot support any suitable model.

### Phase 4: UI Implementation
- **Dashboard**: Implement the "Good Evening" card styles and health score.
- **Transactions List**: Render extracted data.
- **Chat Interface**: Re-use existing chat UI but connected to the financial context.

## 💻 Development Environment

### Host Setup
- **Host OS**: Windows 11
- **IDE**: Android Studio Otter 3 Feature Drop (2025.2.3)
- **Build Environment**: Native Windows (previously WSL2, migrated to Windows)
- **Android SDK**: `C:\Users\manis\AppData\Local\Android\Sdk`
- **Project Path**: `C:\Users\manis\Documents\pocket-financer`

### Windows Toolchain
> [!IMPORTANT]
> **Windows Path Length Limit**: Building from nested directories (like `C:\Users\manis\Documents\pocket-financer`) can cause CMake/NDK build failures due to Windows path length limits.
> ALWAYS run Android builds from the shortened junction point alias: `C:\pf`
> Setup command used: `New-Item -ItemType Junction -Path "C:\pf" -Target "C:\Users\manis\Documents\pocket-financer"`
| Tool | Version | Path / Notes |
| --- | --- | --- |
| JDK | JDK 17 | Bundled with Android Studio or installed separately |
| Node.js | 22.21.0 | Managed via `nvm-windows` (`.nvmrc` in project root) |
| yarn | 1.22.22 | Installed globally via npm (`packageManager` field in `package.json`) |
| Gradle | 8.13 | Via wrapper (`android/gradlew.bat`) |
| NDK | 27.3.13750724 | Installed via Android Studio SDK Manager |
| Kotlin | 2.1.20 | Set in `android/build.gradle` |
| Build Tools | 36.1.0 | compileSdk / targetSdk: 36, minSdk: 26 |

### Android Build Configuration
| Property | Value |
| --- | --- |
| `compileSdkVersion` | 36 |
| `targetSdkVersion` | 36 |
| `minSdkVersion` | 26 |
| `buildToolsVersion` | 36.1.0 |
| `ndkVersion` | 27.3.13750724 |
| `newArchEnabled` | true |
| `hermesEnabled` | true |
| `applicationId` | com.pocketpalai |
| `ABI Filters` | arm64-v8a, x86_64 |

### Required Environment Variables (Windows System/User variables)
```
JAVA_HOME = C:\Program Files\Java\jdk-17  (or Android Studio bundled JDK path)
ANDROID_HOME = C:\Users\manis\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
```

### Build Commands (from PowerShell / CMD)
```powershell
cd C:\pf                                          # CRITICAL: Always build from alias to avoid path length errors
nvm use 22.21.0                                   # Switch to Node 22.21.0
yarn install                                      # Install JS dependencies
cd android; .\gradlew.bat assembleDebug           # Build debug APK
npx react-native run-android                      # Build & deploy to connected emulator/device
npx react-native start                            # Start Metro bundler
```

### Important Files (not in version control)
- `android/local.properties` — `sdk.dir` pointing to Windows Android SDK path (e.g., `C\:\\Users\\manis\\AppData\\Local\\Android\\Sdk`)
- `android/app/google-services.json` — Placeholder (Firebase to be removed in Phase 1)
- `.env` — Created from `.env.example` with cloud features disabled

## 📝 Conventions
- **Code Style**: ESLint + Prettier (existing config).
- **Commits**: Conventional Commits (e.g., `feat: add sms listener`, `chore: remove pals`).
- **Context Updates**: Update this file when major architectural changes occur.
