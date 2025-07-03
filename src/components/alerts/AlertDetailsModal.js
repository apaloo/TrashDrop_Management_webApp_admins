import React, { useState } from 'react';
import { STATUS, PRIORITY } from '../../config/constants';

const AlertDetailsModal = ({ alert, onClose, toggleAlertStatus, updateAlertAssignment }) => {
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  
  if (!alert) return null;
  
  // Format date helper function
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Get priority based styling
  const getPriorityColorStyle = () => {
    switch (alert.priority) {
      case 'critical':
        return { bgColor: 'bg-red-100', textColor: 'text-red-800', icon: 'fa-exclamation-circle', iconColor: 'text-red-600' };
      case 'high':
        return { bgColor: 'bg-orange-100', textColor: 'text-orange-800', icon: 'fa-exclamation-triangle', iconColor: 'text-orange-500' };
      case 'medium':
        return { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', icon: 'fa-exclamation', iconColor: 'text-yellow-500' };
      case 'low':
        return { bgColor: 'bg-blue-100', textColor: 'text-blue-800', icon: 'fa-info-circle', iconColor: 'text-blue-500' };
      default:
        return { bgColor: 'bg-gray-100', textColor: 'text-gray-800', icon: 'fa-info', iconColor: 'text-gray-500' };
    }
  };
  
  // Get entity type display text and icon
  const getEntityInfo = () => {
    switch (alert.relatedTo.type) {
      case 'pickup_request':
        return { 
          title: 'Pickup Request', 
          icon: 'fa-truck',
          viewText: 'View Request',
          link: `/request-pickups?id=${alert.relatedTo.id}`
        };
      case 'collector':
        return { 
          title: 'Collector', 
          icon: 'fa-user',
          viewText: 'View Collector',
          link: `/collectors?id=${alert.relatedTo.id}`
        };
      case 'region':
        return { 
          title: 'Region', 
          icon: 'fa-map-marker-alt',
          viewText: 'View Region',
          link: `/regions?id=${alert.relatedTo.id}`
        };
      case 'system':
        return { 
          title: 'System', 
          icon: 'fa-cogs',
          viewText: 'System Settings',
          link: '/settings'
        };
      default:
        return { 
          title: 'Unknown', 
          icon: 'fa-question-circle',
          viewText: 'More Info',
          link: '#'
        };
    }
  };
  
  // Handle adding a comment
  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const comment = {
      id: `comment-${Date.now()}`,
      text: newComment,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User',
      isSystem: false
    };
    
    alert.comments = [...(alert.comments || []), comment];
    setNewComment('');
    setShowComments(true);
  };
  
  // Handle assignment change
  const handleAssignmentChange = (e) => {
    const assignedTo = e.target.value === '' ? null : e.target.value;
    updateAlertAssignment(alert.id, assignedTo);
  };
  
  const priorityStyle = getPriorityColorStyle();
  const entityInfo = getEntityInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="border-b p-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center mb-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityStyle.bgColor} ${priorityStyle.textColor} mr-2`}>
                <i className={`fas ${priorityStyle.icon} mr-1 ${priorityStyle.iconColor}`}></i>
                {alert.priority.charAt(0).toUpperCase() + alert.priority.slice(1)}
              </span>
              
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                alert.status === STATUS.ALERT.OPEN ? 'bg-yellow-100 text-yellow-800' : 
                alert.status === STATUS.ALERT.RESOLVED ? 'bg-green-100 text-green-800' : 
                alert.status === STATUS.ALERT.IN_PROGRESS ? 'bg-blue-100 text-blue-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {alert.status === STATUS.ALERT.OPEN ? (
                  <>
                    <i className="fas fa-circle text-xs mr-1"></i>
                    Open
                  </>
                ) : (
                  <>
                    <i className="fas fa-check text-xs mr-1"></i>
                    Resolved
                  </>
                )}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{alert.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-6">
          {/* Alert entity */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-2">Related Entity</h4>
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <i className={`fas ${entityInfo.icon} text-blue-500`}></i>
              </div>
              <div>
                <p className="font-medium">{entityInfo.title}</p>
                <p className="text-sm text-gray-500">
                  ID: {alert.relatedTo.id}
                  {alert.relatedTo.location && (
                    <span className="ml-2">• {alert.relatedTo.location}</span>
                  )}
                </p>
              </div>
              <div className="ml-auto">
                <a 
                  href={entityInfo.link}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  {entityInfo.viewText}
                  <i className="fas fa-external-link-alt ml-1 text-xs"></i>
                </a>
              </div>
            </div>
          </div>
          
          {/* Timestamps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <h4 className="text-xs text-gray-500 mb-1">Created</h4>
              <p className="text-sm">{formatDate(alert.createdAt)}</p>
            </div>
            <div>
              <h4 className="text-xs text-gray-500 mb-1">Last Updated</h4>
              <p className="text-sm">{formatDate(alert.updatedAt)}</p>
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-6">
            <h4 className="text-sm text-gray-500 mb-2">Description</h4>
            <p className="text-sm text-gray-900 whitespace-pre-line bg-gray-50 p-3 rounded border border-gray-100">
              {alert.description}
            </p>
          </div>
          
          {/* Alert Actions */}
          <div className="mb-6" data-test="alert-detail-actions">
            <h4 className="text-sm text-gray-500 mb-2">Available Actions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                data-test="action-item"
                className="flex items-center justify-center p-2 border rounded-md hover:bg-gray-50 text-sm"
                onClick={() => console.log('Dispatch maintenance')}
              >
                <i className="fas fa-tools mr-2"></i>
                dispatch_maintenance
              </button>
              <button
                data-test="action-item"
                className="flex items-center justify-center p-2 border rounded-md hover:bg-gray-50 text-sm"
                onClick={() => console.log('Send notification')}
              >
                <i className="fas fa-bell mr-2"></i>
                send_notification
              </button>
              <button
                data-test="action-item"
                className="flex items-center justify-center p-2 border rounded-md hover:bg-gray-50 text-sm"
                onClick={() => console.log('Generate report')}
              >
                <i className="fas fa-file-alt mr-2"></i>
                generate_report
              </button>
            </div>
          </div>
          
          {/* Assignment */}
          <div className="mb-6">
            <h4 className="text-sm text-gray-500 mb-2">Assigned To</h4>
            <select
              className="w-full p-2 border rounded-md"
              value={alert.assignedTo || ''}
              onChange={handleAssignmentChange}
            >
              <option value="">Not assigned</option>
              <option value="admin@trashdrop.com">Admin</option>
              <option value="support@trashdrop.com">Support Team</option>
              <option value="operations@trashdrop.com">Operations</option>
            </select>
          </div>
          
          {/* Comments section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm text-gray-500">Comments & Activity</h4>
              <button 
                onClick={() => setShowComments(!showComments)} 
                className="text-xs text-blue-600"
              >
                {showComments ? 'Hide' : 'Show'} 
                {alert.comments && alert.comments.length > 0 ? ` (${alert.comments.length})` : ''}
              </button>
            </div>
            
            {showComments && (
              <div className="border rounded-md mb-3">
                <div className="max-h-40 overflow-y-auto p-2">
                  {alert.comments && alert.comments.length > 0 ? (
                    alert.comments.map((comment) => (
                      <div key={comment.id} className={`p-2 mb-2 text-sm rounded ${comment.isSystem ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">
                            {comment.isSystem ? 'System' : comment.createdBy}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p>{comment.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm p-2">No comments yet</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex">
              <input
                type="text"
                className="flex-grow p-2 border rounded-l-md"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                onClick={handleAddComment}
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
        
        {/* Modal Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-between">
          <button 
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
          
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
              alert.status === STATUS.ALERT.OPEN 
              ? 'bg-green-600 hover:bg-green-700' 
              : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
            onClick={() => {
              toggleAlertStatus(alert.id);
              onClose();
            }}
          >
            {alert.status === STATUS.ALERT.OPEN ? (
              <>
                <i className="fas fa-check-circle mr-1"></i>
                Mark as Resolved
              </>
            ) : (
              <>
                <i className="fas fa-redo mr-1"></i>
                Reopen Alert
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDetailsModal;
