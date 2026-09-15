// Only one field may own the microphone at a time.
let activeSession;

export function speechRecognitionConstructor(scope = globalThis) {
  if (scope.isSecureContext === false) return null;
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function startVoiceInput({ Recognition, language, onTranscript, onState }) {
  activeSession?.cancel();
  let recognition;
  let finished = false;
  let transcript = '';
  let timeout;
  const finish = (error, commit = false) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    if (activeSession === session) activeSession = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped. */ }
    }
    onState({ listening: false, error });
    if (commit && transcript) onTranscript(transcript);
  };
  const session = {
    cancel: () => finish(null),
    stop: () => {
      try { recognition?.stop(); } catch { finish('unknown'); }
    },
  };
  activeSession = session;
  onState({ listening: true, error: null });
  try {
    recognition = new Recognition();
    recognition.lang = language === 'en' ? 'en-GB' : 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      if (finished) return;
      // Results are a cumulative list. Rebuild instead of appending duplicates.
      transcript = Array.from(event.results)
        .filter(result => result.isFinal)
        .map(result => result[0]?.transcript || '')
        .join(' ').trim();
    };
    recognition.onerror = event => finish(event.error === 'aborted' ? null : event.error);
    recognition.onend = () => finish(transcript ? null : 'no-speech', true);
    timeout = setTimeout(() => finish('timeout'), 30000);
    recognition.start();
  } catch (error) {
    finish(error.name === 'NotAllowedError' ? 'not-allowed' : 'unknown');
  }
  return session;
}
