import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../utils/auth';
import { SECTIONS, canAccessSection } from '../constants/accessControl';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [expandedMenu, setExpandedMenu] = useState(null);
  
  // Define menu items with their routes, icons, and required roles
  const menuItems = [
    { 
      title: 'Dashboard', 
      path: '/dashboard',
      icon: 'fas fa-tachometer-alt',
      section: SECTIONS.DASHBOARD 
    },
    { 
      title: 'Request Pickup', 
      path: '/request-pickup',
      icon: 'fas fa-truck',
      section: SECTIONS.REQUEST_PICKUP,
      children: [
        { title: 'Live Map', path: '/request-pickup/live-map' },
        { title: 'Pickup Requests', path: '/request-pickup/requests' },
        { title: 'Collectors', path: '/request-pickup/collectors' },
        { title: 'Alerts', path: '/request-pickup/alerts' },
        { title: 'Logs', path: '/request-pickup/logs' }
      ]
    },
    { 
      title: 'Bin Management', 
      path: '/bin-management',
      icon: 'fas fa-dumpster',
      section: SECTIONS.BIN_MANAGEMENT,
      children: [
        { title: 'Generate Bag', path: '/bin-management/generate' },
        { title: 'Bag Management', path: '/bin-management/manage' },
        { title: 'Bag History', path: '/bin-management/history' }
      ]
    },
    { 
      title: 'Illegal Dumping', 
      path: '/illegal-dumping',
      icon: 'fas fa-trash-alt',
      section: SECTIONS.ILLEGAL_DUMPING,
      children: [
        { title: 'Map', path: '/illegal-dumping/map' },
        { title: 'Reports', path: '/illegal-dumping/reports' },
        { title: 'History', path: '/illegal-dumping/history' }
      ]
    },
    { 
      title: 'Settings', 
      path: '/settings',
      icon: 'fas fa-cog',
      section: SECTIONS.SETTINGS 
    }
  ];

  // Check if the menu item should be displayed based on user role
  const canView = (section) => canAccessSection(section, role, user);

  // Toggle submenu expansion
  const toggleMenu = (index) => {
    if (expandedMenu === index) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(index);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="w-64 flex-shrink-0 flex flex-col h-full overflow-y-auto" style={{ background: 'var(--td-sidebar-bg)', color: 'var(--td-sidebar-text)', transition: 'background 0.25s ease' }}>
      {/* Logo and brand */}
      <div className="px-6 pt-8 pb-6">
        <Link to="/dashboard" className="flex items-center">
          <img src="/logo.svg" alt="TrashDrop Logo" className="h-10 w-auto" />
          <span className="ml-3 text-xl font-bold" style={{ color: 'var(--td-sidebar-text)' }}>TrashDrop</span>
        </Link>
      </div>
      <div className="px-3">
        <div className="rounded-md px-3 py-3 mb-5" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full flex items-center justify-center font-medium" style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--td-sidebar-text)' }}>
              {user?.user_metadata?.firstName?.charAt(0) || user?.user_metadata?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium" style={{ color: 'var(--td-sidebar-text)' }}>{user?.user_metadata?.firstName || user?.user_metadata?.full_name || 'User'}</p>
              <p className="text-xs" style={{ color: 'var(--td-sidebar-subtext)' }}>{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation menu */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {menuItems
            .filter(item => canView(item.section))
            .map((item, index) => {
              const isActive = location.pathname === item.path || 
                            (item.children && item.children.some(child => location.pathname === child.path));
              const isExpanded = expandedMenu === index;
              
              return (
                <div key={index} className="mb-1">
                  {item.children ? (
                    <>
                      <button 
                        className="flex items-center w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-150"
                        style={isActive ? { background: 'var(--td-sidebar-active)', color: '#fff' } : { color: 'var(--td-sidebar-text)' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--td-sidebar-hover)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => toggleMenu(index)}
                      >
                        <span className="inline-flex items-center justify-center mr-3 text-lg">
                          <i className={item.icon}></i>
                        </span>
                        <span>{item.title}</span>
                        <span className="ml-auto">
                          <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                      
                      {/* Submenu */}
                      <div className={`mt-1 pl-10 space-y-0.5 ${isExpanded ? 'block' : 'hidden'}`}>
                        {item.children.map((child, childIndex) => {
                          const isChildActive = location.pathname === child.path;
                          
                          return (
                            <Link 
                              key={childIndex}
                              to={child.path} 
                              className="block py-2 px-2 text-sm rounded-md transition-colors duration-150"
                              style={isChildActive ? { background: 'var(--td-sidebar-active)', color: '#fff' } : { color: 'var(--td-sidebar-subtext)' }}
                              onMouseEnter={e => { if (!isChildActive) { e.currentTarget.style.background = 'var(--td-sidebar-hover)'; e.currentTarget.style.color = '#fff'; } }}
                              onMouseLeave={e => { if (!isChildActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--td-sidebar-subtext)'; } }}
                            >
                              {child.title}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <Link 
                      to={item.path} 
                      className="flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-150"
                      style={isActive ? { background: 'var(--td-sidebar-active)', color: '#fff' } : { color: 'var(--td-sidebar-text)' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--td-sidebar-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="inline-flex items-center justify-center mr-3 text-lg">
                        <i className={item.icon}></i>
                      </span>
                      <span>{item.title}</span>
                    </Link>
                  )}
                </div>
              );
            })}
        </div>
      </nav>
      <div className="p-4 mt-auto" style={{ borderTop: '1px solid var(--td-sidebar-border)' }}>
        <button 
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
          style={{ background: 'var(--td-sidebar-active)', color: '#fff' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span className="inline-flex items-center justify-center mr-3">
            <i className="fas fa-sign-out-alt"></i>
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
