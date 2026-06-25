import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MSG } from '../../src/api/messages.js';
import App from '../../src/panel/App.jsx';

vi.mock('react-force-graph-2d', () => ({ default: () => null }));

const company = {
  groupKey: 'H:M-1', name: 'TELEFONICA SA', nif: 'A1', capital: null, address: null,
  status: 'active', officersActive: [], officersResigned: [],
};

function sendImpl(msg) {
  if (msg.type === MSG.RESOLVE) return Promise.resolve({ type: 'matches',
    matches: [{ id: 'H:M-1', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A1', isAlias: false }] });
  if (msg.type === MSG.GET_COMPANY) return Promise.resolve({ type: 'company', company });
  return Promise.resolve({ type: 'error', error: 'x' });
}

describe('App flow', () => {
  it('selection → matches → pick → company card', async () => {
    render(<App sendImpl={sendImpl} initialSelection="telefonica" />);
    await waitFor(() => screen.getByText('TELEFONICA SA'));
    fireEvent.click(screen.getByText('TELEFONICA SA'));
    await waitFor(() => screen.getByText('A1'));
    expect(screen.getByRole('link', { name: /perfil|profile/i })).toBeInTheDocument();
  });
});
