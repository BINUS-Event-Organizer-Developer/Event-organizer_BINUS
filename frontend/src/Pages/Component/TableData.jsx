// src/components/MyEventsTable.jsx
import React from 'react';
import { FaPenSquare, FaWindowClose, FaCircle } from 'react-icons/fa';

const statusStyles = {
  Accepted: "bg-green-100 text-green-800",
  Approved: "bg-green-100 text-green-800",
  Pending: "bg-yellow-100 text-yellow-800",
  Revision: "bg-blue-100 text-blue-800",
  Rejected: "bg-red-100 text-red-800",
};

const MyEventsTable = ({ events, onEdit, onDelete, currentPage = 1, pageSize = 10 }) => {
  return (
    <div className="overflow-x-auto">
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
          {events.map((event, index) => {
            const rowNumber = (currentPage - 1) * pageSize + index + 1;

            // Date Formatting
            const dateObj = new Date(event.startDate || event.date);
            const day = dateObj.getDate();
            const month = dateObj.toLocaleString('en-US', { month: 'long' });
            const year = dateObj.getFullYear();
            const suffix = (d) => {
              if (d > 3 && d < 21) return 'th';
              switch (d % 10) {
                case 1: return "st";
                case 2: return "nd";
                case 3: return "rd";
                default: return "th";
              }
            };
            const formattedDate = `${day}${suffix(day)} ${month} ${year} - ${event.startTime ? event.startTime.substring(0, 5).replace(':', '.') : ''}`;

            // Status Styling
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
              default: break;
            }

            return (
              <tr key={event.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors`}>
                <td className="p-3">
                  <span className="font-bold text-gray-500 mr-2">{rowNumber}.</span>
                  {/* Underlined name for admins as per design hints if needed, but bold is safer */}
                  <span className="font-bold text-gray-800 underline decoration-blue-500 cursor-pointer" onClick={() => onEdit(event)}>{event.name || event.eventName}</span>
                </td>
                <td className="p-3 font-medium text-gray-700">{formattedDate}</td>
                <td className="p-3 font-medium text-gray-700">{event.location}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`font-bold ${statusColor}`}>{statusText}</span>
                    <FaCircle className={`w-3 h-3 ${dotColor}`} />
                  </div>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => onEdit(event)}
                      className="text-[#2D75B6] hover:text-blue-800 transition-colors"
                      title="Edit Event"
                    >
                      <FaPenSquare className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => onDelete(event.id)}
                      className="text-[#E02424] hover:text-red-800 transition-colors"
                      title="Delete Event"
                    >
                      {/* Using a filled square times icon or just FaWindowClose/FaTimes? Design usually has square bg. I'll use FaWindowClose for a square look or FaTimes inside a box. 
                       Wait, the user said "Action" column. 
                       I will use FaWindowClose which looks like a square with X or styled button. 
                       The super admin used buttons with icons. 
                       Let's make them look like icons directly as per previous instruction context "icons".
                       I'll use FaWindowClose which is square with X. */}
                      <FaWindowClose className="w-6 h-6" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MyEventsTable;