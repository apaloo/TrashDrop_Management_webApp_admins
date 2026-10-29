import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import GlobalSearch from '../GlobalSearch';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; };
const renderAs = (role) => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <GlobalSearch role={role} />
    <Routes><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>
);
const type = (text) => fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });

describe('top-bar search', () => {
  it('offers requests and dumping reports to an admin, and Enter opens requests', () => {
    renderAs('admin');
    type('Madina');
    const options = screen.getAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual(['Pickup requests matching “Madina”', 'Dumping reports matching “Madina”']);
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent('/request-pickup/requests?q=Madina');
  });

  it('arrow down then Enter opens dumping reports', () => {
    renderAs('admin');
    type('osu market');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent('/illegal-dumping/reports?q=osu%20market');
  });

  it('clicking a choice opens it', () => {
    renderAs('admin');
    type('abc');
    fireEvent.mouseDown(screen.getAllByRole('option')[1]);
    expect(screen.getByTestId('where')).toHaveTextContent('/illegal-dumping/reports?q=abc');
  });

  it('a role that cannot open requests is only offered dumping reports', () => {
    renderAs('media');
    type('x');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Dumping reports matching');
  });

  it('an empty search goes nowhere', () => {
    renderAs('admin');
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/dashboard$/);
  });

  it('is hidden for a role with neither page', () => {
    renderAs('nobody');
    expect(screen.queryByRole('search')).toBeNull();
  });
});
