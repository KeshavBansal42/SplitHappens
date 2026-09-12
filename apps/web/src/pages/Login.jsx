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