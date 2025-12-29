import React, { createContext, useState, useContext } from 'react';

// Create context
const ModalContext = createContext();

/**
 * Modal Provider Component
 * Central management for all modal states across the application
 */
export const ModalProvider = ({ children }) => {
  // State for each modal type
  const [modals, setModals] = useState({
    qrCode: { isOpen: false, data: null },
    confirmation: { isOpen: false, data: null },
    scanHistory: { isOpen: false, data: null },
    collectorProfile: { isOpen: false, data: null },
    notifications: { isOpen: false, data: null },
    messages: { isOpen: false, data: null }
  });

  // Open a modal with data
  const openModal = (modalType, data = null) => {
    setModals(prevState => ({
      ...prevState,
      [modalType]: {
        isOpen: true,
        data
      }
    }));
  };

  // Close a specific modal
  const closeModal = (modalType) => {
    setModals(prevState => ({
      ...prevState,
      [modalType]: {
        isOpen: false,
        data: null
      }
    }));
  };

  // Close all modals
  const closeAllModals = () => {
    Object.keys(modals).forEach(key => {
      setModals(prevState => ({
        ...prevState,
        [key]: {
          isOpen: false,
          data: null
        }
      }));
    });
  };

  // Value object to be provided to consumers
  const value = {
    modals,
    openModal,
    closeModal,
    closeAllModals
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

// Custom hook to use the modal context
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export default ModalContext;
