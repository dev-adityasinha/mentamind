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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
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
            onTranscript(currentTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          // If we want it to keep listening while isListening is true, we could restart
          // but for this MVP we'll just stop
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  if (!recognitionRef.current && typeof window !== "undefined") {
    return null; // Browser doesn't support speech recognition
  }

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
