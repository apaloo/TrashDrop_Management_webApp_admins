import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportPhotos from '../ReportPhotos';

const photos = ['https://x/a.jpg', 'https://x/b.jpg'];

describe('ReportPhotos', () => {
  it('opens a tapped photo in the full-screen viewer instead of a new tab', () => {
    render(<ReportPhotos photos={photos} enhanced={false} />);
    expect(document.querySelector('a[target="_blank"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open photo 2 of 2' }));
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute('src', 'https://x/b.jpg');
    expect(screen.getByRole('button', { name: 'Pause slideshow' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLOSE' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes only the viewer on Escape, not a window behind it', () => {
    const behind = jest.fn();
    window.addEventListener('keydown', behind);
    render(<ReportPhotos photos={photos} enhanced={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open photo 1 of 2' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(behind).not.toHaveBeenCalled();
    window.removeEventListener('keydown', behind);
  });
});
