'use client';

import React, { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import {
  SupportedLocale,
  SUPPORTED_LANGUAGES,
  scrubPii,
} from '@/lib/adaptive-router';

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface VoiceDiagnosticsButtonProps {
  selectedLocale: SupportedLocale;
  onVoiceTranscriptReady: (
    sanitizedTranscript: string,
    rawTranscript: string,
    redactionCount: number,
    bcp47Locale: string
  ) => void;
}

export default function VoiceDiagnosticsButton({
  selectedLocale,
  onVoiceTranscriptReady,
}: VoiceDiagnosticsButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const langMeta = SUPPORTED_LANGUAGES[selectedLocale];

  const handleDeliveredTranscript = (rawText: string, sourceLabel: string) => {
    const pii = scrubPii(rawText);
    setStatusMessage(
      `${sourceLabel} (${langMeta.bcp47}) · Scrubbed ${pii.redactionCount} PII token(s)`
    );
    onVoiceTranscriptReady(
      pii.sanitizedText,
      rawText,
      pii.redactionCount,
      langMeta.bcp47
    );
  };

  const togglePushToTalk = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecConstructor =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecConstructor) {
      handleDeliveredTranscript(
        langMeta.voiceSimulationTranscript,
        'No Mic Hardware (Loaded Reference Voice Transcript)'
      );
      return;
    }

    try {
      const recognition = new SpeechRecConstructor();
      recognition.lang = langMeta.bcp47;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
          handleDeliveredTranscript(transcript, 'Web Speech API');
        } else {
          handleDeliveredTranscript(
            langMeta.voiceSimulationTranscript,
            'Reference Voice Transcript'
          );
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        handleDeliveredTranscript(
          langMeta.voiceSimulationTranscript,
          'Mic Unavailable (Loaded Reference Voice Transcript)'
        );
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      setStatusMessage(
        `Listening on ${langMeta.bcp47} (${langMeta.nativeName})...`
      );
      recognition.start();
    } catch {
      setIsListening(false);
      handleDeliveredTranscript(
        langMeta.voiceSimulationTranscript,
        'Mic Unavailable (Loaded Reference Voice Transcript)'
      );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={togglePushToTalk}
        aria-label={`Push-to-Talk Voice Diagnostics (${langMeta.bcp47})`}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
          isListening
            ? 'bg-rose-600 text-white border-rose-500'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
        }`}
      >
        {isListening ? (
          <MicOff className="w-3.5 h-3.5" />
        ) : (
          <Mic className="w-3.5 h-3.5 text-cyan-400" />
        )}
        <span>
          {isListening
            ? `Stop Mic (${langMeta.bcp47})`
            : `Push-to-Talk (${langMeta.bcp47})`}
        </span>
      </button>

      {statusMessage && (
        <span className="text-xs font-mono text-cyan-400 truncate max-w-xs">
          {statusMessage}
        </span>
      )}
    </div>
  );
}
