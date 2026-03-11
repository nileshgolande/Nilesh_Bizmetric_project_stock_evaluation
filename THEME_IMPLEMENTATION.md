# Dark/Light Theme Implementation

## Overview
A comprehensive theme system has been implemented allowing users to switch between dark and light themes throughout the application.

## Features

### 1. Theme Context
- **Location**: `src/contexts/ThemeContext.jsx`
- **Functionality**: 
  - Manages theme state (dark/light)
  - Persists theme preference in localStorage
  - Applies theme to document root via `data-theme` attribute
  - Provides `useTheme()` hook for components

### 2. Theme Toggle Component
- **Location**: `src/components/ThemeToggle.jsx`
- **Features**:
  - Beautiful animated toggle button
  - Moon icon for dark mode
  - Sun icon for light mode
  - Located in sidebar navigation header
  - Smooth transitions

### 3. CSS Theme Variables
- **Dark Theme** (default):
  - Dark backgrounds (#0A0E1A, #121826, #1A1F2E)
  - Cyan accent colors (#00E5FF, #00B8D4)
  - White/light gray text
  - Subtle glows and shadows

- **Light Theme**:
  - Light backgrounds (#F5F7FA, #FFFFFF, #E8ECF1)
  - Blue accent colors (#0066CC, #0052A3)
  - Dark text (#1A1F2E, #4A5568)
  - Softer shadows

### 4. Components Updated
All components now support both themes:
- ✅ Sidebar navigation
- ✅ Tables and cards
- ✅ Forms and inputs
- ✅ Buttons and links
- ✅ Charts and graphs
- ✅ Prediction components
- ✅ Portfolio components
- ✅ Analytics pages
- ✅ Login/Register pages

## Usage

### For Users
1. Click the theme toggle button in the sidebar (top right of navigation)
2. Theme preference is automatically saved
3. Theme persists across page refreshes

### For Developers

#### Using Theme in Components
```jsx
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div style={{ color: 'var(--text-primary)' }}>
      Current theme: {theme}
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};
```

#### CSS Variables Available
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
- `--bg-card`, `--bg-glass`
- `--text-primary`, `--text-secondary`, `--text-tertiary`
- `--accent-primary`, `--accent-secondary`, `--accent-tertiary`
- `--border-primary`, `--border-secondary`, `--border-danger`
- `--shadow-glow`, `--shadow-card`
- `--success`, `--danger`, `--warning` (and variants)

## Theme-Specific Styles

### Using `[data-theme="light"]` selector
```css
.my-component {
  background: var(--bg-card);
}

[data-theme="light"] .my-component {
  /* Light theme specific overrides */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

## Benefits

1. **User Preference**: Users can choose their preferred theme
2. **Accessibility**: Light theme reduces eye strain in bright environments
3. **Professional**: Both themes maintain the premium finance aesthetic
4. **Consistent**: All components automatically adapt to theme changes
5. **Persistent**: Theme choice is remembered across sessions

## Technical Details

- Theme is stored in `localStorage` as `'theme'`
- Default theme is `'dark'`
- Theme is applied via `data-theme` attribute on `<html>` element
- CSS variables automatically switch based on `data-theme` attribute
- Smooth transitions (0.3s) for theme changes

## Future Enhancements

- System preference detection (prefers-color-scheme)
- More theme variants (e.g., high contrast, blue theme)
- Per-component theme overrides
- Theme-aware images/icons
