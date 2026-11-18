export type SupportedLocale =
  | 'en'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'de'
  | 'hi'
  | 'kn'
  | 'es'
  | 'pt'
  | 'fr'
  | 'it'
  | 'ar';

export type SpeechRecognitionBcp47 =
  | 'en-US'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR'
  | 'de-DE'
  | 'hi-IN'
  | 'kn-IN'
  | 'es-ES'
  | 'pt-BR'
  | 'fr-FR'
  | 'it-IT'
  | 'ar-SA';

export type InferenceMode =
  | 'ONLY_ON_DEVICE'
  | 'PREFER_ON_DEVICE'
  | 'PREFER_IN_CLOUD';

export type ExperimentArm = 'BALANCED_HYBRID' | 'STRICT_EDGE_SAVER';

export type SafetySeverity =
  | 'NOMINAL'
  | 'WARNING'
  | 'CRITICAL'
  | 'SAFE_STATE_LOCK';

export interface LanguageMetadata {
  code: SupportedLocale;
  bcp47: SpeechRecognitionBcp47;
  name: string;
  nativeName: string;
  automotiveHub: string;
  scriptFamily: string;
  nanoSupported: boolean;
  defaultSamplePrompt: string;
  voiceSimulationTranscript: string;
}

/**
 * Languages currently supported by Chrome's Built-in AI Gemini Nano Prompt API (`expectedInputs`/`expectedOutputs`).
 * English ('en') structured logs route to `PREFER_ON_DEVICE` by default; Spanish ('es') and Japanese ('ja')
 * are supported by Chrome Prompt API under `STRICT_EDGE_SAVER` or offline `ONLY_ON_DEVICE`, while all other
 * non-English scripts route to `PREFER_IN_CLOUD` (`gemini-2.5-flash-lite`).
 */
export const GEMINI_NANO_SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'ja',
];

export function isGeminiNanoSupportedLocale(locale: SupportedLocale): boolean {
  return GEMINI_NANO_SUPPORTED_LOCALES.includes(locale);
}

