import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompanyCard from '../../src/panel/components/CompanyCard.jsx';

const company = {
  groupKey: 'H:M-1', name: 'TELEFONICA SA', nif: 'A28015865', capital: 5000000,
  address: 'Gran Via 28, Madrid', status: 'active',
  officersActive: [{ name: 'JANE DOE', position: 'Consejero' }],
  officersResigned: [{ name: 'JOHN ROE', position: 'Administrador' }],
};

describe('CompanyCard', () => {
  it('renders core fields and the soft profile link', () => {
    render(<CompanyCard company={company} locale="en" />);
    expect(screen.getByText('TELEFONICA SA')).toBeInTheDocument();
    expect(screen.getByText('A28015865')).toBeInTheDocument();
    expect(screen.getByText(/Active officers/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View full profile/i });
    expect(link).toHaveAttribute('href', 'https://mapasocietario.es/app?search=TELEFONICA%20SA&gk=H%3AM-1&source=chrome_extension');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('labels the open seats as at-dissolution for a dissolved company', () => {
    render(<CompanyCard company={{ ...company, status: 'dissolved' }} locale="en" />);
    expect(screen.getByText(/Officers at dissolution/i)).toBeInTheDocument();
    expect(screen.queryByText(/Active officers/i)).toBeNull();
  });
});
