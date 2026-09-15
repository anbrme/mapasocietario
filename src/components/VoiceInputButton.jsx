import React from 'react';
import { Alert, IconButton, Snackbar, Tooltip } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import { speechRecognitionConstructor, startVoiceInput } from '../utils/voiceInput';

const COPY = {
  en: {
    start: 'Type by voice',
    stop: 'Stop listening',
    privacy: 'Your browser may send audio to its speech recognition provider.',
    listening: 'Listening… Speak, then pause. Your browser may send audio to its speech recognition provider.',
    denied: 'Microphone access was denied. Allow it in your browser settings or type instead.',
    microphone: 'No microphone is available. Connect one or type instead.',
    network: 'Voice recognition could not connect. Try again or type instead.',
    empty: 'No speech was detected. Try again or type instead.',
    language: 'Voice recognition is unavailable for this language. You can still type.',
    failed: 'Voice typing is unavailable right now. Try again or type instead.',
    timeout: 'Voice typing timed out. Try again or type instead.',
  },
  es: {
    start: 'Escribir por voz',
    stop: 'Dejar de escuchar',
    privacy: 'Tu navegador puede enviar el audio a su proveedor de reconocimiento de voz.',
    listening: 'Escuchando… Habla y luego haz una pausa. Tu navegador puede enviar el audio a su proveedor de reconocimiento de voz.',
    denied: 'Se ha denegado el acceso al micrófono. Permítelo en los ajustes del navegador o escribe.',
    microphone: 'No hay un micrófono disponible. Conecta uno o escribe.',
    network: 'No se pudo conectar el reconocimiento de voz. Inténtalo de nuevo o escribe.',
    empty: 'No se ha detectado voz. Inténtalo de nuevo o escribe.',
    language: 'El reconocimiento de voz no está disponible para este idioma. Puedes seguir escribiendo.',
    failed: 'La escritura por voz no está disponible ahora. Inténtalo de nuevo o escribe.',
    timeout: 'Se ha agotado el tiempo de escucha. Inténtalo de nuevo o escribe.',
  },
};

export default function VoiceInputButton({ language = 'es', value, onTranscript, disabled = false }) {
  const copy = COPY[language] || COPY.es;
  const [supported, setSupported] = React.useState(false);
  const [state, setState] = React.useState({ listening: false, error: null });
  const sessionRef = React.useRef(null);
  const callbackRef = React.useRef(onTranscript);
  callbackRef.current = onTranscript;

  React.useEffect(() => {
    setSupported(Boolean(speechRecognitionConstructor(window)));
    const cancelWhenHidden = () => {
      if (document.hidden) sessionRef.current?.cancel();
    };
    document.addEventListener('visibilitychange', cancelWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', cancelWhenHidden);
      sessionRef.current?.cancel();
    };
  }, []);

  // A typed edit, selection, language change, or disabled field supersedes speech.
  React.useEffect(() => {
    sessionRef.current?.cancel();
  }, [value, language, disabled]);

  if (!supported) return null;

  const errors = {
    'not-allowed': copy.denied,
    'service-not-allowed': copy.denied,
    'audio-capture': copy.microphone,
    network: copy.network,
    'no-speech': copy.empty,
    'language-not-supported': copy.language,
    timeout: copy.timeout,
  };
  const message = state.listening ? copy.listening : (errors[state.error] || copy.failed);

  return (
    <>
      <Tooltip title={state.listening ? copy.stop : `${copy.start}. ${copy.privacy}`}>
        <IconButton
          type="button"
          size="small"
          disabled={disabled}
          aria-label={state.listening ? copy.stop : copy.start}
          aria-pressed={state.listening}
          color={state.listening ? 'error' : 'default'}
          sx={{ flexShrink: 0, width: 36, height: 36 }}
          onMouseDown={event => event.preventDefault()}
          onKeyDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation();
            if (state.listening) {
              sessionRef.current?.stop();
              return;
            }
            const input = event.currentTarget.closest('.MuiInputBase-root')?.querySelector('input');
            input?.focus();
            sessionRef.current = startVoiceInput({
              Recognition: speechRecognitionConstructor(window),
              language,
              onState: setState,
              onTranscript: transcript => callbackRef.current(transcript),
            });
          }}
        >
          {state.listening ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      {(state.listening || state.error) && <Snackbar
        open={state.listening || Boolean(state.error)}
        autoHideDuration={state.listening ? null : 8000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          sessionRef.current?.cancel();
          setState({ listening: false, error: null });
        }}
      >
        <Alert severity={state.listening ? 'info' : 'warning'} role="status" aria-live="polite" sx={{ maxWidth: 520 }}>
          {message}
        </Alert>
      </Snackbar>}
    </>
  );
}