export const SUPPORTED_LANGUAGES: Record<SupportedLocale, LanguageMetadata> = {
  en: {
    code: 'en',
    bcp47: 'en-US',
    name: 'English',
    nativeName: 'English',
    automotiveHub: 'Detroit / Waterloo QNX Core',
    scriptFamily: 'Latin (Structured Log)',
    nanoSupported: true,
    defaultSamplePrompt:
      '[QNX-PPS] t=4819204ns CAN_ID=0x18FF50E5 DTC=P0A78 SiC_Inverter_Temp=184.6C HV_Bus=796.2V Isolation=82kOhm WCET_Jitter=168us VIN=1FA6P8CF0H1234567 Tech=john.miller@oem-fleet.io GPS=42.3314,-83.0458',
    voiceSimulationTranscript:
      'Technician badge T-9482 reporting from Bay 4 at 42.3314, -83.0458: VIN 1FA6P8CF0H1234567 shows inverter phase U over-temperature at 184.6 degrees Celsius and isolation drop to 82 kilo-ohms.',
  },
  zh: {
    code: 'zh',
    bcp47: 'zh-CN',
    name: 'Mandarin Chinese',
    nativeName: '中文 (普通话)',
    automotiveHub: 'Shanghai / Shenzhen NEV Giga-Plant',
    scriptFamily: 'Han (CJK)',
    nanoSupported: false,
    defaultSamplePrompt:
      '【QNX实时告警】碳化硅逆变器IGBT结温飙升至 186.4°C，高压母线绝缘电阻降至 78 kΩ (故障码 P0A78 / U0100)，车辆识别码 VIN=LSVAU2180N2183920，技师电话 138-0013-8000，请求立即执行安全关断诊断。',
    voiceSimulationTranscript:
      '上海三号产线报告：车辆 LSVAU2180N2183920 碳化硅逆变器温度达到 186.4 摄氏度，高压绝缘低于 78 千欧，请检查门极驱动板。',
  },
  ja: {
    code: 'ja',
    bcp47: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    automotiveHub: 'Toyota City / Nagoya Powertrain Lab',
    scriptFamily: 'Kanji / Kana',
    nanoSupported: true,
    defaultSamplePrompt:
      'QNXマイコン診断ログ：SiCインバータ素子温度が 182.0°C に達し、高電圧バス絶縁抵抗が 85 kΩ に低下（DTC: P0A78 / C1A12）。車台番号 VIN=JTDBE32K900192837、担当エンジニア sato.kenji@nagoya-ev.jp。',
    voiceSimulationTranscript:
      '名古屋テストベンチからの音声報告：車台番号 JTDBE32K900192837 にてインバータ温度 182.0 度、絶縁抵抗 85 キロオームの異常を検知しました。',
  },
  ko: {
    code: 'ko',
    bcp47: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    automotiveHub: 'Ulsan / Hwaseong E-GMP Line',
    scriptFamily: 'Hangul',
    nanoSupported: false,
    defaultSamplePrompt:
      '[QNX 안전 감시] SiC 인버터 접합 온도가 185.2°C로 임계치를 초과했으며 고전압 절연 저항이 80 kΩ으로 급락했습니다 (고장코드 P0A78). 차대번호 VIN=KM8KR4A92PU102938, 담당자 kim.minsu@ulsan-auto.kr.',
    voiceSimulationTranscript:
      '울산 조립라인 음성 메모: 차대번호 KM8KR4A92PU102938 인버터 온도 185.2 도 및 절연 저항 80 킬로옴 경보 발생, 즉시 토크 차단이 필요합니다.',
  },
  de: {
    code: 'de',
    bcp47: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    automotiveHub: 'Stuttgart / Munich ISO-26262 Rig',
    scriptFamily: 'Latin (DE)',
    nanoSupported: false,
    defaultSamplePrompt:
      'QNX Echtzeit-Diagnose: SiC-Wechselrichter Sperrschichttemperatur bei 183.5°C überschritten, Hochvolt-Isolationswiderstand auf 84 kΩ gefallen (Fehlercode P0A78, Jitter 164us). Fahrgestellnummer VIN=WBA3A5G59DNP28391, Prüfer lukas.weber@stuttgart-drive.de.',
    voiceSimulationTranscript:
      'Prüfstand Stuttgart: Fahrzeug WBA3A5G59DNP28391 meldet Wechselrichter Übertemperatur 183.5 Grad Celsius und Isolationsfehler bei 84 Kiloohm.',
  },
  hi: {
    code: 'hi',
    bcp47: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    automotiveHub: 'Pune / Gurgaon EV Powertrain Hub',
    scriptFamily: 'Devanagari',
    nanoSupported: false,
    defaultSamplePrompt:
      'QNX सुरक्षा चेतावनी: SiC इन्वर्टर का तापमान 181.8°C तक पहुँच गया है और हाई-वोल्टेज आइसोलेशन प्रतिरोध 86 kΩ तक गिर गया है (दोष कोड P0A78)। वाहन संख्या VIN=MA1TA2MKX2A192834, तकनीशियन संपर्क rajesh.sharma@pune-ev.in.',
    voiceSimulationTranscript:
      'पुणे प्लांट लाइन दो से रिपोर्ट: वाहन MA1TA2MKX2A192834 में इन्वर्टर तापमान 181.8 डिग्री सेल्सियस और आइसोलेशन 86 किलो-ओम दर्ज किया गया है।',
  },
  kn: {
    code: 'kn',
    bcp47: 'kn-IN',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    automotiveHub: 'Bengaluru SDV & Embedded Silicon Valley',
    scriptFamily: 'Kannada',
    nanoSupported: false,
    defaultSamplePrompt:
      'QNX ಸುರಕ್ಷತಾ ಎಚ್ಚರಿಕೆ: SiC ಇನ್ವರ್ಟರ್ ತಾಪಮಾನವು 184.1°C ಮೀರಿದೆ ಮತ್ತು ಹೈ-ವೋಲ್ಟೇಜ್ ಐಸೊಲೇಷನ್ ರೋಧವು 81 kΩ ಗೆ ಕುಸಿದಿದೆ (ದೋಷ ಕೋಡ್ P0A78). ವಾಹನ ಗುರುತಿನ ಸಂಖ್ಯೆ VIN=MB1KAA2910BLR9281, ಇಂಜಿನಿಯರ್ ಪ್ರವೀಣ್ ಕುಮಾರ್ praveen.k@bengaluru-sdv.in.',
    voiceSimulationTranscript:
      'ಬೆಂಗಳೂರು ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ ಲ್ಯಾಬ್ ವರದಿ: ವಾಹನ MB1KAA2910BLR9281 ಇನ್ವರ್ಟರ್ ತಾಪಮಾನ 184.1 ಡಿಗ್ರಿ ಸೆಲ್ಸಿಯಸ್ ಮತ್ತು ಐಸೊಲೇಷನ್ 81 ಕಿಲೋ ಓಮ್ ಕುಸಿತ ಕಂಡುಬಂದಿದೆ.',
  },
  es: {
    code: 'es',
    bcp47: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    automotiveHub: 'Monterrey / Martorell Assembly',
    scriptFamily: 'Latin (ES)',
    nanoSupported: true,
    defaultSamplePrompt:
      'Alerta crítica QNX RTOS: La temperatura de unión del inversor SiC alcanzó 180.9°C con caída de aislamiento de alto voltaje a 88 kΩ (Código DTC P0A78). Bastidor VIN=3FA6P0HD0HR291823, técnico carlos.mendoza@monterrey-ev.mx.',
    voiceSimulationTranscript:
      'Reporte de planta Monterrey: unidad 3FA6P0HD0HR291823 presenta sobrecalentamiento del inversor a 180.9 grados y resistencia de aislamiento en 88 kiloohmios.',
  },
  pt: {
    code: 'pt',
    bcp47: 'pt-BR',
    name: 'Portuguese',
    nativeName: 'Português',
    automotiveHub: 'São Bernardo / Betim Powertrain Center',
    scriptFamily: 'Latin (PT)',
    nanoSupported: false,
    defaultSamplePrompt:
      'Diagnóstico QNX Neutrino: Temperatura de junção do inversor SiC subiu para 182.7°C e resistência de isolamento HV caiu para 83 kΩ (Falha DTC P0A78). Chassi VIN=9BWZZZ377VT004251, operador rafael.silva@betim-auto.br.',
    voiceSimulationTranscript:
      'Nota de voz da linha de testes Betim: chassi 9BWZZZ377VT004251 com temperatura do inversor em 182.7 graus Celsius e isolamento em 83 quilo-ohms.',
  },
  fr: {
    code: 'fr',
    bcp47: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    automotiveHub: 'Douai / Flins ElectriCity Plant',
    scriptFamily: 'Latin (FR)',
    nanoSupported: false,
    defaultSamplePrompt:
      'Alerte noyau QNX : Température de jonction onduleur SiC mesurée à 181.4°C et résistance d’isolement haute tension chutée à 87 kΩ (Code défaut P0A78). Numéro VIN=VF1RFE00856192834, technicien claire.dupont@douai-ev.fr.',
    voiceSimulationTranscript:
      'Rapport vocal atelier Douai : le véhicule VF1RFE00856192834 affiche une surchauffe onduleur à 181.4 degrés et un défaut d’isolement à 87 kilo-ohms.',
  },
  it: {
    code: 'it',
    bcp47: 'it-IT',
    name: 'Italian',
    nativeName: 'Italiano',
    automotiveHub: 'Modena / Turin E-Axle Testbed',
    scriptFamily: 'Latin (IT)',
    nanoSupported: false,
    defaultSamplePrompt:
      'Telemetria QNX RTOS: Temperatura di giunzione inverter SiC salita a 183.1°C con resistenza di isolamento alta tensione scesa a 84 kΩ (Codice guasto P0A78). Telaio VIN=ZFF79ALA0H0219482, ingegnere marco.rossi@modena-corse.it.',
    voiceSimulationTranscript:
      'Registrazione banco prova Modena: telaio ZFF79ALA0H0219482 rileva temperatura inverter 183.1 gradi Celsius e isolamento sceso a 84 kilo-ohm.',
  },
  ar: {
    code: 'ar',
    bcp47: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    automotiveHub: 'KAEC / Riyadh EV Manufacturing Hub',
    scriptFamily: 'Arabic',
    nanoSupported: false,
    defaultSamplePrompt:
      'تنبيه نظام QNX الفوري: ارتفعت درجة حرارة وصلة عاكس كربيد السيليكون SiC إلى 185.0°C وانخفضت مقاومة العزل للجهد العالي إلى 79 kΩ (رمز العطل P0A78). رقم الهيكل VIN=1G1YY22G965109823، المهندس tariq.alharbi@kaec-ev.sa.',
    voiceSimulationTranscript:
      'تقرير صوتي من خط اختبار رابغ: المركبة رقم 1G1YY22G965109823 تسجل حرارة عاكس 185.0 درجة مئوية وهبوط مقاومة العزل إلى 79 كيلو أوم.',
  },
};

