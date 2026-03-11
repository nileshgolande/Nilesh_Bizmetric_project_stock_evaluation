import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="theme-toggle-inner">
        <div className={`theme-toggle-icon ${theme === 'dark' ? 'active' : ''}`}>
          <Moon size={18} />
        </div>
        <div className={`theme-toggle-icon ${theme === 'light' ? 'active' : ''}`}>
          <Sun size={18} />
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
