import React, { useState, useEffect } from 'react';
import { fetchContacts, fetchConversation, sendMessage as sendMessageToDb } from '../../utils/messageService';

const MessagesModal = ({ isOpen, onClose }) => {
  const [activeContact, setActiveContact] = useState(null);
  const [message, setMessage] = useState('');
  const [activeConversation, setActiveConversation] = useState([]);
  const [localContacts, setLocalContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load contacts from Supabase on mount
  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);
        const contactsData = await fetchContacts();
        setLocalContacts(contactsData);
        setError(null);
      } catch (err) {
        console.error('Error loading contacts:', err);
        setError('Failed to load contacts');
        setLocalContacts([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen]);

  // Load conversation when contact is selected
  useEffect(() => {
    const loadConversation = async () => {
      if (activeContact) {
        try {
          const conversationData = await fetchConversation(activeContact.id);
          setActiveConversation(conversationData || []);
          
          // Mark messages as read when viewing conversation
          const updatedContacts = localContacts.map(contact => 
            contact.id === activeContact.id ? { ...contact, unreadCount: 0 } : contact
          );
          setLocalContacts(updatedContacts);
        } catch (err) {
          console.error('Error loading conversation:', err);
          setActiveConversation([]);
        }
      }
    };
    
    loadConversation();
  }, [activeContact]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (message.trim() === '' || !activeContact) return;
    
    const newMessage = {
      id: Date.now(),
      senderId: "me",
      receiverId: activeContact.id,
      text: message,
      timestamp: new Date().toISOString(),
      read: true
    };
    
    // Optimistically add to UI
    setActiveConversation([...activeConversation, newMessage]);
    setMessage('');
    
    // Send to database
    try {
      await sendMessageToDb(activeContact.id, message);
    } catch (err) {
      console.error('Error sending message:', err);
      // Could show error toast here
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If modal is not open, don't render
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Messages</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Contacts sidebar */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-3 border-b sticky top-0 bg-white">
              <input
                type="text"
                placeholder="Search contacts..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="divide-y">
              {localContacts.map(contact => (
                <div 
                  key={contact.id}
                  className={`p-3 flex items-center hover:bg-gray-50 cursor-pointer ${activeContact?.id === contact.id ? 'bg-gray-50' : ''}`}
                  onClick={() => setActiveContact(contact)}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                      <img 
                        src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`}
                        alt={contact.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-medium">{contact.name}</h3>
                      <span className="text-xs text-gray-500">{contact.lastSeen}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{contact.role}</p>
                  </div>
                  {contact.unreadCount > 0 && (
                    <span className="bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Conversation */}
          <div className="flex-1 flex flex-col">
            {activeContact ? (
              <>
                {/* Contact info */}
                <div className="p-3 border-b flex items-center bg-white sticky top-0">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                      <img 
                        src={activeContact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeContact.name)}&background=random`}
                        alt={activeContact.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeContact.name)}&background=random`;
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {activeContact.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium">{activeContact.name}</h3>
                    <p className="text-xs text-gray-500">
                      {activeContact.online ? 'Online' : `Last seen ${activeContact.lastSeen}`}
                    </p>
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                  <div className="space-y-3">
                    {activeConversation.map(msg => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.senderId === 'me' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg ${
                            msg.senderId === 'me' 
                              ? 'bg-primary text-white rounded-br-none' 
                              : 'bg-white text-gray-800 rounded-bl-none shadow'
                          }`}
                        >
                          <p>{msg.text}</p>
                          <div className={`text-xs mt-1 ${msg.senderId === 'me' ? 'text-gray-200' : 'text-gray-500'}`}>
                            {formatTime(msg.timestamp)}
                            {msg.senderId === 'me' && (
                              <span className="ml-2">
                                {msg.read ? (
                                  <i className="fas fa-check-double"></i>
                                ) : (
                                  <i className="fas fa-check"></i>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Message input */}
                <div className="p-3 border-t bg-white">
                  <form onSubmit={handleSendMessage} className="flex">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      className="bg-primary text-white px-4 py-2 rounded-r-lg hover:bg-primary-dark focus:outline-none"
                    >
                      <i className="fas fa-paper-plane"></i>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center p-6">
                  <i className="fas fa-comment-dots text-5xl text-gray-300 mb-3"></i>
                  <p className="text-gray-500">Select a contact to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesModal;
