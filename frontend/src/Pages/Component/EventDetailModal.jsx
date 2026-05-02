import React, { useState } from 'react';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaMicrophone, FaUser, FaTimes } from 'react-icons/fa';

const EventDetailModal = ({ isOpen, onClose, event, onApprove, onReject, onRevise }) => {
  const [extendImage, setExtendImage] = useState(false);

  if (!isOpen || !event) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return timeString ? timeString.slice(0, 5) : '';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'revised': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Event Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Event Image */}
          {event.imageUrl && (
            <div className="mb-6 relative group cursor-pointer" onClick={() => setExtendImage(!extendImage)}>
              <img
                src={event.imageUrl}
                alt={event.name || event.eventName}
                className={`w-full h-48 object-cover rounded-lg shadow-md transition-all duration-300 ${extendImage ? 'h-auto' : 'max-h-48'}`}
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Click to {extendImage ? 'shrink' : 'expand'} image
                </span>
              </div>
            </div>
          )}

          {/* Event Title & Status */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold text-gray-800">{event.name || event.eventName}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(event.status)}`}>
                {event.status?.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FaCalendarAlt className="text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold">
                  {event.startDate && event.endDate && event.startDate !== event.endDate 
                    ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}` 
                    : formatDate(event.startDate || event.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FaClock className="text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-semibold">
                  {formatTime(event.startTime)} - {formatTime(event.endTime)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FaMapMarkerAlt className="text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold">{event.location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <FaMicrophone className="text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Speaker</p>
                <p className="font-semibold">{event.speaker || 'TBA'}</p>
              </div>
            </div>
          </div>

          {/* Creator Info */}
          {event.creator && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <FaUser className="text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Created by</p>
                  <p className="font-semibold">{event.creator.firstName} {event.creator.lastName}</p>
                  <p className="text-sm text-gray-500">{event.creator.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Description</h4>
              <p className="text-gray-700 whitespace-pre-line">{event.description}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="mb-6 text-sm text-gray-500">
            <p>Created: {new Date(event.createdAt).toLocaleString('id-ID')}</p>
            <p>Updated: {new Date(event.updatedAt).toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* Action Buttons */}
        {event.status === 'pending' || event.status === 'revised' ? (
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={() => onRevise(event.id, event.name || event.eventName)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Request Revision
            </button>
            <button
              onClick={() => onReject(event.id, event.name || event.eventName)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(event.id, event.name || event.eventName)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Approve
            </button>
          </div>
        ) : (
          <div className="p-6 border-t bg-gray-50">
            <p className="text-center text-gray-500">
              This event has been {event.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetailModal;