import { useState, useEffect, useRef, useCallback } from 'react';

// Declaration for Web Speech API window objects
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function useSpeechRecognition(initialLanguage: 'hi-IN' | 'en-IN' = 'hi-IN') {
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState<'hi-IN' | 'en-IN'>(initialLanguage);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalResult = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalResult += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalResult) {
          setTranscript((prev) => (prev ? `${prev.trim()} ${finalResult.trim()}` : finalResult.trim()));
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission blocked. You can type symptoms or tap quick symptom chips below.');
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was silent
        } else {
          setError(`Speech input status: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      console.warn('SpeechRecognition initialization error:', err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [language]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      setError('Web Speech API is not supported in this browser. Please type symptoms directly.');
      return;
    }
    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
    } catch (err: any) {
      // In case start was called when already active
      console.warn('Could not start recognition:', err);
    }
  }, [language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    language,
    setLanguage,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening
  };
}
