import React from 'react';

/**
 * Confirmation Modal Component
 * Used for confirming potentially destructive actions like deleting a batch
 * 
 * @param {Boolean} isOpen - Controls visibility of the modal
 * @param {Function} onClose - Function to call when closing the modal
 * @param {Function} onConfirm - Function to call when confirming the action
 * @param {String} title - Modal title
 * @param {String} message - Modal message/description
 * @param {String} confirmText - Text for the confirm button
 * @param {String} cancelText - Text for the cancel button
 * @param {String} type - Type of confirmation (danger, warning, info)
 */
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action', 
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger' // danger, warning, info
}) => {
  if (!isOpen) return null;
  
  // Determine styles based on type
  const getTypeStyles = () => {
    switch(type) {
      case 'danger':
        return {
          icon: 'fa-exclamation-triangle',
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          borderColor: 'border-red-200'
        };
      case 'warning':
        return {
          icon: 'fa-exclamation-circle',
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
          borderColor: 'border-yellow-200'
        };
      case 'info':
      default:
        return {
          icon: 'fa-info-circle',
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          confirmBg: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-200'
        };
    }
  };
  
  const styles = getTypeStyles();
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full max-w-md border-t-4 ${styles.borderColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center mb-4">
            <div className={`rounded-full ${styles.iconBg} p-3 mr-3`}>
              <i className={`fas ${styles.icon} ${styles.iconColor} text-xl`}></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
          
          <div className="mb-5">
            <p className="text-gray-600">{message}</p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-white rounded-lg ${styles.confirmBg}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
