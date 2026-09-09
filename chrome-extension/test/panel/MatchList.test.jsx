import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchList from '../../src/panel/components/MatchList.jsx';

const matches = [
  { id: 'H:M-1', name: 'TELEFONICA SA', location: 'Madrid', nif: 'A28015865',
    isAlias: false, lastFiling: '2026-08-28' },
  { id: 'H:M-2', name: 'NEW SL', location: null, nif: null, isAlias: true,
    formerName: 'OLD SL', newName: 'NEWEST SL', lastFiling: null },
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

  it('shows the last filing date, which is what separates same-named companies', () => {
    render(<MatchList matches={matches} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/last filing: 2026-08-28/i)).toBeInTheDocument();
  });

  it('shows the current name when the match has been renamed since', () => {
    render(<MatchList matches={matches} locale="en" onPick={() => {}} />);
    expect(screen.getByText(/now: NEWEST SL/)).toBeInTheDocument();
  });
});
