// One controller per mounted challenge. Disposing it also invalidates callbacks
// and pending requests that still hold a reference to the old dialog's widget.
export function createTurnstileWidget({ getApi, getContainer, sitekey, onToken, onError }) {
  let disposed = false;
  let widget = null;
  let timer;

  function remove() {
    const previous = widget;
    widget = null;
    if (previous?.id != null) {
      try { previous.api.remove(previous.id); } catch { /* Already removed by Turnstile. */ }
    }
  }

  function render() {
    if (disposed) return;
    const api = getApi();
    const container = getContainer();
    if (!api?.render || !container) {
      timer = setTimeout(render, 200);
      return;
    }
    const current = { api, id: null };
    widget = current;
    const active = () => !disposed && widget === current;
    try {
      current.id = api.render(container, {
        sitekey,
        callback: token => { if (active()) onToken(token); },
        'expired-callback': () => { if (active()) onToken(''); },
        'timeout-callback': () => { if (active()) onToken(''); },
        'error-callback': () => {
          if (active()) { onToken(''); onError(); }
        },
      });
    } catch {
      remove();
      onToken('');
      onError();
    }
  }

  function reset() {
    if (disposed) return;
    clearTimeout(timer);
    onToken('');
    if (widget?.id != null) {
      try {
        widget.api.reset(widget.id);
        return;
      } catch { /* A detached widget must be rendered again, never reset twice. */ }
    }
    remove();
    render();
  }

  render();
  return {
    getResponse() {
      if (disposed || widget?.id == null) return '';
      try { return widget.api.getResponse(widget.id) || ''; }
      catch { reset(); return ''; }
    },
    reset,
    dispose() {
      disposed = true;
      clearTimeout(timer);
      remove();
    },
  };
}
