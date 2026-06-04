import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the title and the empty-catalog state without throwing', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Game Night' })).toBeInTheDocument();
    expect(screen.getByText('No games found')).toBeInTheDocument();
  });
});
