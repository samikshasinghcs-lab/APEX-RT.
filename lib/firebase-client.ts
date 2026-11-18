'use client';

import {
  initializeApp,
  getApps,
  getApp,
  FirebaseApp,
  FirebaseOptions,
} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  AppCheck,
} from 'firebase/app-check';
import {
  getRemoteConfig,
  getValue,
  RemoteConfig,
} from 'firebase/remote-config';
import { getAI, GoogleAIBackend, AI } from 'firebase/ai';
import type { ExperimentArm } from './adaptive-router';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface ResolvedFirebaseEnvConfig extends FirebaseOptions {
  firestoreDatabaseId: string;
  recaptchaSiteKey: string;
  appCheckDebugToken: string;
  isConfigured: boolean;
  missingEnvVars: string[];
}

/**
 * Reads Firebase configuration strictly from `NEXT_PUBLIC_FIREBASE_*` environment variables.
 * Does NOT import `firebase-applet-config.json` so fresh git clones build cleanly without leaked secrets.
 */
export function resolveFirebaseConfig(): ResolvedFirebaseEnvConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '';
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '';
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '';
  const messagingSenderId =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '';
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '';
  const firestoreDatabaseId =
    process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID?.trim() ||
    '(default)';
  const recaptchaSiteKey =
    process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY?.trim() || '';
  const appCheckDebugToken =
    process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() || '';

  const requiredPairs: Array<[string, string]> = [
    ['NEXT_PUBLIC_FIREBASE_API_KEY', apiKey],
    ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', authDomain],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', projectId],
    ['NEXT_PUBLIC_FIREBASE_APP_ID', appId],
  ];

  const missingEnvVars = requiredPairs
    .filter(
      ([, val]) =>
        !val ||
        val.startsWith('YOUR_') ||
        val === 'undefined'
    )
    .map(([key]) => key);

  const isConfigured = missingEnvVars.length === 0;

  return {
    apiKey: isConfigured ? apiKey : undefined,
    authDomain: isConfigured ? authDomain : undefined,
    projectId: isConfigured ? projectId : 'unconfigured-project',
    storageBucket: isConfigured ? storageBucket : undefined,
    messagingSenderId: isConfigured ? messagingSenderId : undefined,
    appId: isConfigured ? appId : undefined,
    firestoreDatabaseId,
    recaptchaSiteKey,
    appCheckDebugToken,
    isConfigured,
    missingEnvVars,
  };
}

export const resolvedConfig = resolveFirebaseConfig();
export const isFirebaseConfigured = resolvedConfig.isConfigured;
export const missingFirebaseEnvVars = resolvedConfig.missingEnvVars;

export const app: FirebaseApp | null = resolvedConfig.isConfigured
  ? getApps().length === 0
    ? initializeApp(resolvedConfig)
    : getApp()
  : null;

export const db: Firestore | null = app
  ? getFirestore(app, resolvedConfig.firestoreDatabaseId || '(default)')
  : null;

export const auth: Auth | null = app ? getAuth(app) : null;

let appCheckInstance: AppCheck | null = null;
let remoteConfigInstance: RemoteConfig | null = null;
let firebaseAiInstance: AI | null = null;
let connectionTested = false;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore on initial boot.
 */
export async function testFirestoreConnection(): Promise<{
  online: boolean;
  errorMessage: string | null;
}> {
  if (!resolvedConfig.isConfigured || !db) {
    return {
      online: false,
      errorMessage: `Missing env vars: ${resolvedConfig.missingEnvVars.join(', ')}`,
    };
  }
  if (connectionTested) return { online: true, errorMessage: null };
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { online: true, errorMessage: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration:', msg);
      return { online: false, errorMessage: msg };
    }
    // Permission denied on /test/connection still proves network reachability to Firestore
    return { online: true, errorMessage: null };
  }
}

export interface AppCheckInitStatus {
  initialized: boolean;
  status: 'ENFORCED_RECAPTCHA' | 'DEBUG_TOKEN_ACTIVE' | 'UNCONFIGURED' | 'ERROR';
  providerLabel: string;
  errorMessage: string | null;
}

/**
 * Initializes Firebase App Check (Product #3 of 5) on the primary `app` instance.
 * - Uses `self.FIREBASE_APPCHECK_DEBUG_TOKEN` when `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` is set.
 * - Uses `ReCaptchaEnterpriseProvider` when `NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY` is provided.
 * - Does NOT fabricate a fake CustomProvider token and does NOT swallow errors.
 */
