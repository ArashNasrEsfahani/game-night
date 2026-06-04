import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the title and the auto-discovered game catalog', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Game Night' })).toBeInTheDocument();
    // Dowr is auto-discovered by the registry and shown as a card.
    expect(screen.getByText('Dowr')).toBeInTheDocument();
  });
});
