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

## 🎯 Key Objectives
1.  **Android First**: Primary target is Android due to SMS access permissions.
2.  **Multi-Agent SMS Workflow**:
    -   **Agent 1 (Classifier)**: Detects if an incoming SMS is financial (Transaction/Bank/Credit Card) or spam/irrelevant.
    -   **Agent 2 (Extractor)**: Extracts structured data (Amount, Merchant, Date, Type) from financial SMS.
3.  **Local Intelligence**: Zero data egress.
4.  **Indian Context**: Optimized for Indian financial SMS formats.

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
(Based on `PocketPal` structure)

- `android/`: Native Android code. **Critical** for implementing the SMS Listener.
- `src/services/sms/`: SMS listening and retrieval logic.
- `src/services/pipeline/`: The "Multi-Agent" workflow logic (Orchestrator).
- `src/screens/`:
    - `DashboardScreen/`: Main home summary.
    - `TransactionsScreen/`: List view.
    - `AssistantScreen/`: Chat interface.

## 🛠️ Transformation Roadmap

### Phase 1: Cleanup & Foundation
- **Remove**: Pals, Roleplay, Public Hub browsing.
- **Keep**: `llama.rn`, Model management.

### Phase 2: Android SMS Layer
- **Permissions**: `READ_SMS`, `RECEIVE_SMS`.
- **Native Module**: Bridge to pass SMS to RN.

### Phase 3: Intelligence Pipeline (Multi-Agent)
- **Classifier Agent**: Prompt to decide `Financial` vs `Non-Financial`.
- **Extractor Agent**: JSON extraction prompt.
- **Orchestrator**: TypeScript logic to chain these steps.
- **Database**: WatermelonDB schema for `Transaction` and `Account`.

### Phase 4: UI Implementation
- **Dashboard**: Implement the "Good Evening" card styles and health score.
- **Transactions List**: Render extracted data.
- **Chat Interface**: Re-use existing chat UI but connected to the financial context.

## 📝 Conventions
- **Code Style**: ESLint + Prettier (existing config).
- **Commits**: Conventional Commits (e.g., `feat: add sms listener`, `chore: remove pals`).
- **Context Updates**: Update this file when major architectural changes occur.