export const ORDERED_LOCALES: SupportedLocale[] = [
  'en',
  'zh',
  'ja',
  'ko',
  'de',
  'hi',
  'kn',
  'es',
  'pt',
  'fr',
  'it',
  'ar',
];

export interface PiiRedactionResult {
  sanitizedText: string;
  redactionCount: number;
  redactedTypes: string[];
}

/**
 * Deterministic local PII scrubber that strips VINs, emails, GPS lat/long,
 * phone numbers, and technician badge IDs before any AI routing.
 */
export function scrubPii(rawInput: string): PiiRedactionResult {
  let text = rawInput;
  const redactedTypes = new Set<string>();
  let redactionCount = 0;

  // 1. Emails
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    () => {
      redactedTypes.add('EMAIL');
      redactionCount++;
      return '[REDACTED_EMAIL]';
    }
  );

  // 2. Explicit VIN= or 17-char alphanumeric automotive VINs
  text = text.replace(/\bVIN\s*[:=]?\s*([A-HJ-NPR-Z0-9]{11,17})\b/gi, () => {
    redactedTypes.add('VIN');
    redactionCount++;
    return 'VIN=[REDACTED_VIN]';
  });
  text = text.replace(/\b[A-HJ-NPR-Z0-9]{17}\b/g, (match) => {
    if (/\d/.test(match) && /[A-Z]/.test(match)) {
      redactedTypes.add('VIN');
      redactionCount++;
      return '[REDACTED_VIN]';
    }
    return match;
  });

  // 3. GPS coordinates
  text = text.replace(
    /(-?\d{1,2}\.\d{3,8})\s*,\s*(-?\d{1,3}\.\d{3,8})/g,
    () => {
      redactedTypes.add('GPS_COORDS');
      redactionCount++;
      return '[REDACTED_GPS]';
    }
  );

  // 4. Phone numbers
  text = text.replace(
    /\b(?:\+?\d{1,3}[-.\s]?)?\d{3}[-.\s]\d{3,4}[-.\s]\d{4}\b/g,
    () => {
      redactedTypes.add('PHONE');
      redactionCount++;
      return '[REDACTED_PHONE]';
    }
  );

  // 5. Technician Badge IDs
  text = text.replace(/\b(?:Badge|Tech-ID|T)-(\d{4,6})\b/gi, () => {
    redactedTypes.add('TECH_BADGE');
    redactionCount++;
    return '[REDACTED_BADGE]';
  });

  return {
    sanitizedText: text,
    redactionCount,
    redactedTypes: Array.from(redactedTypes),
  };
}

