import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Login.css';

const API_BASE = '/api';

const AuthPage = ({ setToken }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname === '/register';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login/`, { username, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      navigate('/portfolio');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/register/`, {
        username,
        password,
        email: email || undefined,
      });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      navigate('/portfolio');
    } catch (err) {
      const msg = err.response?.data?.message
        || (typeof err.response?.data === 'object' ? Object.values(err.response.data).flat().join(' ') : null)
        || err.response?.data?.detail
        || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = isRegister ? handleRegister : handleLogin;

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{isRegister ? 'Create Account' : 'Stock Portal Login'}</h2>
        <p className="auth-subtitle">
          {isRegister
            ? 'Register to track your portfolio'
            : 'Login to view and manage your portfolio'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          {isRegister && (
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? (
            <>Already have an account? <Link to="/login">Login</Link></>
          ) : (
            <>Don't have an account? <Link to="/register">Register</Link></>
          )}
        </p>
        <Link to="/" className="back-home">← Back to Stocks</Link>
      </div>
    </div>
  );
};

export default AuthPage;
