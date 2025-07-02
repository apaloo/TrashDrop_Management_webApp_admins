/**
 * TrashDrop Admin Portal - Modal Testing Helper
 * 
 * This helper provides functions to directly manipulate modal visibility
 * for reliable testing in Cypress
 */

// Direct DOM manipulation for modal testing
// This bypasses events and directly updates class names
export const showModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
};

export const hideModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
};

// Expose functions to the window for Cypress
window.modalHelper = {
  showModal,
  hideModal
};

// Add data-cy attributes to all modals for easier Cypress testing
document.querySelectorAll('[data-test$="-modal"]').forEach(modal => {
  modal.setAttribute('data-cy-modal', 'true');
});