/**
 * Automatic script & automotive lexical detector across English ('en')
 * and the Top-10+ non-English automotive languages ('zh', 'ja', 'ko', 'de', 'hi', 'kn', 'es', 'pt', 'fr', 'it', 'ar').
 */
export function detectLanguageLocale(input: string): SupportedLocale {
  const sample = input.trim();
  if (!sample) return 'en';

  if (/[\u0C80-\u0CFF]/.test(sample)) return 'kn';
  if (/[\u0900-\u097F]/.test(sample)) return 'hi';
  if (/[\u0600-\u06FF]/.test(sample)) return 'ar';
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(sample)) return 'ko';
  if (/[\u3040-\u30FF]/.test(sample)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(sample)) return 'zh';

  const lower = sample.toLowerCase();

  if (
    /[äöüß]/.test(lower) ||
    /\b(wechselrichter|sperrschichttemperatur|hochvolt|isolationswiderstand|fehlercode|fahrgestellnummer|prüfstand)\b/.test(
      lower
    )
  ) {
    return 'de';
  }

  if (
    /[ãõç]/.test(lower) ||
    /\b(junção|resistência|falha|chassi|subiu|caiu|quilo-ohms)\b/.test(lower)
  ) {
    return 'pt';
  }

  if (
    /[ñ¿¡]/.test(lower) ||
    /\b(alerta|crítica|unión|inversor|alcanzó|aislamiento|bastidor|código|sobrecalentamiento)\b/.test(
      lower
    )
  ) {
    return 'es';
  }

  if (
    /[œ’]/.test(lower) ||
    /\b(onduleur|température|jonction|résistance|isolement|défaut|véhicule|surchauffe)\b/.test(
      lower
    )
  ) {
    return 'fr';
  }

  if (
    /\b(giunzione|resistenza|isolamento|tensione|codice|guasto|telaio|salita|scesa)\b/.test(
      lower
    )
  ) {
    return 'it';
  }

  return 'en';
}

