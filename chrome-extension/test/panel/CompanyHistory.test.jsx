import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompanyHistory from '../../src/panel/components/CompanyHistory.jsx';

const baseCompany = {
  groupKey: 'H:M-1',
  name: 'CAIXABANK SA',
  status: 'active',
  firstSeen: '2009-07-03',
  nameChanges: [
    { date: '2011-07-11', from: 'CRITERIA CAIXACORP SA', to: 'CAIXABANK SA' },
  ],
  capitalHistory: [
    { date: '2014-01-15', amount: 943035.0 },
    { date: '2013-06-01', amount: 800000.0 },
  ],
  addressHistory: [
    { date: '2017-10-30', address: 'C/ PINTOR SOROLLA 2-4 (VALENCIA)' },
  ],
};

describe('CompanyHistory', () => {
  it('renders the section heading', () => {
    render(<CompanyHistory company={baseCompany} locale="en" />);
    expect(screen.getByText('Main changes')).toBeInTheDocument();
  });

  it('renders heading in Spanish locale', () => {
    render(<CompanyHistory company={baseCompany} locale="es" />);
    expect(screen.getByText('Principales cambios')).toBeInTheDocument();
  });

  it('renders incorporation entry from firstSeen', () => {
    render(<CompanyHistory company={baseCompany} locale="en" />);
    expect(screen.getByText(/First seen in BORME/i)).toBeInTheDocument();
  });

  it('renders rename entry', () => {
    render(<CompanyHistory company={baseCompany} locale="en" />);
    expect(screen.getByText(/Renamed.*CRITERIA.*CAIXABANK/i)).toBeInTheDocument();
  });

  it('renders address entry', () => {
    render(<CompanyHistory company={baseCompany} locale="en" />);
    expect(screen.getByText(/Address.*PINTOR SOROLLA/i)).toBeInTheDocument();
  });

  it('renders capital entry', () => {
    render(<CompanyHistory company={baseCompany} locale="en" />);
    // At least one capital entry should show
    const capitalItems = screen.getAllByText(/Capital:/i);
    expect(capitalItems.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null when no data and not dissolved', () => {
    const empty = {
      groupKey: 'H:M-2', name: 'EMPTY SA', status: 'active',
      firstSeen: null, nameChanges: [], capitalHistory: [], addressHistory: [],
    };
    const { container } = render(<CompanyHistory company={empty} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  describe('capital collapse', () => {
    const manyCapitalCompany = {
      groupKey: 'H:M-3', name: 'BIGCO SA', status: 'active',
      firstSeen: '2005-01-01',
      nameChanges: [],
      addressHistory: [],
      capitalHistory: [
        { date: '2023-01-01', amount: 5000000 },
        { date: '2022-01-01', amount: 4500000 },
        { date: '2021-01-01', amount: 4000000 },
        { date: '2020-01-01', amount: 3500000 },
        { date: '2019-01-01', amount: 3000000 },
      ],
    };

    it('shows only 3 capital entries initially when there are 5', () => {
      render(<CompanyHistory company={manyCapitalCompany} locale="en" />);
      // Should show 3 capital entries + incorporation (non-capital)
      const capitalLines = screen.getAllByText(/Capital:/i);
      expect(capitalLines).toHaveLength(3);
    });

    it('shows a "show more" button when capital entries exceed 3', () => {
      render(<CompanyHistory company={manyCapitalCompany} locale="en" />);
      expect(screen.getByText(/show more/i)).toBeInTheDocument();
    });

    it('reveals all capital entries when "show more" is clicked', () => {
      render(<CompanyHistory company={manyCapitalCompany} locale="en" />);
      fireEvent.click(screen.getByText(/show more/i));
      const capitalLines = screen.getAllByText(/Capital:/i);
      expect(capitalLines).toHaveLength(5);
    });
  });

  describe('dissolution', () => {
    it('renders dissolved badge at top when status is dissolved', () => {
      const dissolved = { ...baseCompany, status: 'dissolved' };
      render(<CompanyHistory company={dissolved} locale="en" />);
      expect(screen.getByText('Dissolved')).toBeInTheDocument();
    });

    it('renders Disuelta badge in Spanish locale', () => {
      const dissolved = { ...baseCompany, status: 'dissolved' };
      render(<CompanyHistory company={dissolved} locale="es" />);
      expect(screen.getByText('Disuelta')).toBeInTheDocument();
    });

    it('shows section even when no history but company is dissolved', () => {
      const dissolvedEmpty = {
        groupKey: 'H:M-4', name: 'EXTINCT SA', status: 'dissolved',
        firstSeen: null, nameChanges: [], capitalHistory: [], addressHistory: [],
      };
      render(<CompanyHistory company={dissolvedEmpty} locale="en" />);
      expect(screen.getByText('Dissolved')).toBeInTheDocument();
    });
  });
});
