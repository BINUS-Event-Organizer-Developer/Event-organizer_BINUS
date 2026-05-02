import { useState, useEffect } from "react";
import {
  FaRegClock,
  FaRegCalendarAlt,
  FaMapMarkerAlt,
  FaClock,
  FaCalendar,
} from "react-icons/fa";
import { BsBookmark, BsBookmarkFill } from "react-icons/bs";
import SearchBar from "./Component/searchBar";
import EventCarousel from "./Component/eventCarousel";
import "./Component/background.css";
import { FaLocationPin } from "react-icons/fa6";
import RealtimeClock from "./Component/realtime";
import MainHeader from "./Component/MainHeader";
import { getEventsByCategory } from "../services/event";
import { Navigate } from "react-router";

const DashboardUser = () => {
  const [currentEvents, setCurrentEvents] = useState([]);
  const [thisWeekEvents, setThisWeekEvents] = useState([]);
  const [nextEvents, setNextEvents] = useState([]);
  const [searchItem, setSearchItem] = useState("");
  const [filteredThisWeek, setFilteredThisWeek] = useState([]); // State terpisah untuk hasil filter
  const [loading, setLoading] = useState(true);
  const [bookmarkedEvents, setBookmarkedEvents] = useState(new Set());

  const toggleBookmark = (id) => {
    setBookmarkedEvents((prev) => {
      const newBookmarks = new Set(prev);
      newBookmarks.has(id) ? newBookmarks.delete(id) : newBookmarks.add(id);
      return newBookmarks;
    });
  };

  useEffect(() => {
    const fetchCategorizedEvents = async () => {
      setLoading(true);
      try {
        const responseData = await getEventsByCategory();
        const { current, thisWeek, next } = responseData.data;

        setCurrentEvents(current || []);
        setThisWeekEvents(thisWeek || []);
        setNextEvents(next || []);

      } catch (err) {
        console.error("Error fetching categorized events:", err);
        setCurrentEvents([]);
        setThisWeekEvents([]);
        setNextEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategorizedEvents();
  }, []);

  // --- PERBAIKAN LOGIKA FILTER ---
  // Gunakan useEffect untuk memfilter `thisWeekEvents` setiap kali searchItem atau data asli berubah
  useEffect(() => {
    if (!searchItem) {
      setFilteredThisWeek(thisWeekEvents); // Jika tidak ada pencarian, tampilkan semua event minggu ini
      return;
    }

    const searchTermLower = searchItem.toLowerCase();
    const results = thisWeekEvents.filter((event) => {
      // Logika pencarian Anda sudah benar
      return `${event.name || event.eventName} ${event.location} ${event.speaker}`
        .toLowerCase()
        .includes(searchTermLower);
    });
    setFilteredThisWeek(results);
  }, [searchItem, thisWeekEvents]); // Dijalankan saat searchItem atau thisWeekEvents berubah

  // Mapping data untuk EventCarousel
  const carouselData = currentEvents.map(event => ({
    title: event.name || event.eventName,
    description: event.description,
    location: event.location,
    speaker: event.speaker,
    date: new Date(event.startDate || event.date).toLocaleDateString(),
    time: `${event.startTime} - ${event.endTime}`,
    image: event.imageUrl || '/api/placeholder/400/300'
  }));

  return (
    <div className="w-full relative overflow-x-hidden min-h-screen flex flex-col">
      <MainHeader pageTitle="Event Viewer" />

      <div className="p-5 space-y-2 bg-[#3C82CE]">
        <div className="flex items-center justify-between mb-3 px-20 text-white">
          <h1 className="text-2xl font-semibold">Current Events</h1>
          <RealtimeClock />
        </div>
        <div className="grid gap-2 w-full place-items-center">
          {/* Pastikan carouselData diteruskan dengan benar */}
          <EventCarousel carouselData={carouselData} />
        </div>
      </div>

      <div className="px-5 md:px-10 xl:px-20 pt-5 bgDash flex-1 flex flex-col">
        <div className="bg-white w-full flex-1 px-10 py-5 rounded-t-xl pb-10 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-semibold">This Week</h1>
            <div className="flex items-center gap-4">
              <SearchBar searchTerm={searchItem} onSearch={setSearchItem} />
            </div>
          </div>

          <ul className="mt-4 space-y-4 divide-y-2 min-h-[200px]">
            {loading ? (
              <p>Loading...</p>
            ) : filteredThisWeek.length > 0 ? (
              // Gunakan state filteredThisWeek untuk me-render
              filteredThisWeek.map((event, index) => (
                <li key={event.id} className={`p-4 ${index % 2 === 0 ? "bg-gray-50" : "bg-white"} flex items-center justify-between`}>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{event.name || event.eventName}</p>
                    {event.description && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{event.description}</p>
                    )}
                    <div className="flex items-center text-sm text-gray-600 space-x-3 mt-2">
                      <span className="flex items-center">
                        <FaRegCalendarAlt className="mr-1" /> {new Date(event.startDate || event.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <FaRegClock className="mr-1" /> {`${event.startTime} - ${event.endTime}`}
                      </span>
                      <span className="flex items-center">
                        <FaMapMarkerAlt className="mr-1 text-red-500" />{" "}
                        {event.location}
                      </span>
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <p>No events found for this week.</p>
            )}
          </ul>

          <div className="flex flex-col xl:flex-row gap-8 w-full mt-10">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold mb-5">Next Events</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
                {nextEvents.slice(0, 4).map((event) => {
                  // Date Formatting Helper
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
                  const formattedDate = `${day}${suffix(day)} ${month} ${year}`;

                  return (
                    <div
                      key={event.id + "-next"}
                      className="px-5 py-4 border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-3"
                    >
                      <h1 className="text-base font-bold text-gray-900 leading-snug line-clamp-2">{event.name || event.eventName}</h1>

                      <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <FaClock className="text-[#F97316] w-4 h-4 shrink-0" /> {/* Orange */}
                          <span>{event.startTime} - {event.endTime}</span>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <FaRegCalendarAlt className="text-[#3B82F6] w-4 h-4 shrink-0" /> {/* Blue */}
                          <span>{formattedDate}</span>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <FaLocationPin className="text-[#EF4444] w-4 h-4 shrink-0" /> {/* Red */}
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QR Code Section */}
            <div className="w-full xl:w-72 flex-shrink-0 flex flex-col items-center justify-center p-6 border border-gray-200 rounded-xl bg-gradient-to-b from-blue-50 to-white shadow-sm mt-12 xl:mt-0">
              <h3 className="font-bold text-gray-800 text-lg mb-2 text-center">Ajukan Event!</h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                Punya ide acara keren? Scan QR ini untuk mengisi form pengajuan ke PIC Event.
              </p>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                <img
                  src="../../src/assets/QRForm.png"
                  alt="QR Code Pengajuan Event"
                  className="w-32 h-32 object-contain"
                />
              </div>
              <a href="https://forms.gle/Nzn4jgG55NsX14tEA" target="_blank" rel="noopener noreferrer" className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 underline">
                Atau klik di sini
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full h-fit px-10 py-5 bg-[#F3F3F3] text-right">
        <p className="text-gray-600">Universitas Bina Nusantara Bekasi 2023</p>
      </div>

    </div>
  );
};

export default DashboardUser;