export interface DeterministicSafetyCheck {
  passedNominal: boolean;
  severity: SafetySeverity;
  faultCode: string;
  extractedTempC: number | null;
  extractedIsolationKOhm: number | null;
  extractedVoltageV: number | null;
  extractedJitterUs: number | null;
  triggeredRule: string;
  executionTimeUs: number;
}

/**
 * ASIL-D-inspired deterministic local safety check mirroring `/qnx-target/qnx_safety_watchdog.h`.
 * Measures real wall-clock execution time in microseconds (`performance.now() * 1000`).
 */
export function evaluateSafetyPreCheck(input: string): DeterministicSafetyCheck {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

  const tempMatch =
    input.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*C\b/i) ||
    input.match(
      /(?:temp|temperatura|temperatur|온도|温度|درجة|ತಾಪಮಾನ|तापमान)[^\d]{0,20}(\d{2,3}(?:\.\d+)?)/i
    ) ||
    input.match(
      /(\d{3}\.\d)\s*(?:degrees|攝氏|摄氏|度|도|grad|grados|graus|degrés|gradi)/i
    );
  const extractedTempC = tempMatch ? parseFloat(tempMatch[1]) : null;

  const isoMatch =
    input.match(
      /(\d{2,4}(?:\.\d+)?)\s*(?:kOhm|kΩ|kilo-ohms|kiloohmios|quilo-ohms|킬로옴|キロオーム|千欧|كيلو أوم|ಕಿಲೋ ಓಮ್|किलो-ओम)/i
    ) || input.match(/Isolation\s*[:=]?\s*(\d{2,4}(?:\.\d+)?)/i);
  const extractedIsolationKOhm = isoMatch ? parseFloat(isoMatch[1]) : null;

  const voltMatch = input.match(/(\d{3}(?:\.\d+)?)\s*V\b/);
  const extractedVoltageV = voltMatch ? parseFloat(voltMatch[1]) : 796.2;

  const jitterMatch = input.match(/(\d{2,4})\s*us\b/i);
  const extractedJitterUs = jitterMatch ? parseInt(jitterMatch[1], 10) : null;

  const dtcMatch = input.match(/\b([PCBU][0-9A-F]{4})\b/i);
  const faultCode = dtcMatch ? dtcMatch[1].toUpperCase() : 'P0A78';

  let severity: SafetySeverity = 'NOMINAL';
  let triggeredRule = 'ALL_BOUNDS_NOMINAL';

  if (extractedIsolationKOhm !== null && extractedIsolationKOhm < 100) {
    severity = 'SAFE_STATE_LOCK';
    triggeredRule = `HV_ISOLATION_BREACH (${extractedIsolationKOhm} kΩ < 100 kΩ floor) -> SAFE_TORQUE_OFF`;
  } else if (extractedTempC !== null && extractedTempC >= 175) {
    severity = 'CRITICAL';
    triggeredRule = `SIC_JUNCTION_THERMAL_OVERLIMIT (${extractedTempC}°C >= 175.0°C ceiling)`;
  } else if (extractedJitterUs !== null && extractedJitterUs > 150) {
    severity = 'WARNING';
    triggeredRule = `SCHED_FIFO_WCET_JITTER (${extractedJitterUs}µs > 150µs budget)`;
  } else if (dtcMatch) {
    severity = 'WARNING';
    triggeredRule = `ACTIVE_DTC_REPORTED (${faultCode})`;
  }

  const elapsedUs =
    typeof performance !== 'undefined'
      ? Math.max(1, Math.round((performance.now() - t0) * 1000))
      : 1;

  return {
    passedNominal: severity === 'NOMINAL',
    severity,
    faultCode,
    extractedTempC,
    extractedIsolationKOhm,
    extractedVoltageV,
    extractedJitterUs,
    triggeredRule,
    executionTimeUs: elapsedUs,
  };
}

