import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';

// Context
import { OperatorProvider } from './context/OperatorContext';
import { ThemeProvider } from './context/ThemeContext';

// Components
import OperatorSelector from './components/OperatorSelector';

// Pages
import Dashboard from './pages/Dashboard';
import Equipment from './pages/Equipment';
import EquipmentDetail from './pages/EquipmentDetail';
import CheckOut from './pages/CheckOut';
import CheckIn from './pages/CheckIn';
import Consumables from './pages/Consumables';
import Calibration from './pages/Calibration';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Reservations from './pages/Reservations';
import Maintenance from './pages/Maintenance';
import AuditLog from './pages/AuditLog';
import CustomerSites from './pages/CustomerSites';
import UserManagement from './pages/UserManagement';

// Icons as simple SVG components
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Equipment: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7h-4V3H8v4H4v14h16V7z" />
      <path d="M8 3v4h8V3" />
    </svg>
  ),
  CheckOut: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  CheckIn: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  Consumables: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  Reports: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  Calibration: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 6v6l4 2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Wrench: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Building: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// Wrapper component to handle mobile menu with location
function AppContent() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="hamburger-btn" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
        </button>
        <h1 className="mobile-title">Equipment Store</h1>
        <div className="mobile-header-spacer"></div>
      </header>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h1>Equipment Store</h1>
          <p>Inventory Management</p>
          <button 
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <Icons.Close />
          </button>
        </div>

        {/* Operator Selector */}
        <div className="sidebar-operator">
          <OperatorSelector />
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Overview</div>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icons.Dashboard /> Dashboard
            </NavLink>
          </div>
        
        <div className="nav-section">
          <div className="nav-section-title">Equipment</div>
          <NavLink to="/equipment" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Equipment /> Equipment List
          </NavLink>
          <NavLink to="/check-out" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.CheckOut /> Check Out
          </NavLink>
          <NavLink to="/check-in" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.CheckIn /> Check In
          </NavLink>
          <NavLink to="/reservations" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Calendar /> Reservations
          </NavLink>
        </div>
        
        <div className="nav-section">
          <div className="nav-section-title">Stock</div>
          <NavLink to="/consumables" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Consumables /> Consumables
          </NavLink>
          <NavLink to="/calibration" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Calibration /> Calibration
          </NavLink>
          <NavLink to="/maintenance" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Wrench /> Maintenance
          </NavLink>
        </div>
        
        <div className="nav-section">
          <div className="nav-section-title">Analysis</div>
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Reports /> Reports
          </NavLink>
          <NavLink to="/customer-sites" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Building /> Customer Sites
          </NavLink>
          <NavLink to="/audit-log" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.History /> Audit Log
          </NavLink>
        </div>
        
        <div className="nav-section">
          <div className="nav-section-title">System</div>
          <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Users /> Users
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icons.Settings /> Settings
          </NavLink>
        </div>
      </nav>
    </aside>

    {/* Main Content */}
    <main className="main-content">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/equipment/:id" element={<EquipmentDetail />} />
        <Route path="/check-out" element={<CheckOut />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/consumables" element={<Consumables />} />
        <Route path="/calibration" element={<Calibration />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/customer-sites" element={<CustomerSites />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </main>
  </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <OperatorProvider>
        <Router>
          <AppContent />
        </Router>
      </OperatorProvider>
    </ThemeProvider>
  );
}

export default App;
