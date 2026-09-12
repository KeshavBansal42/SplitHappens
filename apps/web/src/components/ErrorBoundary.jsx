import { Component } from 'react';

/**
 * Without this a render error unmounts the whole tree and the user just sees
 * a blank page with no clue what happened.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">S</div>
            <h1 className="login-title">Something went wrong</h1>
            <p className="login-subtitle">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              className="login-btn login-btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
