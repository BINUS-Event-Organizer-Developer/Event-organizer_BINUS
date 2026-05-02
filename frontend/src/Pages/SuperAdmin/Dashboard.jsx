import React, { useState, useEffect } from 'react';
import { FaEye, FaPenSquare, FaCircle } from 'react-icons/fa';
import { useAuth } from '../Auth/AuthContext';
import MainHeader from '../Component/MainHeader';
import { StatusModal } from '../Component/StatusModal';
import { ConfirmationModal } from '../Component/ConfirmationModal';
import TextInputModal from '../Component/TextInputModal';
import EventDetailModal from '../Component/EventDetailModal';
import FeedbackPanel from '../Component/FeedbackPanel';
import { approveEvent, rejectEvent, getEvents, sendFeedback } from '../../services/event';
import notificationService from '../../services/notificationService';
import socketService from '../../services/socketService';
import RealtimeClock from '../Component/realtime';
import LoadingModal from '../Component/LoadingModal';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [allEvents, setAllEvents] = useState([]);
  // Notifikasi pendaftaran admin
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminNotifLoading, setAdminNotifLoading] = useState(false);
  const [adminNotifError, setAdminNotifError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [modal, setModal] = useState({ type: null, data: null });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetail, setShowEventDetail] = useState(false);

  // State untuk Paginasi
  const [paginationInfo, setPaginationInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch events dengan paginasi
  const fetchEvents = async (page = 1) => {
    try {
      const res = await getEvents(page, 10);
      setAllEvents(res.data.data || []);
      setPaginationInfo(res.data.pagination);
      setCurrentPage(res.data.pagination.currentPage);
    } catch (err) {
      console.error("Error fetching events:", err);
      setAllEvents([]);
      setPaginationInfo(null);
    }
  };

  // Ambil notifikasi pendaftaran admin dari endpoint notifikasi, lalu filter
  const fetchAdminNotifications = async () => {
    setAdminNotifLoading(true);
    setAdminNotifError(null);
    try {
      const res = await notificationService.getNotifications(1, 80);
      const list = res.data || [];
      // Debug: lihat tipe-tipe apa saja yang datang
      console.debug('Admin registration notifications raw:', list.map(n => ({ type: n.notificationType, payload: n.payload })));
      // Hanya tampilkan notifikasi yang masih dalam 28 hari terakhir (jika field waktu tersedia)
      const now = Date.now();
      const fourWeeksMs = 28 * 24 * 60 * 60 * 1000;
      const isWithinWindow = (n) => {
        const createdAtStr = n.createdAt || n.created_at || n.timestamp || n.createdAtUtc || n.created_at_utc;
        if (!createdAtStr) return true; // jika tidak ada field waktu, jangan disaring
        const t = Date.parse(createdAtStr);
        if (Number.isNaN(t)) return true;
        return (now - t) <= fourWeeksMs;
      };

      const filtered = list.filter(n => {
        const type = (n.notificationType || '').toLowerCase();
        // Filter for event proposals (created or updated)
        return type === 'event_created' || type === 'event_updated';
      });
      setAdminNotifications(filtered);
    } catch (err) {
      console.error('Gagal mengambil notifikasi pendaftaran admin:', err);
      setAdminNotifications([]);
      setAdminNotifError('Gagal mengambil notifikasi pendaftaran admin.');
    } finally {
      setAdminNotifLoading(false);
    }
  };

  // Ref to keep track of current page without re-triggering socket connection
  const currentPageRef = React.useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Socket connection and realtime notifications
  useEffect(() => {
    if (user?.accessToken) {
      // Connect socket
      socketService.connect(user.accessToken);

      // Listen for new notifications
      const handleNewNotification = (notification) => {
        console.log('New notification received:', notification);

        // 1. Optimistic Notification Update
        const newNotif = {
          id: `temp-${Date.now()}`,
          notificationType: notification.type,
          title: notification.title,
          message: notification.message,
          payload: notification.data || {},
          createdAt: new Date().toISOString(),
          isRead: false
        };
        setAdminNotifications(prev => [newNotif, ...prev]);

        // 2. Optimistic Event Update (Table)
        if (notification.type === 'event_created' || notification.type === 'event_updated') {
          const rawData = notification.data || {};
          const eventId = rawData.eventId || rawData.id;

          // Construct event object for table
          const optimisticEvent = {
            id: eventId,
            eventName: rawData.eventName || 'New Event',
            location: rawData.location || '-',
            date: rawData.date || '-',
            startTime: rawData.startTime || '-',
            endTime: rawData.endTime || '-',
            speaker: rawData.speaker || '-',
            description: rawData.description || '',
            status: 'pending', // Usually updates reset to pending
            imageUrl: rawData.imageUrl || null,
          };

          setAllEvents(prevEvents => {
            const exists = prevEvents.find(e => e.id === eventId);
            if (exists) {
              return prevEvents.map(e => e.id === eventId ? { ...e, ...optimisticEvent } : e);
            } else {
              return [optimisticEvent, ...prevEvents];
            }
          });

          // Show Event Detail Modal directly
          setSelectedEvent(optimisticEvent);
          setShowEventDetail(true);
        }

        // 3. Background Sync (delayed to ensure DB commit)
        setTimeout(() => {
          fetchAdminNotifications();
          fetchEvents(currentPageRef.current);
        }, 1000);
      };

      socketService.onNotification(handleNewNotification);
      socketService.onEventUpdated(handleNewNotification);

      return () => {
        socketService.off('new_notification', handleNewNotification);
        socketService.off('eventUpdated', handleNewNotification);
        socketService.disconnect();
      };
    }
  }, [user?.accessToken]);

  useEffect(() => {
    fetchEvents(currentPage);
    fetchAdminNotifications();
  }, [currentPage]);

  useEffect(() => {
    let processed = [...allEvents];
    if (statusFilter !== 'All') {
      processed = processed.filter(e => e.status.toLowerCase() === statusFilter.toLowerCase());
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      processed = processed.filter(e => (e.eventName && e.eventName.toLowerCase().includes(term)));
    }
    setFilteredEvents(processed);
  }, [searchTerm, statusFilter, allEvents]);

  const handlePageChange = (newPage) => {
    if (paginationInfo && newPage > 0 && newPage <= paginationInfo.totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleAction = async (action, successMessage, errorMessage) => {
    try {
      await action();
      setModal({ type: 'status', data: { variant: 'success', title: 'Success!', message: successMessage } });
      fetchEvents(currentPage); // Re-fetch
    } catch (err) {
      setModal({ type: 'status', data: { variant: 'danger', title: 'Error!', message: err.message || errorMessage } });
    }
  };

  const handleApprove = (eventId, eventName) => {
    setModal({
      type: 'confirm',
      data: {
        title: 'Approve Event',
        message: `Apakah Anda yakin ingin menyetujui event "${eventName || ''}"?`,
        variant: 'success',
        onConfirm: async () => {
          setModal({ type: 'loading', data: { message: 'Approving event...' } });
          try {
            await approveEvent(eventId);
            await fetchEvents(currentPage);

            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'success', title: 'Success!', message: 'Event berhasil disetujui.' } });
            }, 500);
          } catch (err) {
            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'danger', title: 'Error!', message: err.message || 'Gagal menyetujui event.' } });
            }, 500);
          }
        }
      }
    });
  };

  const handleReject = (eventId, eventName) => {
    setModal({
      type: 'textinput',
      data: {
        title: 'Tolak Event',
        label: 'Alasan Penolakan',
        placeholder: 'Tuliskan alasan penolakan...',
        onSubmit: async (feedback) => {
          setModal({ type: 'loading', data: { message: 'Rejecting event...' } });
          try {
            await rejectEvent(eventId, feedback);
            await fetchEvents(currentPage);

            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'success', title: 'Success!', message: 'Event berhasil ditolak.' } });
            }, 500);
          } catch (err) {
            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'danger', title: 'Error!', message: err.message || 'Gagal menolak event.' } });
            }, 500);
          }
        }
      }
    });
  };

  const handleFeedback = (eventId, eventName) => {
    setModal({
      type: 'textinput',
      data: {
        title: 'Kirim Feedback Revisi',
        label: 'Catatan Revisi',
        placeholder: 'Tuliskan catatan revisi untuk admin/event owner...',
        onSubmit: async (feedback) => {
          setModal({ type: 'loading', data: { message: 'Sending feedback...' } });
          try {
            await sendFeedback(eventId, feedback);
            await fetchEvents(currentPage);

            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'success', title: 'Success!', message: 'Feedback revisi berhasil dikirim.' } });
            }, 500);
          } catch (err) {
            setTimeout(() => {
              setModal({ type: 'status', data: { variant: 'danger', title: 'Error!', message: err.message || 'Gagal mengirim feedback.' } });
            }, 500);
          }
        }
      }
    });
  };

  // Handler untuk klik event - tampilkan detail modal
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventDetail(true);
  };

  // Handler untuk menutup modal detail event
  const handleCloseEventDetail = () => {
    setShowEventDetail(false);
    setSelectedEvent(null);
  };

  // Klik notifikasi: tampilkan detail event proposal
  const handleAdminNotifClick = (n) => {
    let payload = {};
    try {
      payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : (n.payload || n.data || {});
    } catch {
      payload = n.payload || n.data || {};
    }

    // Check if it's an event proposal
    const eventName = payload.eventName || 'Unknown Event';
    const speaker = payload.speaker || '-';
    const date = payload.date || '-';
    const location = payload.location || '-';
    const description = payload.description || '-';

    setModal({
      type: 'status',
      data: {
        variant: 'info',
        title: 'Detail Event Proposal',
        message: `Event: ${eventName}\nSpeaker: ${speaker}\nDate: ${date}\nLocation: ${location}\n\nDescription: ${description}`,
      }
    });
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <MainHeader pageTitle="SUPER ADMIN" />
      <main className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Event Approval</h2>
          <div className="flex justify-between mb-4">
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-1/2 px-4 py-2 border rounded-lg"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="All">All Status</option>
              <option value="pending">Pending</option>
              <option value="revised">Revised</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-gray-600 border-b border-gray-200">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Location</th>
                <th className="p-3 font-semibold text-center">Status</th>
                <th className="p-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, index) => {
                const rowNumber = (currentPage - 1) * (paginationInfo?.pageSize || 10) + index + 1;

                // Date Formatting Helper
                const dateObj = new Date(event.startDate || event.date);
                const day = dateObj.getDate();
                const month = dateObj.toLocaleString('en-US', { month: 'long' });
                const year = dateObj.getFullYear();
                const suffix = (day) => {
                  if (day > 3 && day < 21) return 'th';
                  switch (day % 10) {
                    case 1: return "st";
                    case 2: return "nd";
                    case 3: return "rd";
                    default: return "th";
                  }
                };
                const formattedDate = `${day}${suffix(day)} ${month} ${year} - ${event.startTime ? event.startTime.substring(0, 5).replace(':', '.') : ''}`;

                // Status Styling Helper
                let statusText = event.status;
                let statusColor = "text-gray-500";
                let dotColor = "text-gray-300";

                switch (event.status?.toLowerCase()) {
                  case 'approved':
                    statusText = 'Accepted';
                    statusColor = "text-green-500";
                    dotColor = "text-green-500";
                    break;
                  case 'pending':
                    statusText = 'Pending';
                    statusColor = "text-orange-500";
                    dotColor = "text-orange-500";
                    break;
                  case 'rejected':
                    statusText = 'Rejected';
                    statusColor = "text-red-500";
                    dotColor = "text-red-500";
                    break;
                  case 'revised':
                    statusText = 'Revised';
                    statusColor = "text-blue-600";
                    dotColor = "text-blue-600";
                    break;
                  default:
                    break;
                }

                return (
                  <tr
                    key={event.id}
                    className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors`}
                  >
                    <td className="p-3">
                      <span className="font-bold text-gray-500 mr-2">{rowNumber}.</span>
                      <span className="font-bold text-gray-800">{event.name || event.eventName}</span>
                    </td>
                    <td className="p-3 font-medium text-gray-700">{formattedDate}</td>
                    <td className="p-3 font-medium text-gray-700">{event.location}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-bold ${statusColor}`}>{statusText}</span>
                        <FaCircle className={`w-3 h-3 ${dotColor}`} />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleEventClick(event)}
                          className="bg-[#2D75B6] hover:bg-blue-700 text-white p-1 rounded-md transition-colors"
                          title="Review / Edit"
                        >
                          <FaPenSquare className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEventClick(event)}
                          className="text-gray-600 hover:text-gray-800 transition-colors"
                          title="View Details"
                        >
                          <FaEye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {paginationInfo && paginationInfo.totalPages > 1 && (
            <div className="mt-4 flex justify-center items-center gap-2">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">
                Prev
              </button>
              <span>Page {paginationInfo.currentPage} of {paginationInfo.totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === paginationInfo.totalPages} className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50">
                Next
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg flex justify-between items-center">
            <div>
              <h3 className="text-gray-500 font-medium text-sm">Target Time</h3>
              <p className="text-xs text-gray-400">Asia/Jakarta</p>
            </div>
            <RealtimeClock className="text-gray-800" />
          </div>
          <FeedbackPanel
            feedbackList={adminNotifications}
            onFeedbackClick={handleAdminNotifClick}
          />
        </div>
      </main>
      <StatusModal
        isOpen={modal.type === 'status'}
        onClose={() => setModal({ type: null, data: null })}
        title={modal.data?.title}
        message={modal.data?.message}
        variant={modal.data?.variant}
      />
      <ConfirmationModal
        isOpen={modal.type === 'confirm'}
        onClose={() => setModal({ type: null, data: null })}
        onConfirm={modal.data?.onConfirm}
        title={modal.data?.title}
        message={modal.data?.message}
        variant={modal.data?.variant || 'default'}
      />
      <TextInputModal
        isOpen={modal.type === 'textinput'}
        onClose={() => setModal({ type: null, data: null })}
        onSubmit={modal.data?.onSubmit}
        title={modal.data?.title}
        label={modal.data?.label}
        placeholder={modal.data?.placeholder}
        defaultValue={modal.data?.defaultValue}
      />
      <EventDetailModal
        isOpen={showEventDetail}
        onClose={handleCloseEventDetail}
        event={selectedEvent}
        onApprove={(eventId, eventName) => {
          handleCloseEventDetail();
          handleApprove(eventId, eventName);
        }}
        onReject={(eventId, eventName) => {
          handleCloseEventDetail();
          handleReject(eventId, eventName);
        }}
        onRevise={(eventId, eventName) => {
          handleCloseEventDetail();
          handleFeedback(eventId, eventName);
        }}
      />
    </div>
  );
};

export default SuperAdminDashboard;