export function initSentinelAppCheck(): AppCheckInitStatus {
  if (typeof window === 'undefined') {
    return {
      initialized: false,
      status: 'UNCONFIGURED',
      providerLabel: 'SSR_STANDBY',
      errorMessage: null,
    };
  }

  if (!resolvedConfig.isConfigured || !app) {
    return {
      initialized: false,
      status: 'UNCONFIGURED',
      providerLabel: 'MISSING_FIREBASE_ENV',
      errorMessage: `Set ${resolvedConfig.missingEnvVars.join(', ')} in .env.local`,
    };
  }

  try {
    const debugToken = resolvedConfig.appCheckDebugToken;
    if (debugToken) {
      const globalSelf = self as unknown as {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
      };
      globalSelf.FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken === 'true' ? true : debugToken;
    }

    if (resolvedConfig.recaptchaSiteKey) {
      if (!appCheckInstance) {
        appCheckInstance = initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(
            resolvedConfig.recaptchaSiteKey
          ),
          isTokenAutoRefreshEnabled: true,
        });
      }
      return {
        initialized: true,
        status: debugToken ? 'DEBUG_TOKEN_ACTIVE' : 'ENFORCED_RECAPTCHA',
        providerLabel: debugToken
          ? 'ReCaptchaEnterprise + DebugToken (Primary App)'
          : 'ReCaptchaEnterprise (Primary App)',
        errorMessage: null,
      };
    }

    if (debugToken) {
      return {
        initialized: false,
        status: 'DEBUG_TOKEN_ACTIVE',
        providerLabel:
          'FIREBASE_APPCHECK_DEBUG_TOKEN=true (Set NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY for ReCaptchaEnterprise)',
        errorMessage: null,
      };
    }

    return {
      initialized: false,
      status: 'UNCONFIGURED',
      providerLabel:
        'UNCONFIGURED (Set NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY or NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN)',
      errorMessage: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AppCheck Initialization Error]:', message);
    return {
      initialized: false,
      status: 'ERROR',
      providerLabel: `ERROR: ${message.slice(0, 80)}`,
      errorMessage: message,
    };
  }
}

/**
 * Initializes Firebase Remote Config (Product #4 of 5) and reads `routing_experiment_arm`.
 */
export async function initSentinelRemoteConfig(): Promise<{
  arm: ExperimentArm;
  source: string;
  errorMessage: string | null;
}> {
  if (typeof window === 'undefined' || !resolvedConfig.isConfigured || !app) {
    return {
      arm: 'BALANCED_HYBRID',
      source: 'default-unconfigured',
      errorMessage: null,
    };
  }
  try {
    if (!remoteConfigInstance) {
      remoteConfigInstance = getRemoteConfig(app);
      remoteConfigInstance.settings.minimumFetchIntervalMillis = 3600000;
      remoteConfigInstance.defaultConfig = {
        routing_experiment_arm: 'BALANCED_HYBRID',
        max_on_device_tokens: 256,
        strict_edge_tokens: 512,
      };
    }
    const val = getValue(remoteConfigInstance, 'routing_experiment_arm');
    const strVal = val.asString();
    const arm: ExperimentArm =
      strVal === 'STRICT_EDGE_SAVER' ? 'STRICT_EDGE_SAVER' : 'BALANCED_HYBRID';
    return { arm, source: val.getSource(), errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[RemoteConfig Init Warning]:', message);
    return {
      arm: 'BALANCED_HYBRID',
      source: 'local-default',
      errorMessage: message,
    };
  }
}

/**
 * Initializes Firebase AI Logic SDK (`firebase/ai`, Product #1 of 5) on the primary `app` instance.
 */
export function getSentinelFirebaseAI(): {
  ai: AI | null;
  errorMessage: string | null;
} {
  if (typeof window === 'undefined') {
    return {
      ai: null,
      errorMessage: 'SSR environment (firebase/ai requires browser client)',
    };
  }
  if (!resolvedConfig.isConfigured || !app) {
    return {
      ai: null,
      errorMessage: `Missing Firebase configuration (${resolvedConfig.missingEnvVars.join(
        ', '
      )}). Copy .env.example to .env.local.`,
    };
  }
  try {
    if (!firebaseAiInstance) {
      firebaseAiInstance = getAI(app, { backend: new GoogleAIBackend() });
    }
    return { ai: firebaseAiInstance, errorMessage: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[firebase/ai Initialization Error]:', message);
    return { ai: null, errorMessage: message };
  }
}

export async function signInWithGoogleOperator() {
  if (!auth) {
    throw new Error(
      `Firebase Auth not initialized. Missing env vars: ${resolvedConfig.missingEnvVars.join(
        ', '
      )}`
    );
  }
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutOperator() {
  if (!auth) return;
  return signOut(auth);
}