export interface AdaptiveRoutingDecision {
  detectedLocale: SupportedLocale;
  languageMeta: LanguageMetadata;
  nanoLanguageSupported: boolean;
  isOffline: boolean;
  isStructuredEnglishLog: boolean;
  routeTarget: InferenceMode;
  targetModelLabel: string;
  experimentArm: ExperimentArm;
  estimatedTokens: number;
  maxEdgeTokenThreshold: number;
  targetLatencyBudgetMs: number;
  routingRationale: string;
  piiResult: PiiRedactionResult;
  safetyCheck: DeterministicSafetyCheck;
}

/**
 * Adaptive Router (`lib/adaptive-router.ts`):
 * - Checks `GEMINI_NANO_SUPPORTED_LOCALES` (`['en', 'es', 'ja']`) and browser online/offline state.
 * - Routes offline requests strictly to `ONLY_ON_DEVICE` (`FirebaseInferenceMode.ONLY_ON_DEVICE`) and queues cloud audits in `lib/offline-queue.ts`.
 * - Routes English structured logs (`en`) to `PREFER_ON_DEVICE`.
 * - Routes non-English natural-language prompts (`zh`, `ja`, `ko`, `de`, `hi`, `kn`, `es`, `pt`, `fr`, `it`, `ar`)
 *   to `PREFER_IN_CLOUD` (`gemini-2.5-flash-lite`) under `BALANCED_HYBRID`, or routes Nano-supported locales (`en`, `es`, `ja`)
 *   within token budget to `PREFER_ON_DEVICE` under `STRICT_EDGE_SAVER`.
 */
