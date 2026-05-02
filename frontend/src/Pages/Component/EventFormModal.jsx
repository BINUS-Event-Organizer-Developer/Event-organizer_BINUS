// src/components/EventFormModal.jsx
import React, { useState, useEffect } from 'react';
import { validateEventName, validateTime, validateTimeRange, validateDate, validateLocation, validateSpeaker, validateImage } from '../../services/validation';

const EventFormModal = ({ isOpen, onClose, onSave, eventToEdit, helperMessage }) => {
  const [formData, setFormData] = useState({
    eventName: '',
    location: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    speaker: '',
    description: '',
    image: null
  });
  const [errors, setErrors] = useState({});
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState(null);

  const isEditMode = Boolean(eventToEdit);

  // useEffect diperbarui untuk mengatur pratinjau gambar juga
  useEffect(() => {
    if (isOpen && isEditMode) {
      // const [datePart, timePart] = (eventToEdit.date || ' - ').split(' - ');
      setFormData({
        eventName: eventToEdit.name || eventToEdit.eventName || '',
        location: eventToEdit.location || '',
        startDate: eventToEdit.startDate ? String(eventToEdit.startDate).substring(0, 10) : (eventToEdit.date ? String(eventToEdit.date).substring(0, 10) : ''),
        endDate: eventToEdit.endDate ? String(eventToEdit.endDate).substring(0, 10) : (eventToEdit.date ? String(eventToEdit.date).substring(0, 10) : ''),
        startTime: eventToEdit.startTime || '',
        endTime: eventToEdit.endTime || '',
        speaker: eventToEdit.speaker || '',
        description: eventToEdit.description || '',
        image: null
      });
      setPreviewImageSrc(eventToEdit.imageUrl ? `${eventToEdit.imageUrl}?t=${new Date().getTime()}` : null);
    } else {
      // Reset semua state saat modal ditutup atau dalam mode 'New Event'
      setFormData({ eventName: '', location: '', startDate: '', endDate: '', startTime: '', endTime: '', speaker: '', description: '', image: null });
      // Clean up previous object URL before setting to null
      if (previewImageSrc && previewImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previewImageSrc);
      }
      setPreviewImageSrc(null);
      setIsPreviewVisible(false); // Pastikan pratinjau tersembunyi saat dibuka kembali
    }

    // Cleanup function to revoke object URLs when component unmounts
    return () => {
      if (previewImageSrc && previewImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previewImageSrc);
      }
    };
  }, [isOpen, eventToEdit, isEditMode]);

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === 'image' && files && files[0]) {
      const file = files[0];

      // Validate file format
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Image Formats are not fit to our requirements');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file size (2MB = 2 * 1024 * 1024 bytes)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('Image is exceeding 2MB limit');
        e.target.value = ''; // Clear the input
        return;
      }

      setFormData(prev => ({ ...prev, image: file }));

      // Clean up previous object URL before creating new one
      if (previewImageSrc && previewImageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(previewImageSrc);
      }

      setPreviewImageSrc(URL.createObjectURL(file));

      // Clear any previous image errors since validation passed
      setErrors(prev => ({ ...prev, image: [] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));

      // Real-time validation
      let fieldErrors = [];
      switch (name) {
        case 'eventName':
          fieldErrors = validateEventName(value);
          break;
        case 'startTime':
          fieldErrors = validateTime(value, 'Waktu mulai event');
          if (fieldErrors.length === 0 && formData.endTime) {
            const timeRangeErrors = validateTimeRange(value, formData.endTime);
            fieldErrors = [...fieldErrors, ...timeRangeErrors];
          }
          break;
        case 'endTime':
          fieldErrors = validateTime(value, 'Waktu selesai event');
          if (fieldErrors.length === 0 && formData.startTime) {
            const timeRangeErrors = validateTimeRange(formData.startTime, value);
            fieldErrors = [...fieldErrors, ...timeRangeErrors];
          }
          break;
        case 'startDate':
        case 'endDate':
          // fieldErrors = validateDate(value, formData.startTime);
          break;
        case 'location':
          fieldErrors = validateLocation(value);
          break;
        case 'speaker':
          fieldErrors = validateSpeaker(value);
          break;
      }
      setErrors(prev => ({ ...prev, [name]: fieldErrors }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    const allErrors = {
      eventName: validateEventName(formData.eventName),
      startTime: validateTime(formData.startTime, 'Waktu mulai event'),
      endTime: validateTime(formData.endTime, 'Waktu selesai event'),
      startDate: !formData.startDate ? ['Start date is required'] : [],
      endDate: !formData.endDate ? ['End date is required'] : [],
      location: validateLocation(formData.location),
      speaker: validateSpeaker(formData.speaker),
      image: validateImage(formData.image, !isEditMode)
    };

    // Add time range validation
    if (allErrors.startTime.length === 0 && allErrors.endTime.length === 0) {
      const timeRangeErrors = validateTimeRange(formData.startTime, formData.endTime);
      if (timeRangeErrors.length > 0) {
        allErrors.endTime = [...allErrors.endTime, ...timeRangeErrors];
      }
    }

    setErrors(allErrors);

    // Check if there are any errors
    const hasErrors = Object.values(allErrors).some(errorArray => errorArray.length > 0);
    if (hasErrors) return;

    const fd = new FormData();
    fd.append('name', formData.eventName.trim());
    fd.append('startDate', formData.startDate);
    fd.append('endDate', formData.endDate);
    fd.append('startTime', formData.startTime);
    fd.append('endTime', formData.endTime);
    fd.append('location', formData.location.trim());
    if (formData.speaker) fd.append('speaker', formData.speaker.trim());
    if (formData.description) fd.append('description', formData.description.trim());
    if (formData.image) fd.append('image', formData.image);
    onSave(fd);
  };

  // Fungsi untuk toggle pratinjau
  const togglePreview = () => {
    setIsPreviewVisible(!isPreviewVisible);
  };

  if (!isOpen) return null;




  return (
    // Latar belakang modal
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className={`m-4 transform rounded-xl bg-white p-2 shadow-2xl transition-all lg:flex ${previewImageSrc ? "max-w-4xl w-full" : "max-w-2xl w-full"}`}>

        {/* Kolom Kiri: Form */}
        <div className="w-full lg:w-1/2 p-6">
          <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Event' : 'New Event'}</h2>
          {helperMessage && (
            <div className="mt-3 rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
              {helperMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Input fields tetap sama */}
            <div>
              <label htmlFor="eventName" className="block text-sm font-medium text-gray-600">Event Name *</label>
              <input type="text" name="eventName" id="eventName" value={formData.eventName} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.eventName?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
              {errors.eventName?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-600">Description</label>
              <textarea
                name="description"
                id="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Describe the event details..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">Max 5000 characters</p>
            </div>



            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-600">Location *</label>
                <input type="text" name="location" id="location" value={formData.location} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.location?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.location?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>

              <div>
                <label htmlFor="speaker" className="block text-sm font-medium text-gray-600">Speaker</label>
                <input type="text" name="speaker" id="speaker" value={formData.speaker} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.speaker?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.speaker?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-600">Start Date *</label>
                <input type="date" name="startDate" id="startDate" value={formData.startDate} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.startDate?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.startDate?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-600">End Date *</label>
                <input type="date" name="endDate" id="endDate" value={formData.endDate} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.endDate?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.endDate?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-600">Start Time *</label>
                <input type="time" name="startTime" id="startTime" value={formData.startTime} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.startTime?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.startTime?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-600">End Time *</label>
                <input type="time" name="endTime" id="endTime" value={formData.endTime} onChange={handleChange} className={`mt-1 w-full rounded-lg border px-4 py-2 focus:ring-blue-500 ${errors.endTime?.length ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'}`} />
                {errors.endTime?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              </div>
            </div>
            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-600">Poster {!isEditMode && '*'}</label>
              <input type="file" name="image" id="image" onChange={handleChange} accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" className={`mt-1 w-full text-sm file:mr-4 file:rounded-full file:border-0 file:py-2 file:px-4 file:text-sm file:font-semibold hover:file:bg-blue-100 ${errors.image?.length ? 'file:bg-red-50 file:text-red-700' : 'file:bg-blue-50 file:text-blue-700'}`} />
              {errors.image?.map((error, idx) => <p key={idx} className="text-red-500 text-xs mt-1">{error}</p>)}
              <p className="text-xs text-gray-500 mt-1">Max 2MB. Formats: JPEG, JPG, PNG, GIF, WebP</p>
              <p className="text-xs text-gray-500 mt-1">Tips: Compress your image before uploading here ( https://squoosh.app/ ).</p>
            </div>

            {/* Tombol Toggle Pratinjau */}
            <div className="pt-2">
              <button
                type="button"
                onClick={togglePreview}
                className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${isPreviewVisible ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
              >
                {isPreviewVisible ? 'Close Preview' : 'See Preview'}
              </button>
            </div>

            {/* Tombol Aksi Utama */}
            <div className="flex justify-end gap-4 pt-4 ">
              <button type="button" onClick={onClose} className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-800 hover:bg-gray-300">Cancel</button>
              <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700">Save Event</button>
            </div>
          </form>
        </div>

        {/* Kolom Kanan: Area Pratinjau */}
        <div className={`relative w-full items-center justify-center rounded-lg bg-gray-50 lg:w-1/2 p-4 ${isPreviewVisible ? 'flex ' : 'hidden'}`}>
          {isPreviewVisible ? (
            previewImageSrc ? (
              <img src={previewImageSrc} alt="image Preview" className="max-h-[500px] w-auto rounded-md object-contain shadow-md" />
            ) : (
              <div className="text-center text-gray-500">Tidak ada image untuk ditampilkan. Silakan unggah gambar.</div>
            )
          ) : (
            <div className="text-center text-gray-500">Pratinjau image akan muncul di sini.</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default EventFormModal;