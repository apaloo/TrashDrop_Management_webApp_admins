import React from 'react';
import { useModal } from '../../context/ModalContext';

// Import all modal components
import QrCodeModal from './QrCodeModal';
import ConfirmationModal from './ConfirmationModal';
import ScanHistoryModal from './ScanHistoryModal';
import CollectorProfileModal from './CollectorProfileModal';
import NotificationsModal from './NotificationsModal';
import MessagesModal from './MessagesModal';

/**
 * ModalManager Component
 * Central component that renders all modals based on their state in the ModalContext
 * This ensures modals are managed consistently across the application
 */
const ModalManager = () => {
  const { modals, closeModal } = useModal();
  
  return (
    <>
      {/* QR Code Modal */}
      <QrCodeModal 
        isOpen={modals.qrCode.isOpen}
        onClose={() => closeModal('qrCode')}
        qrData={modals.qrCode.data}
      />
      
      {/* Confirmation Modal */}
      {modals.confirmation.isOpen && (
        <ConfirmationModal 
          isOpen={true}
          onClose={() => closeModal('confirmation')}
          title={modals.confirmation.data?.title}
          message={modals.confirmation.data?.message}
          confirmText={modals.confirmation.data?.confirmText}
          cancelText={modals.confirmation.data?.cancelText}
          type={modals.confirmation.data?.type || 'danger'}
          onConfirm={modals.confirmation.data?.onConfirm || (() => {})}
        />
      )}
      
      {/* Scan History Modal */}
      <ScanHistoryModal 
        isOpen={modals.scanHistory.isOpen}
        onClose={() => closeModal('scanHistory')}
        scanHistory={modals.scanHistory.data?.scanHistory || []}
        bagId={modals.scanHistory.data?.bagId}
      />
      
      {/* Collector Profile Modal */}
      <CollectorProfileModal 
        isOpen={modals.collectorProfile.isOpen}
        onClose={() => closeModal('collectorProfile')}
        collector={modals.collectorProfile.data?.collector}
        onSave={modals.collectorProfile.data?.onSave || (() => {})}
      />
      
      {/* Notifications Modal */}
      <NotificationsModal 
        isOpen={modals.notifications.isOpen}
        onClose={() => closeModal('notifications')}
      />
      
      {/* Messages Modal */}
      <MessagesModal 
        isOpen={modals.messages.isOpen}
        onClose={() => closeModal('messages')}
      />
    </>
  );
};

export default ModalManager;
