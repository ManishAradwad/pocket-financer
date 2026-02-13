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
- `src/services/sms/`: SMS listening and retrieval logic.
- `src/services/pipeline/`: The "Multi-Agent" workflow logic (Orchestrator).
- `src/store/TransactionStore.ts`: MobX store for parsed transactions.
- `src/screens/DashboardScreen/`: Main home summary.
- `src/screens/TransactionsScreen/`: Transaction list view.
- `src/screens/AssistantScreen/`: Chat interface reusing existing chat infrastructure.

## 🛠️ Transformation Roadmap

### Phase 1: Cleanup & Foundation
- **Remove**:
  - Pals system: `PalsScreen/`, `PalStore.ts`, `PalsHub/`, `PalsSheets/`, Pal-related components.
  - Roleplay and Public Hub browsing features.
  - Cloud dependencies: `@supabase/supabase-js`, `@react-native-firebase/app`, `@react-native-firebase/app-check`, `@react-native-google-signin/google-signin` (conflicts with zero-data-egress vision).
- **Keep**:
  - `llama.rn` and model management infrastructure.
  - `HFStore.ts` (HuggingFace model downloads).
  - `ModelStore.ts` (LLM model lifecycle management).
  - `ChatSessionStore.ts` (basis for AI Assistant).
  - ESLint, Prettier, commitlint configs.
- **Decide (per-screen)**:
  - `ChatScreen` → evolves into `AssistantScreen` (financial context-aware).
  - `BenchmarkScreen` / `DevToolsScreen` → keep during development, remove or hide for release.
  - `AboutScreen` → keep, rebrand for Pocket-Financer.
  - `SettingsScreen` → keep, extend with financial preferences.

### Phase 2: Android SMS Layer
- **Permissions**: `READ_SMS`, `RECEIVE_SMS`.
- **Native Module**: Bridge to pass SMS to RN.

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
- **IDE**: Android Studio Otter 3 Feature Drop (2025.2.3) — runs on Windows
- **Build Environment**: WSL2 (Ubuntu 24.04 LTS)
- **Android SDK**: Windows-side SDK, accessed from WSL2 via `/mnt/c/Users/manis/AppData/Local/Android/Sdk`

### WSL2 Toolchain
| Tool | Version | Path / Notes |
| --- | --- | --- |
| JDK | OpenJDK 17 | `/usr/lib/jvm/java-17-openjdk-amd64` |
| Node.js | 22.21.0 | Managed via `nvm` (`.nvmrc` in project root) |
| yarn | 1.22.22 | Installed globally via npm |
| Gradle | 9.0.0 | Via wrapper (`android/gradlew`) |
| NDK | 27.3.13750724 | From Windows Android SDK |

### Required Environment Variables (in `~/.bashrc`)
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/mnt/c/Users/manis/AppData/Local/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

### Build Commands (from WSL2 terminal, project root)
```bash
nvm use                              # Switch to Node 22.21.0
yarn install                         # Install JS dependencies
cd android && ./gradlew assembleDebug  # Build debug APK
```

### Important Files (not in version control)
- `android/local.properties` — `sdk.dir` pointing to WSL2-accessible SDK path
- `android/app/google-services.json` — Placeholder (Firebase to be removed in Phase 1)
- `.env` — Created from `.env.example` with cloud features disabled

## 📝 Conventions
- **Code Style**: ESLint + Prettier (existing config).
- **Commits**: Conventional Commits (e.g., `feat: add sms listener`, `chore: remove pals`).
- **Context Updates**: Update this file when major architectural changes occur.
