import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Ensure this URL matches your Django server exactly
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
    <div style={{ padding: '20px', maxWidth: '300px', margin: 'auto' }}>
      <h2>Stock Portal Login</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Username" 
          value={username}
          onChange={e => setUsername(e.target.value)} 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={e => setPassword(e.target.value)} 
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login; // <--- Make sure this line exists!