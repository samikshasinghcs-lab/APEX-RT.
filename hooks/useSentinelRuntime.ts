'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ExperimentArm, SupportedLocale, AdaptiveRoutingDecision, SUPPORTED_LANGUAGES, routeDiagnosticPayload, buildLocalizedRemediation } from '@/lib/adaptive-router';
import { ConsensusGateResult } from '@/lib/firebase-ai-hybrid';
import { NanoHardwareAvailability, probeGeminiNanoAvailability } from '@/lib/firebase-ai-hybrid';
import { OfflineForensicQueueItem, getOfflineQueue } from '@/lib/offline-queue';
import {
  auth, isFirebaseConfigured, testFirestoreConnection, initSentinelAppCheck,
  initSentinelRemoteConfig, getSentinelFirebaseAI,
} from '@/lib/firebase-client';

export function useSentinelRuntime() {
  const [currentUser,setCurrentUser]=useState<User|null>(null);
  const [firestoreOnline,setFirestoreOnline]=useState(false);
  const [appCheckLabel,setAppCheckLabel]=useState('INITIALIZING');
  const [remoteConfigSource,setRemoteConfigSource]=useState('default');
  const [firebaseAiReady,setFirebaseAiReady]=useState(false);
  const [nanoAvailability,setNanoAvailability]=useState<NanoHardwareAvailability>('UNAVAILABLE_ON_HOST');
  const [nanoDownloadPct,setNanoDownloadPct]=useState<number|null>(null);
  const [experimentArm,setExperimentArm]=useState<ExperimentArm>('BALANCED_HYBRID');
  const [simulateOfflineMode,setSimulateOfflineMode]=useState(false);
  const [offlineQueueItems,setOfflineQueueItems]=useState<OfflineForensicQueueItem[]>([]);
  // Inference routing state
  const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>('en');
  const [rawTelemetryInput, setRawTelemetryInput] = useState<string>(
    SUPPORTED_LANGUAGES.en.defaultSamplePrompt
  );
  const [routingDecision, setRoutingDecision] =
    useState<AdaptiveRoutingDecision>(() =>
      routeDiagnosticPayload(
        SUPPORTED_LANGUAGES.en.defaultSamplePrompt,
        'BALANCED_HYBRID',
        'en',
        { isOffline: false }
      )
    );

  // Consensus gate state "Edge-First, Cloud-Audit" Consensus Gate (Starts in honest NOT_RUN_YET state — no hardcoded 100% consensus)
  const [consensusResult, setConsensusResult] = useState<ConsensusGateResult>(
    () => {
      const initialDecision = routeDiagnosticPayload(
        SUPPORTED_LANGUAGES.en.defaultSamplePrompt,
        'BALANCED_HYBRID',
        'en',
        { isOffline: false }
      );
      return {
        deterministicBaseline: initialDecision.safetyCheck,
        edgeTriage: {
          engineName: 'Not Executed Yet (Awaiting firebase/ai Run)',
          requestedMode: 'PREFER_ON_DEVICE',
          actualSource: 'MODEL_UNAVAILABLE',
          inferenceSourceBadge: 'NONE',
          nanoAvailability: 'UNAVAILABLE_ON_HOST',
          nanoDownloadProgressPct: null,
          ttftMs: null,
          totalLatencyMs: null,
          faultCode: null,
          severity: null,
          extractedTempC: null,
          extractedIsolationKOhm: null,
          summary:
            'Run triage to generate Stage 1 findings.',
          transparencyNote:
            'Model analysis has not started. The deterministic safety check is available in the baseline panel.',
          errorMessage: null,
        },
        cloudAudit: {
          engineName: 'Not Executed Yet (Awaiting firebase/ai Run)',
          actualSource: 'MODEL_UNAVAILABLE',
          inferenceSourceBadge: 'NONE',
          ttftMs: null,
          totalLatencyMs: null,
          faultCode: null,
          severity: null,
          extractedTempC: null,
          extractedIsolationKOhm: null,
          localizedRemediation: null,
          auditNotes:
            'Run triage to generate the Stage 2 cloud audit.',
          errorMessage: null,
        },
        consensusScore: null,
        status: 'NOT_RUN_YET',
        discrepancies: [],
        finalSeverity: initialDecision.safetyCheck.severity,
        finalRemediation: `Deterministic safety-check baseline: ${buildLocalizedRemediation(
          'en',
          initialDecision.safetyCheck
        )}`,
        queuedOfflineItemId: null,
      };
    }
  );
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [preferOnDeviceCount, setPreferOnDeviceCount] = useState(0);
  const [preferInCloudCount, setPreferInCloudCount] = useState(0);



  useEffect(()=>{
    let active=true;
    const unsubscribe=auth?onAuthStateChanged(auth,user=>{if(active)setCurrentUser(user);}):()=>{};
    void (async()=>{
      const db=await testFirestoreConnection();
      if(!active)return;
      setFirestoreOnline(db.online);
      const appCheck=initSentinelAppCheck();
      setAppCheckLabel(appCheck.providerLabel);
      const remote=await initSentinelRemoteConfig();
      if(!active)return;
      setExperimentArm(remote.arm);
      setRemoteConfigSource(remote.source);
      const ai=getSentinelFirebaseAI();
      setFirebaseAiReady(Boolean(ai.ai));
      const nano=await probeGeminiNanoAvailability();
      if(!active)return;
      setNanoAvailability(nano);
      setOfflineQueueItems(getOfflineQueue());
    })().catch(()=>{});
    return()=>{active=false;unsubscribe();};
  },[]);

  return {
    currentUser,setCurrentUser,firestoreOnline,appCheckLabel,remoteConfigSource,setRemoteConfigSource,
    firebaseAiReady,nanoAvailability,nanoDownloadPct,setNanoDownloadPct,
    experimentArm,setExperimentArm,simulateOfflineMode,setSimulateOfflineMode,
    offlineQueueItems,setOfflineQueueItems,isFirebaseConfigured,
    selectedLocale,setSelectedLocale,rawTelemetryInput,setRawTelemetryInput,
    routingDecision,setRoutingDecision,consensusResult,setConsensusResult,isTriaging,setIsTriaging,
    preferOnDeviceCount,setPreferOnDeviceCount,preferInCloudCount,setPreferInCloudCount,
  };
}
