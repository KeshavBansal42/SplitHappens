import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { stagger, createTimeline } from 'animejs';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const { login, authenticated } = useAuth();

  useEffect(() => {
    if (authenticated) navigate('/', { replace: true });
  }, [authenticated, navigate]);

  useEffect(() => {
    const tl = createTimeline({ easing: 'easeOutExpo' });

    tl.add('.login-bg-glow', {
      scale: [0.5, 1],
      opacity: [0, 0.08],
      duration: 1200,
      delay: stagger(200),
    }).add('.login-card', {
      opacity: [0, 1],
      y: [30, 0],
      scale: [0.97, 1],
      duration: 800,
    }, '-=800').add('.login-logo', {
      scale: [0, 1],
      rotate: ['-15deg', '0deg'],
      duration: 600,
    }, '-=400').add(['.login-title', '.login-subtitle'], {
      opacity: [0, 1],
      y: [10, 0],
      duration: 500,
      delay: stagger(100),
    }, '-=300').add('.login-btn', {
      opacity: [0, 1],
      y: [8, 0],
      duration: 400,
      delay: stagger(80),
    }, '-=200').add('.login-footer', {
      opacity: [0, 1],
      duration: 400,
    }, '-=100');
  }, []);

  const handleLogin = () => {
    login();
  };

  return (
    <div className="login-page" ref={cardRef}>
      <div className="login-bg-glow glow-1" />
      <div className="login-bg-glow glow-2" />

      <div className="login-card">
        <div className="login-logo">S</div>
        <h1 className="login-title">splitHappens</h1>
        <p className="login-subtitle">
          Group payments, settled on-chain. No seed phrases.
        </p>

        <button className="login-btn login-btn-primary" onClick={handleLogin}>
          <EmailIcon />
          Continue with Email
        </button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button className="login-btn" onClick={handleLogin}>
          <GoogleIcon />
          Continue with Google
        </button>

        <button className="login-btn" onClick={handleLogin}>
          <WalletIcon />
          Connect Wallet
        </button>

        <p className="login-footer">
          By continuing, you agree to our{' '}
          <a href="#">Terms</a> and{' '}
          <a href="#">Privacy Policy</a>.
          <br />
          Powered by <a href="#">Privy</a>
        </p>
      </div>
    </div>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}