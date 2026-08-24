import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { trackEvent } from '../utils/track';

// Contains a render crash inside the checkout dialog so it cannot take the
// whole /app (and the user's in-memory graph) down with it. A render error in
// DDCheckoutDialog once blanked the entire page; the graph the user had built
// was lost along with the sale. Here the user keeps the graph, sees what
// happened, and gets the one thing that still works: an email address.
//
// Class component by necessity — error boundaries have no hook equivalent.

const COPY = {
  en: {
    title: 'The order form could not open',
    body: 'Something broke on our side, not yours — your graph is untouched. Email mapasocietario@ncdata.eu with the company name and we will take the order by hand.',
    close: 'Close',
  },
  es: {
    title: 'No se pudo abrir el formulario de pedido',
    body: 'Ha fallado algo de nuestro lado, no del tuyo — tu grafo sigue intacto. Escribe a mapasocietario@ncdata.eu con el nombre de la empresa y tramitamos el pedido a mano.',
    close: 'Cerrar',
  },
};

export default class CheckoutErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The stack is what a human needs to fix it; the event is what tells us it happened at all.
    console.error('DDCheckoutDialog crashed', error, info?.componentStack);
    trackEvent('checkout_crashed', { message: String(error?.message || error).slice(0, 200) });
  }

  handleClose = () => {
    this.setState({ error: null });
    this.props.onClose?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const copy = COPY[this.props.lang === 'es' ? 'es' : 'en'];
    return (
      <Dialog open onClose={this.handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{copy.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            {copy.body}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleClose} sx={{ textTransform: 'none' }}>{copy.close}</Button>
        </DialogActions>
      </Dialog>
    );
  }
}
