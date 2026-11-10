import React from 'react';

/**
 * Keeps a failed page from blanking the whole app.
 *
 * Without a boundary, an error while drawing a page, or a page's code that
 * fails to download, removes everything React drew and leaves an empty screen.
 * The usual cause is a tab left open across a deploy: its page files no longer
 * exist, so opening a page it hasn't loaded yet fails. That case reloads once
 * to pick up the new files; anything else shows a message with a way out.
 */
const RELOAD_KEY = 'trashdrop_chunk_reload_at';
const RELOAD_WINDOW_MS = 30000;

export const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError'
  || /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error?.message || '');

const readStorage = (key) => { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } };
const writeStorage = (key, value) => { try { window.sessionStorage.setItem(key, value); } catch (e) { /* private mode */ } };

/** Reload once for a stale download; false when we already tried recently (avoids a reload loop) */
export const reloadOnceForNewVersion = (reload = () => window.location.reload()) => {
  const last = Number(readStorage(RELOAD_KEY) || 0);
  if (Date.now() - last < RELOAD_WINDOW_MS) return false;
  writeStorage(RELOAD_KEY, String(Date.now()));
  reload();
  return true;
};

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reloading: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('PageErrorBoundary caught an error', error, info?.componentStack);
    if (isChunkLoadError(error) && reloadOnceForNewVersion(this.props.reload)) {
      this.setState({ reloading: true });
    }
  }

  componentDidUpdate(prevProps) {
    // Moving to another page clears the message
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, reloading: false });
    }
  }

  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    const reload = this.props.reload || (() => window.location.reload());
    return (
      <div role="alert" className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--td-text-primary, #1b3e28)' }}>
            {reloading ? 'Updating TrashDrop…' : stale ? 'TrashDrop has been updated' : 'This page didn’t load'}
          </h2>
          {!reloading && (
            <>
              <p className="text-sm" style={{ color: 'var(--td-text-secondary, #4b5563)' }}>
                {stale
                  ? 'Reload to get the latest version. Nothing you saved is lost.'
                  : 'Something went wrong while showing this page. Reloading usually fixes it.'}
              </p>
              <div className="flex justify-center gap-3">
                <button type="button" onClick={reload} className="px-4 py-2 rounded-md bg-green-700 text-white text-sm font-medium hover:bg-green-800">
                  Reload page
                </button>
                {this.props.homePath && (
                  <a href={this.props.homePath} className="px-4 py-2 rounded-md border border-green-700 text-green-800 text-sm font-medium">
                    Go to my start page
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

export default PageErrorBoundary;
