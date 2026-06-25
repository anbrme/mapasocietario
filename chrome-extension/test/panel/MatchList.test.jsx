import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchList from '../../src/panel/components/MatchList.jsx';

const matches = [
  { id: 'H:M-1', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A28015865', isAlias: false },
  { id: 'H:M-2', name: 'NEW SL', location: null, nif: null, isAlias: true, formerName: 'OLD SL' },
];

describe('MatchList', () => {
  it('renders a button per match and fires onPick', () => {
    const onPick = vi.fn();
    render(<MatchList matches={matches} locale="en" onPick={onPick} />);
    fireEvent.click(screen.getByText('TELEFONICA SA'));
    expect(onPick).toHaveBeenCalledWith(matches[0]);
  });
  it('shows the former-name hint for aliases', () => {
    render(<MatchList matches={matches} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/formerly: OLD SL/)).toBeInTheDocument();
  });
  it('shows no-matches message for empty list', () => {
    render(<MatchList matches={[]} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/No Spanish company found/i)).toBeInTheDocument();
  });
});
