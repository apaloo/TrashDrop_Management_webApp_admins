import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../utils/auth';

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
      roles: ['user', 'admin', 'manager'] 
    },
    { 
      title: 'Request Pickup', 
      path: '/request-pickup',
      icon: 'fas fa-truck',
      roles: ['user', 'admin', 'manager'],
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
      roles: ['admin', 'manager'],
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
      roles: ['admin', 'manager'],
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
      roles: ['user', 'admin', 'manager'] 
    }
  ];

  // Check if the menu item should be displayed based on user role
  const canView = (itemRoles) => {
    if (!itemRoles || itemRoles.length === 0) return true;
    return itemRoles.includes(role);
  };

  // Check if the current path matches or is a child of a menu item
  const isActive = (path, children) => {
    if (location.pathname === path) return true;
    if (children && children.some(child => location.pathname === child.path)) return true;
    return false;
  };

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
    <div className="bg-green-700 text-white w-64 flex-shrink-0 flex flex-col h-full overflow-y-auto">
      {/* Logo and brand */}
      <div className="px-6 pt-8 pb-6">
        <Link to="/dashboard" className="flex items-center">
          <img src="/logo.svg" alt="TrashDrop Logo" className="h-10 w-auto" />
          <span className="ml-3 text-xl font-bold text-white">TrashDrop</span>
        </Link>
      </div>
      <div className="px-3">
        <div className="bg-green-600 bg-opacity-30 rounded-md px-3 py-3 mb-5">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-white font-medium">
              {user?.user_metadata?.firstName?.charAt(0) || user?.user_metadata?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.user_metadata?.firstName || user?.user_metadata?.full_name || 'User'}</p>
              <p className="text-xs text-green-100">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation menu */}
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          {menuItems
            .filter(item => canView(item.roles))
            .map((item, index) => {
              const isActive = location.pathname === item.path || 
                            (item.children && item.children.some(child => location.pathname === child.path));
              const isExpanded = expandedMenu === index;
              
              return (
                <div key={index} className="mb-1">
                  {item.children ? (
                    <>
                      <button 
                        className={`flex items-center w-full text-left px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${isActive ? 'bg-green-800 text-white' : 'text-green-100 hover:bg-green-600 hover:text-white'}`}
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
                              className={`block py-2 px-2 text-sm rounded-md transition-colors duration-150 ${isChildActive ? 'text-white bg-green-800' : 'text-green-100 hover:text-white hover:bg-green-600'}`}
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
                      className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${isActive ? 'bg-green-800 text-white' : 'text-green-100 hover:bg-green-600 hover:text-white'}`}
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
      <div className="p-4 mt-auto border-t border-green-600">
        <button 
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-white bg-green-800 rounded-md hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-500"
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
