"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

interface MicrophoneButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function MicrophoneButton({ onTranscript, className }: MicrophoneButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + " ";
            }
          }
          if (currentTranscript) {
            onTranscriptRef.current(currentTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
          try {
            recognition.stop();
          } catch (e) {}
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Wait for mount to determine support to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      aria-label={isListening ? "Stop listening" : "Start listening"}
      className={`p-2 rounded-full transition-colors focus-visible:ring-2 ${
        isListening
          ? "bg-red-500 text-white animate-pulse"
          : "bg-surface-raised text-text-secondary hover:bg-border"
      } ${className}`}
    >
      {isListening ? <Mic size={20} /> : <MicOff size={20} />}
    </button>
  );
}
