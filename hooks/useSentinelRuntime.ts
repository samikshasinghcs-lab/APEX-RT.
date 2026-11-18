'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ExperimentArm } from '@/lib/adaptive-router';
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
    currentUser,setCurrentUser,firestoreOnline,appCheckLabel,remoteConfigSource,
    firebaseAiReady,nanoAvailability,nanoDownloadPct,setNanoDownloadPct,
    experimentArm,setExperimentArm,simulateOfflineMode,setSimulateOfflineMode,
    offlineQueueItems,setOfflineQueueItems,isFirebaseConfigured,
  };
}
