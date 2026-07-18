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

  if (!isSupported && typeof window !== "undefined") {
    // Wait for mount to determine support to avoid hydration mismatch,
    // but initially we shouldn't render anything if it's not supported.
    // Actually, on server, we can return a disabled button or just wait.
  }

  // To avoid hydration mismatch, we might just render it disabled initially if we wanted,
  // but let's just conditionally render it if it's supported.
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
        isListening ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      } ${className}`}
    >
      {isListening ? <Mic size={20} /> : <MicOff size={20} />}
    </button>
  );
}
