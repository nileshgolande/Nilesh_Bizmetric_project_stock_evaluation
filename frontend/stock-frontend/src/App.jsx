import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  // If there is no token, show the Login screen
  if (!token) {
    return <Login setToken={setToken} />;
  }

  return (
    <div className="app">
      <nav>
        <span>Stock EDA Dashboard</span>
        <button onClick={() => { localStorage.removeItem('token'); setToken(null); }}>Logout</button>
      </nav>
      <Dashboard />
    </div>
  );
}

export default App;