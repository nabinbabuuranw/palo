import { Component, type ReactNode } from 'react';
// Last line of defence: a render error shows a calm message instead of a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false }); }
  componentDidCatch(e: unknown) { console.error('palo_render_error', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container-x py-20 max-w-xl" role="alert">
        <h1 className="font-display text-3xl">Something broke on this page</h1>
        <p className="text-ink-2 mt-3">Nothing you entered was lost on our side. Reload the page to try again.</p>
        <button onClick={() => location.reload()} className="mt-6 h-11 px-5 rounded bg-pine text-paper">Reload</button>
      </div>
    );
  }
}