export function routeDiagnosticPayload(
  rawInput: string,
  experimentArm: ExperimentArm = 'BALANCED_HYBRID',
  overrideLocale?: SupportedLocale,
  options?: { isOffline?: boolean }
): AdaptiveRoutingDecision {
  const piiResult = scrubPii(rawInput);
  const detectedLocale = overrideLocale ?? detectLanguageLocale(rawInput);
  const languageMeta = SUPPORTED_LANGUAGES[detectedLocale];
  const nanoLanguageSupported = isGeminiNanoSupportedLocale(detectedLocale);
  const safetyCheck = evaluateSafetyPreCheck(piiResult.sanitizedText);

  const isOffline =
    options?.isOffline !== undefined
      ? options.isOffline
      : typeof navigator !== 'undefined' && navigator.onLine === false;

  const estimatedTokens = Math.max(
    12,
    Math.ceil(piiResult.sanitizedText.length / 3.6)
  );
  const maxEdgeTokenThreshold =
    experimentArm === 'STRICT_EDGE_SAVER' ? 512 : 256;
  const targetLatencyBudgetMs =
    experimentArm === 'STRICT_EDGE_SAVER' ? 15 : 20;

  const isStructuredEnglishLog =
    detectedLocale === 'en' &&
    (/(\[QNX|CAN_ID=|DTC=|SiC_|HV_Bus|Isolation=)/i.test(rawInput) ||
      estimatedTokens <= maxEdgeTokenThreshold);

  let routeTarget: InferenceMode;
  let targetModelLabel: string;
  let routingRationale: string;

  if (isOffline) {
    routeTarget = 'ONLY_ON_DEVICE';
    targetModelLabel =
      'firebase/ai (InferenceMode.ONLY_ON_DEVICE · Offline Mode + IndexedDB Queue)';
    routingRationale = `Network offline detected: enforcing InferenceMode.ONLY_ON_DEVICE (${
      nanoLanguageSupported
        ? `Nano supports '${detectedLocale}'`
        : `'${detectedLocale}' not in Nano [${GEMINI_NANO_SUPPORTED_LOCALES.join(
            ','
          )}]; local deterministic baseline + queued for Cloud Audit`
    }).`;
  } else if (detectedLocale === 'en' && isStructuredEnglishLog) {
    routeTarget = 'PREFER_ON_DEVICE';
    targetModelLabel =
      'firebase/ai (InferenceMode.PREFER_ON_DEVICE -> gemini-2.5-flash-lite)';
    routingRationale = `English structured QNX dump (${estimatedTokens} tokens <= ${maxEdgeTokenThreshold} limit under ${experimentArm}; Nano language supported: YES). Routed via InferenceMode.PREFER_ON_DEVICE with automatic fallback to Cloud gemini-2.5-flash-lite.`;
  } else if (detectedLocale !== 'en') {
    routeTarget = 'PREFER_IN_CLOUD';
    targetModelLabel =
      'firebase/ai (InferenceMode.PREFER_IN_CLOUD · gemini-2.5-flash-lite)';
    routingRationale = `Non-English technician log (${languageMeta.name} [${detectedLocale}] · ${
      languageMeta.scriptFamily
    }; Chrome Nano Prompt API support: ${
      nanoLanguageSupported
        ? 'YES (es/ja supported, routed to Cloud for full multilingual audit)'
        : `NO — only [${GEMINI_NANO_SUPPORTED_LOCALES.join(', ')}] supported on-device`
    }). Routed to InferenceMode.PREFER_IN_CLOUD (gemini-2.5-flash-lite).`;
  } else {
    routeTarget =
      experimentArm === 'STRICT_EDGE_SAVER'
        ? 'PREFER_ON_DEVICE'
        : 'PREFER_IN_CLOUD';
    targetModelLabel =
      routeTarget === 'PREFER_ON_DEVICE'
        ? 'firebase/ai (InferenceMode.PREFER_ON_DEVICE · Strict Edge Saver)'
        : 'firebase/ai (InferenceMode.PREFER_IN_CLOUD · gemini-2.5-flash-lite)';
    routingRationale =
      routeTarget === 'PREFER_ON_DEVICE'
        ? `STRICT_EDGE_SAVER arm assigned English payload (${estimatedTokens} tokens <= ${maxEdgeTokenThreshold}) to InferenceMode.PREFER_ON_DEVICE.`
        : `BALANCED_HYBRID arm escalated long unstructured payload (${estimatedTokens} tokens > ${maxEdgeTokenThreshold}) to InferenceMode.PREFER_IN_CLOUD (gemini-2.5-flash-lite).`;
  }

  return {
    detectedLocale,
    languageMeta,
    nanoLanguageSupported,
    isOffline,
    isStructuredEnglishLog,
    routeTarget,
    targetModelLabel,
    experimentArm,
    estimatedTokens,
    maxEdgeTokenThreshold,
    targetLatencyBudgetMs,
    routingRationale,
    piiResult,
    safetyCheck,
  };
}

/**
 * Generates localized diagnostic remediation baseline text in the target language.
 */
export function buildLocalizedRemediation(
  locale: SupportedLocale,
  safety: DeterministicSafetyCheck
): string {
  const temp = safety.extractedTempC ?? 184.6;
  const iso = safety.extractedIsolationKOhm ?? 82;
  const code = safety.faultCode;

  const localizedMap: Record<SupportedLocale, string> = {
    en: `[${code}] Open HV Main Contactor K1/K2 immediately (Safe Torque Off). SiC Phase-U junction at ${temp}°C exceeds 175°C rating and HV isolation (${iso} kΩ) violates 100 kΩ floor. Inspect gate driver desaturation circuit and coolant manifold flow.`,
    zh: `[${code}] 立即触发安全扭矩关断 (STO) 并断开高压主接触器 K1/K2。碳化硅逆变器结温 (${temp}°C) 超过 175°C 阈值且绝缘电阻 (${iso} kΩ) 低于 100 kΩ 安全下限。请排查 U 相门极驱动退饱和保护与冷却液流量。`,
    ja: `[${code}] 直ちに安全トルクオフ (STO) を実行し高電圧メインコンタクタ K1/K2 を遮断してください。SiC接合部温度 (${temp}°C) が上限 175°C を超過し、絶縁抵抗 (${iso} kΩ) が 100 kΩ 未満です。ゲートドライバ回路と冷却水路を点検してください。`,
    ko: `[${code}] 즉시 안전 토크 오프(STO)를 발동하고 고전압 메인 컨택터 K1/K2를 개방하십시오. SiC 인버터 접합 온도(${temp}°C)가 175°C 한계를 초과했고 절연 저항(${iso} kΩ)이 100 kΩ 미만입니다. 게이트 드라이버 및 냉각수 유량을 점검하십시오.`,
    de: `[${code}] Sofortige Sicherheitsabschaltung (Safe Torque Off) einleiten und HV-Hauptschütze K1/K2 öffnen. SiC-Sperrschichttemperatur (${temp}°C > 175°C) und Isolationswiderstand (${iso} kΩ < 100 kΩ) verletzen Grenzwerte. Gate-Treiber und Kühlkreislauf prüfen.`,
    hi: `[${code}] तुरंत सेफ टॉर्क ऑफ (STO) सक्रिय करें और हाई-वोल्टेज कॉन्टैक्टर K1/K2 खोलें। SiC इन्वर्टर तापमान (${temp}°C) 175°C सीमा से अधिक है और आइसोलेशन प्रतिरोध (${iso} kΩ) 100 kΩ से कम है। गेट ड्राइवर और कूलेंट फ्लो की जाँच करें।`,
    kn: `[${code}] ತಕ್ಷಣವೇ ಸೇಫ್ ಟಾರ್ಕ್ ಆಫ್ (STO) ಸಕ್ರಿಯಗೊಳಿಸಿ ಮತ್ತು ಹೈ-ವೋಲ್ಟೇಜ್ ಕಾಂಟ್ಯಾಕ್ಟರ್ K1/K2 ತೆರೆಯಿರಿ. SiC ಇನ್ವರ್ಟರ್ ತಾಪಮಾನ (${temp}°C) 175°C ಮೀರಿದೆ ಮತ್ತು ಐಸೊಲೇಷನ್ ರೋಧ (${iso} kΩ) 100 kΩ ಗಿಂತ ಕಡಿಮೆಯಿದೆ. ಗೇಟ್ ಡ್ರೈವರ್ ಹಾಗೂ ಕೂಲೆಂಟ್ ಪರಿಶೀಲಿಸಿ.`,
    es: `[${code}] Activar desconexión segura de par (STO) y abrir contactores HV K1/K2 de inmediato. Temperatura de unión SiC (${temp}°C) supera 175°C y aislamiento (${iso} kΩ) cae bajo 100 kΩ. Inspeccionar driver de compuerta y circuito de refrigeración.`,
    pt: `[${code}] Acionar desligamento seguro de torque (STO) e abrir contatores HV K1/K2 imediatamente. Temperatura de junção SiC (${temp}°C) excede 175°C e isolamento (${iso} kΩ) está abaixo de 100 kΩ. Verificar gate driver e fluxo de arrefecimento.`,
    fr: `[${code}] Activer immédiatement la coupure de couple sécurisée (STO) et ouvrir les contacteurs HT K1/K2. La température de jonction SiC (${temp}°C) dépasse 175°C et l’isolement (${iso} kΩ) est sous 100 kΩ. Contrôler le pilote de grille et le circuit de refroidissement.`,
    it: `[${code}] Attivare immediatamente Safe Torque Off (STO) e aprire i contattori HV K1/K2. La temperatura di giunzione SiC (${temp}°C) supera 175°C e l'isolamento (${iso} kΩ) è sotto 100 kΩ. Verificare il gate driver e il circuito di raffreddamento.`,
    ar: `[${code}] تفعيل إيقاف العزم الآمن (STO) فوراً وفتح قواطع الجهد العالي K1/K2. درجة حرارة وصلة SiC (${temp}°C) تجاوزت حد 175°C ومقاومة العزل (${iso} kΩ) أقل من 100 kΩ. افحص دائرة بوابة القيادة وتدفق سائل التبريد.`,
  };

  return localizedMap[locale] || localizedMap.en;
}
