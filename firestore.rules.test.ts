import { describe, it, before, after } from 'node:test';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-qnx-sentinel-rules';
const VALID_HASH_A = 'a'.repeat(64);
const VALID_HASH_B = 'b'.repeat(64);

function parseEmulatorHostPort(): { host: string; port: number } {
  const envHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (envHost && envHost.includes(':')) {
    const [h, p] = envHost.split(':');
    return { host: h, port: Number(p) || 8188 };
  }
  return { host: '127.0.0.1', port: 8188 };
}

function checkPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function validBlackBoxPayload(
  ownerId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    ownerId,
    sequenceIndex: 0,
    eventType: 'CONSENSUS_AUDIT',
    summary: '[EN · PREFER_ON_DEVICE] DTC=P0A78 Severity=SAFE_STATE_LOCK',
    prevHash: VALID_HASH_A,
    entryHash: VALID_HASH_B,
    locale: 'en',
    routeTarget: 'PREFER_ON_DEVICE',
    consensusScore: 98,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function validDiagnosticAuditPayload(
  ownerId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    ownerId,
    locale: 'en',
    experimentArm: 'BALANCED_HYBRID',
    routeTarget: 'PREFER_ON_DEVICE',
    faultCode: 'P0A78',
    severity: 'SAFE_STATE_LOCK',
    edgeTtftMs: 16.4,
    cloudTtftMs: 245.2,
    consensusScore: 98,
    remediation: 'Open HV Main Contactor K1/K2 immediately (Safe Torque Off).',
    status: 'OPEN',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('Firestore Security Rules — Dirty Dozen Adversarial Suite (@firebase/rules-unit-testing)', () => {
  let testEnv: RulesTestEnvironment | null = null;
  let emulatorAvailable = false;

  before(async () => {
    setLogLevel('error');
    const { host, port } = parseEmulatorHostPort();
    const isOpen = await checkPortOpen(host, port);
    if (!isOpen) {
      emulatorAvailable = false;
      return;
    }

    try {
      const rulesPath = path.join(process.cwd(), 'firestore.rules');
      const rules = fs.readFileSync(rulesPath, 'utf8');

      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          host,
          port,
          rules,
        },
      });
      emulatorAvailable = true;
    } catch {
      emulatorAvailable = false;
      testEnv = null;
    }
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it('Baseline Positive Paths: Verified owner can create & read valid BlackBoxEntry and DiagnosticAudit', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip(
        'Firestore Emulator not listening on 127.0.0.1:8188 — run `npx firebase emulators:exec --only firestore "npm test"`'
      );
      return;
    }
    await testEnv.clearFirestore();
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertSucceeds(
      setDoc(
        doc(db, 'black_box_entries', 'entry_valid_01'),
        validBlackBoxPayload('uid_alice')
      )
    );
    await assertSucceeds(getDoc(doc(db, 'black_box_entries', 'entry_valid_01')));

    await assertSucceeds(
      setDoc(
        doc(db, 'diagnostic_audits', 'audit_valid_01'),
        validDiagnosticAuditPayload('uid_alice')
      )
    );
  });

  it('Dirty Dozen #1: Unverified Email Spoof is rejected on create', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const unverifiedCtx = testEnv.authenticatedContext('uid_unverified', {
      email: 'spoof@oem-fleet.io',
      email_verified: false,
    });
    const db = unverifiedCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'entry_01'),
        validBlackBoxPayload('uid_unverified')
      )
    );
  });

  it('Dirty Dozen #2: Cross-User Identity Spoofing (ownerId != auth.uid) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const attackerCtx = testEnv.authenticatedContext('uid_attacker', {
      email: 'attacker@oem-fleet.io',
      email_verified: true,
    });
    const db = attackerCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'entry_02'),
        validBlackBoxPayload('uid_victim')
      )
    );
  });

  it('Dirty Dozen #3: Shadow Field Injection on Create is rejected by hasOnly schema check', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'entry_03'),
        validBlackBoxPayload('uid_alice', { isTampered: false })
      )
    );
  });

  it('Dirty Dozen #4: Malformed SHA-256 Digest (violating ^[a-f0-9]{64}$) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'entry_04'),
        validBlackBoxPayload('uid_alice', { entryHash: 'not-a-valid-sha256' })
      )
    );
  });

  it('Dirty Dozen #5: Immutable Ledger Mutation (update/delete on /black_box_entries) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'black_box_entries', 'entry_immutable'), {
        ...validBlackBoxPayload('uid_alice'),
        createdAt: Timestamp.now(),
      });
    });

    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      updateDoc(doc(db, 'black_box_entries', 'entry_immutable'), {
        summary: 'Rewritten history',
      })
    );
    await assertFails(deleteDoc(doc(db, 'black_box_entries', 'entry_immutable')));
  });

  it('Dirty Dozen #6: Path ID Poisoning (special chars in document ID) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'invalid$id!with*spaces'),
        validBlackBoxPayload('uid_alice')
      )
    );
  });

  it('Dirty Dozen #7: Denial-of-Wallet String Overflow (summary > 500 chars) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'black_box_entries', 'entry_05'),
        validBlackBoxPayload('uid_alice', { summary: 'X'.repeat(501) })
      )
    );
  });

  it('Dirty Dozen #8: Client-Forged Timestamp (createdAt != request.time) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      setDoc(
        doc(db, 'diagnostic_audits', 'audit_forged_time'),
        validDiagnosticAuditPayload('uid_alice', {
          createdAt: Timestamp.fromMillis(Date.now() - 86400_000),
        })
      )
    );
  });

  it('Dirty Dozen #9: Unauthorized List Scraping across other users is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'diagnostic_audits', 'audit_victim'), {
        ...validDiagnosticAuditPayload('uid_victim'),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });

    const attackerCtx = testEnv.authenticatedContext('uid_attacker', {
      email: 'attacker@oem-fleet.io',
      email_verified: true,
    });
    const db = attackerCtx.firestore();

    await assertFails(getDocs(collection(db, 'diagnostic_audits')));
    await assertFails(
      getDocs(
        query(
          collection(db, 'diagnostic_audits'),
          where('ownerId', '==', 'uid_victim')
        )
      )
    );
  });

  it('Dirty Dozen #10: Shadow Update on DiagnosticAudit (mutating consensusScore) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const nowTs = Timestamp.now();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'diagnostic_audits', 'audit_shadow_upd'), {
        ...validDiagnosticAuditPayload('uid_alice'),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    });

    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      updateDoc(doc(db, 'diagnostic_audits', 'audit_shadow_upd'), {
        consensusScore: 100,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Dirty Dozen #11: Terminal State Re-Opening (updating when status == RESOLVED) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const nowTs = Timestamp.now();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'diagnostic_audits', 'audit_resolved'), {
        ...validDiagnosticAuditPayload('uid_alice', { status: 'RESOLVED' }),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    });

    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      updateDoc(doc(db, 'diagnostic_audits', 'audit_resolved'), {
        status: 'OPEN',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('Dirty Dozen #12: Value Poisoning on Update (status not in allowlisted enum) is rejected', async (t) => {
    if (!emulatorAvailable || !testEnv) {
      t.skip('Firestore Emulator not listening on 127.0.0.1:8188');
      return;
    }
    const nowTs = Timestamp.now();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'diagnostic_audits', 'audit_enum_guard'), {
        ...validDiagnosticAuditPayload('uid_alice', { status: 'OPEN' }),
        createdAt: nowTs,
        updatedAt: nowTs,
      });
    });

    const aliceCtx = testEnv.authenticatedContext('uid_alice', {
      email: 'alice@oem-fleet.io',
      email_verified: true,
    });
    const db = aliceCtx.firestore();

    await assertFails(
      updateDoc(doc(db, 'diagnostic_audits', 'audit_enum_guard'), {
        status: 'INVALID_ENUM_STATE',
        updatedAt: serverTimestamp(),
      })
    );
  });
});
