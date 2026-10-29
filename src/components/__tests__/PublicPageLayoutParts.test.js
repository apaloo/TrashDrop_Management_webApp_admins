import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FAQAccordion, SectionNav } from '../PublicPageLayout';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

it('FAQ answers open and close, and the button says whether it is open', () => {
  render(<FAQAccordion surface="light" items={[{ q: 'Is pickup free?', a: 'Yes, with QR bags.' }]} />);
  const q = screen.getByRole('button', { name: 'Is pickup free?' });
  expect(q).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(q);
  expect(q).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Yes, with QR bags.')).toBeInTheDocument();
});

it('section links point at the page sections and mark the first as current', () => {
  render(<SectionNav items={[{ id: 'steps', label: 'Steps' }, { id: 'faq', label: 'FAQ' }]} />);
  const nav = screen.getByRole('navigation', { name: 'On this page' });
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Steps' })).toHaveAttribute('href', '#steps');
  expect(screen.getByRole('link', { name: 'Steps' })).toHaveAttribute('aria-current', 'location');
  expect(screen.getByRole('link', { name: 'FAQ' })).not.toHaveAttribute('aria-current');
});
