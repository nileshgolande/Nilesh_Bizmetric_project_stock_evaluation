import React, { useState } from 'react';
import axios from 'axios';
import './Login.css'; // <--- Import the new styles here

const Login = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/auth/login/', { 
        username, 
        password 
      });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
    } catch (err) {
      console.error(err);
      alert("Invalid Credentials");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Stock Portal Login</h2>
        <form onSubmit={handleLogin} className="login-form">
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={e => setUsername(e.target.value)} 
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)} 
            required
          />
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;