import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PageErrorBoundary, { isChunkLoadError } from '../PageErrorBoundary';

const chunkError = () => { const e = new Error('Loading chunk 412 failed.'); e.name = 'ChunkLoadError'; return e; };
const Throws = ({ error }) => { throw error; };

beforeEach(() => {
  window.sessionStorage.clear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

it('recognises a page download that failed after a deploy', () => {
  expect(isChunkLoadError(chunkError())).toBe(true);
  expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /static/js/9.js'))).toBe(true);
  expect(isChunkLoadError(new Error('x is undefined'))).toBe(false);
});

it('reloads once to pick up the new version instead of showing a blank page', () => {
  const reload = jest.fn();
  render(<PageErrorBoundary reload={reload}><Throws error={chunkError()} /></PageErrorBoundary>);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Updating TrashDrop');
});

it('does not reload in a loop: a second failure shows a message with a way out', () => {
  window.sessionStorage.setItem('trashdrop_chunk_reload_at', String(Date.now()));
  const reload = jest.fn();
  render(<PageErrorBoundary reload={reload} homePath="/illegal-dumping/reports"><Throws error={chunkError()} /></PageErrorBoundary>);
  expect(reload).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('TrashDrop has been updated');
  expect(screen.getByRole('link', { name: 'Go to my start page' })).toHaveAttribute('href', '/illegal-dumping/reports');
  fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('shows a message for any other error and clears it on the next page', () => {
  const reload = jest.fn();
  const { rerender } = render(<PageErrorBoundary reload={reload} resetKey="a"><Throws error={new Error('boom')} /></PageErrorBoundary>);
  expect(reload).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('This page didn’t load');

  rerender(<PageErrorBoundary reload={reload} resetKey="b"><h1>Next page</h1></PageErrorBoundary>);
  expect(screen.getByRole('heading', { name: 'Next page' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
