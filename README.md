HIIIII :D

# QNX Sentinel — Hybrid AI Post-Mortem Telemetry & Forensics Workbench

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Firebase AI Logic](https://img.shields.io/badge/Firebase_AI_Logic-firebase%2Fai-amber.svg)](https://firebase.google.com/docs/ai-logic)
[![Models](https://img.shields.io/badge/Gemini-2.5--flash--lite_%7C_2.5--flash-cyan.svg)](https://firebase.google.com/docs/ai-logic/models)

**QNX Sentinel** is an off-board post-mortem crash-dump and fleet forensics workbench designed for automotive & industrial embedded systems running **QNX Neutrino RTOS (SDP 8.0)**.

All AI inference is executed 100% client-side via the **Firebase AI Logic SDK (`firebase/ai`)** using `InferenceMode.PREFER_ON_DEVICE`, `InferenceMode.ONLY_ON_DEVICE` (offline mode), and `InferenceMode.PREFER_IN_CLOUD` (`gemini-2.5-flash-lite` and `gemini-2.5-flash`).

---

## 1. Architectural Boundary: On-Target RTOS vs. Off-Board Browser Workbench

| Subsystem | Runtime Environment | Worst-Case Execution Time (WCET) | Responsibility |
| :--- | :--- | :--- | :--- |
| **Hard Real-Time Safety Gate (`/qnx-target/`)** | Embedded C11 / C++20 on QNX Neutrino RTOS (`SCHED_FIFO` Priority 254, `mlockall`) | **< 50 µs** (38 µs nominal) | Autonomous hardware Safe Torque Off (STO) contactor actuation (`K1/K2`), HV isolation monitoring (`< 100 kΩ` floor), and lock-free `/dev/shmem` crash-dump ring buffer. Never waits on a browser or network call. |
| **Off-Board Post-Mortem Workbench (Next.js App)** | Browser Client (`firebase/ai` + Web Crypto + IndexedDB) | **Streaming TTFT Measured via `performance.now()`** |Ingests exported QNX PPS crash dumps and technician voice/text notes across 12 languages, scrubs PII on-device before dispatch, runs model-to-model consensus between Stage 1 (`PREFER_ON_DEVICE` / `ONLY_ON_DEVICE`) and Stage 2 (`PREFER_IN_CLOUD`), inspects fault images, and chains every event into a SHA-256 cryptographic ledger. |

---

## 2. Five-Product Firebase Integration Stack

All five Firebase products are initialized on the primary `FirebaseApp` instance in [`lib/firebase-client.ts`](./lib/firebase-client.ts) using `NEXT_PUBLIC_FIREBASE_*` environment variables:

| # | Firebase Product | SDK Import | Implementation & Role in QNX Sentinel |
| :--- | :--- | :--- | :--- |
| **1** | **Firebase AI Logic** | `firebase/ai` (`getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`, `InferenceSource`, `Schema`) | Powers 100% of text and multimodal inference (`lib/firebase-ai-hybrid.ts`). Configures `onDeviceParams` (`expectedInputs`, `expectedOutputs`, download `monitor`, and JSON `responseConstraint` for Chrome Gemini Nano) alongside `inCloudParams` (`gemini-2.5-flash-lite` for Stage 1 fallback/multilingual routing and `gemini-2.5-flash` for Stage 2 structured JSON audit). Every result displays its true `InferenceSource` badge (`ON_DEVICE`, `IN_CLOUD`, or `NONE`). |
| **2** | **Cloud Firestore** | `firebase/firestore` (`getFirestore`, `setDoc`, `getDocFromServer`, `serverTimestamp`) | Persists verified SHA-256 Flight Recorder blocks (`/black_box_entries/{entryId}`) and speculative consensus audits (`/diagnostic_audits/{auditId}`), protected by the 220-line [`firestore.rules`](./firestore.rules) security policy. |
| **3** | **Firebase App Check** | `firebase/app-check` (`initializeAppCheck`, `ReCaptchaEnterpriseProvider`) | Bound directly to the primary `app` instance. Supports `self.FIREBASE_APPCHECK_DEBUG_TOKEN` (via `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN`) for local/judge evaluation and `ReCaptchaEnterpriseProvider` (via `NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY`) for production attestation. |
| **4** | **Firebase Remote Config** | `firebase/remote-config` (`getRemoteConfig`, `getValue`) | Synchronizes live experiment parameters: `routing_experiment_arm` (`BALANCED_HYBRID` vs `STRICT_EDGE_SAVER`), `max_on_device_tokens` (`256`), and `strict_edge_tokens` (`512`). |
| **5** | **Firebase Authentication** | `firebase/auth` (`getAuth`, `GoogleAuthProvider`, `signInWithPopup`) | Authenticates service-bay operators with verified email identity (`request.auth.token.email_verified == true`) required by `firestore.rules` before committing SHA-256 blocks to Cloud Firestore. |

---

## 3. Adaptive 12-Language Router & Offline Queue (`lib/adaptive-router.ts` & `lib/offline-queue.ts`)

1. **Client-Side PII Airlock (`scrubPii`)**:
   - Before any prompt reaches `firebase/ai`, deterministic regex filters strip 17-character automotive VINs (`[REDACTED_VIN]`), emails (`[REDACTED_EMAIL]`), GPS coordinates (`[REDACTED_GPS]`), phone numbers (`[REDACTED_PHONE]`), and technician badge IDs (`[REDACTED_BADGE]`).
2. **Script Detection & Chrome Gemini Nano Language Check (`GEMINI_NANO_SUPPORTED_LOCALES`)**:
   - Detects English (`en`) plus 11 non-English automotive manufacturing locales: Mandarin Chinese (`zh`), Japanese (`ja`), Korean (`ko`), German (`de`), Hindi (`hi`), Kannada (`kn`), Spanish (`es`), Portuguese (`pt`), French (`fr`), Italian (`it`), and Arabic (`ar`).
   - Checks the detected locale against Chrome's Built-in AI Prompt API supported languages (`['en', 'es', 'ja']`):
     - **Offline Mode (`isOffline === true`)**: Enforces `InferenceMode.ONLY_ON_DEVICE` (`firebase/ai`) and queues Cloud Audit payloads into persistent `IndexedDB` + `localStorage` (`lib/offline-queue.ts`) with status `QUEUED_OFFLINE` until connectivity is restored.
     - **English Structured QNX Logs (`en`)**: Routes to `InferenceMode.PREFER_ON_DEVICE` (`onDeviceParams` with JSON `responseConstraint` -> automatic fallback to `gemini-2.5-flash-lite` if Nano is absent on the host machine).
     - **Non-English Technician Prompts (`zh`, `ja`, `ko`, `de`, `hi`, `kn`, `es`, `pt`, `fr`, `it`, `ar`)**: Routes to `InferenceMode.PREFER_IN_CLOUD` (`gemini-2.5-flash-lite`) for native-script forensic synthesis.
3. **Model-to-Model Speculative Consensus Gate (`lib/firebase-ai-hybrid.ts`)**:
   - Both Stage 1 (`edgeTriage`) and Stage 2 (`cloudAudit` on `gemini-2.5-flash`) request the same structured JSON schema (`faultCode`, `severity`, `extractedTempC`, `extractedIsolationKOhm`).
   - `computeEdgeCloudConsensus()` compares Stage 1 model output directly against Stage 2 model output. The local regex safety parser is kept strictly separate as a labeled `Deterministic Baseline`. If either model call fails (e.g., offline, missing config, or quota), the gate returns `status: 'AUDIT_UNAVAILABLE'` and `consensusScore: null` rather than copying regex baseline values.

---

## 4. Payload-First Security & "Dirty Dozen" Emulator Test Suite

See [`security_spec.md`](./security_spec.md) and [`firestore.rules`](./firestore.rules) for the full data invariants:
- **Global Default-Deny**: All unmatched paths are rejected (`allow read, write: if false;`).
- **Append-Only Cryptographic Ledger**: `/black_box_entries/{entryId}` permits `create`, `get`, and `list` by verified owners (`email_verified == true`), while `update` and `delete` are unconditionally forbidden (`allow update, delete: if false;`).
- **64-Char SHA-256 Digest Validation**: Both `prevHash` and `entryHash` are validated against `^[a-f0-9]{64}$`.
- **Terminal State Lock & Whitelisted Diffs**: `/diagnostic_audits/{auditId}` locks documents once `status == 'RESOLVED'` and restricts non-admin updates to `affectedKeys().hasOnly(['status', 'updatedAt'])`.

---

## 5. Local Setup, Build & Verification Instructions

### Prerequisites
- Node.js 20+ and npm
- (Optional) Chrome Canary / Dev 138+ with `chrome://flags/#optimization-guide-on-device-model` and `chrome://flags/#prompt-api-for-gemini-nano` enabled to execute `InferenceSource.ON_DEVICE` locally; otherwise `firebase/ai` transparently executes via `InferenceSource.IN_CLOUD` (`gemini-2.5-flash-lite`) and reports `CLOUD_FALLBACK_VIA_PREFER_ON_DEVICE`.

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local` and supply your Firebase project credentials:
```bash
cp .env.example .env.local
```

Required keys in `.env.local`:
```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID="(default)"

# App Check: set "true" (or a registered debug token UUID) for local development,
# or provide your ReCaptcha Enterprise site key:
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN="true"
NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY=""
```

### 2. Install Dependencies & Run Development Server
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### 3. Run Unit Tests, Typecheck, Lint & Production Build
```bash
# Run core unit tests (Adaptive Router, PII Airlock, SHA-256 Hash Chain, Consensus Gate, Latency Stats)
npm test

# Run TypeScript compiler verification
npm run typecheck

# Run ESLint verification
npm run lint

# Build production Next.js bundle
npm run build
```

To execute the 12 "Dirty Dozen" adversarial security rules tests against a live local Firestore Emulator (requires Java 11+):
```bash
npx firebase emulators:exec --only firestore "npm test"
```

---

## 6. License

Licensed under the **Apache License, Version 2.0**. See [`LICENSE`](./LICENSE) for full terms.
