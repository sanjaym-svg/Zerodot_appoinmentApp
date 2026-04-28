// ========================================
// Zerodot Salon — Data Layer (localStorage)
// ========================================

const SalonData = (() => {
    const KEYS = {
        APPOINTMENTS: 'zerodot_appointments',
        SETTINGS: 'zerodot_settings',
    };

    const DEFAULT_SETTINGS = {
        openTime: 9,   // 9 AM
        closeTime: 20,  // 8 PM
        slotDuration: 60, // minutes
        leaveDays: [],  // array of date strings "YYYY-MM-DD"
        ownerPin: '1234',
    };

    const SERVICES = {
        male: [
            { id: 'haircut_m', name: 'Haircut', icon: '✂️', duration: 60 },
            { id: 'beard_trim', name: 'Beard Trim', icon: '🪒', duration: 60 },
            { id: 'hair_color_m', name: 'Hair Color', icon: '🎨', duration: 60 },
            { id: 'head_massage', name: 'Head Massage', icon: '💆‍♂️', duration: 60 },
            { id: 'full_package_m', name: 'Full Package', icon: '👑', duration: 60 },
        ],
        female: [
            { id: 'haircut_f', name: 'Haircut', icon: '✂️', duration: 60 },
            { id: 'hair_color_f', name: 'Hair Color', icon: '🎨', duration: 60 },
            { id: 'hair_spa', name: 'Hair Spa', icon: '🧖‍♀️', duration: 60 },
            { id: 'facial', name: 'Facial', icon: '✨', duration: 60 },
            { id: 'bridal_package', name: 'Bridal Package', icon: '👰', duration: 60 },
        ],
    };

    // — Helpers —
    function _get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
    }
    function _set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }
    function _today() {
        const d = new Date();
        return _formatDate(d);
    }
    function _formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function _generateId() {
        return 'ZD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }

    // — Settings —
    function getSettings() {
        return { ...DEFAULT_SETTINGS, ..._get(KEYS.SETTINGS, {}) };
    }
    function updateSettings(partial) {
        const current = getSettings();
        _set(KEYS.SETTINGS, { ...current, ...partial });
    }
    function isLeaveDay(dateStr) {
        const s = getSettings();
        return s.leaveDays.includes(dateStr);
    }
    function toggleLeaveDay(dateStr) {
        const s = getSettings();
        const idx = s.leaveDays.indexOf(dateStr);
        if (idx > -1) {
            s.leaveDays.splice(idx, 1);
        } else {
            s.leaveDays.push(dateStr);
        }
        _set(KEYS.SETTINGS, s);
        return s.leaveDays.includes(dateStr);
    }
    function verifyPin(pin) {
        return getSettings().ownerPin === pin;
    }
    function changePin(newPin) {
        updateSettings({ ownerPin: newPin });
    }

    // — Appointments —
    function getAllAppointments() {
        return _get(KEYS.APPOINTMENTS, []);
    }
    function getAppointmentsByDate(dateStr) {
        return getAllAppointments().filter(a => a.date === dateStr && a.status !== 'cancelled');
    }
    function getAppointmentsByPhone(phone) {
        return getAllAppointments().filter(a => a.phone === phone);
    }
    function getAppointmentById(id) {
        return getAllAppointments().find(a => a.id === id);
    }

    // — Slot Generation —
    function getSlots(dateStr) {
        const s = getSettings();
        const slots = [];
        const now = new Date();
        const isToday = dateStr === _today();

        for (let h = s.openTime; h < s.closeTime; h++) {
            const startLabel = _formatHour(h);
            const endLabel = _formatHour(h + 1);
            const slotTime = `${startLabel} - ${endLabel}`;

            // Check if this slot is in the past
            let isPast = false;
            if (isToday && h < now.getHours()) {
                isPast = true;
            }
            // If it's the current hour, also mark as past (can't book within the current hour)
            if (isToday && h === now.getHours()) {
                isPast = true;
            }

            // Check if booked
            const booked = getAppointmentsByDate(dateStr).find(a => a.timeSlot === slotTime);

            slots.push({
                hour: h,
                time: slotTime,
                isPast,
                isBooked: !!booked,
                booking: booked || null,
            });
        }
        return slots;
    }

    function _formatHour(h) {
        if (h === 0 || h === 24) return '12:00 AM';
        if (h === 12) return '12:00 PM';
        if (h < 12) return `${h}:00 AM`;
        return `${h - 12}:00 PM`;
    }

    // — Booking —
    function bookSlot(data) {
        // data: { name, phone, gender, service, date, timeSlot, notes }
        const appointments = getAllAppointments();

        // Double-booking check
        const conflict = appointments.find(
            a => a.date === data.date && a.timeSlot === data.timeSlot && a.status !== 'cancelled'
        );
        if (conflict) {
            return { success: false, error: 'This slot is already booked.' };
        }

        // Leave day check
        if (isLeaveDay(data.date)) {
            return { success: false, error: 'The salon is closed on this day.' };
        }

        const appointment = {
            id: _generateId(),
            name: data.name,
            phone: data.phone,
            gender: data.gender,
            service: data.service,
            date: data.date,
            timeSlot: data.timeSlot,
            notes: data.notes || '',
            status: 'upcoming', // upcoming | completed | cancelled
            bookedAt: new Date().toISOString(),
            cancelledAt: null,
            completedAt: null,
        };

        appointments.push(appointment);
        _set(KEYS.APPOINTMENTS, appointments);
        return { success: true, appointment };
    }

    function cancelBooking(id, reason = '') {
        const appointments = getAllAppointments();
        const idx = appointments.findIndex(a => a.id === id);
        if (idx === -1) return { success: false, error: 'Booking not found.' };
        
        appointments[idx].status = 'cancelled';
        appointments[idx].cancelledAt = new Date().toISOString();
        appointments[idx].cancelReason = reason;
        _set(KEYS.APPOINTMENTS, appointments);
        return { success: true };
    }

    function completeBooking(id) {
        const appointments = getAllAppointments();
        const idx = appointments.findIndex(a => a.id === id);
        if (idx === -1) return { success: false, error: 'Booking not found.' };
        
        appointments[idx].status = 'completed';
        appointments[idx].completedAt = new Date().toISOString();
        _set(KEYS.APPOINTMENTS, appointments);
        return { success: true };
    }

    // — Utility: Next 3 days —
    function getNextDays(count = 3) {
        const days = [];
        const now = new Date();
        for (let i = 0; i < count; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            days.push({
                date: _formatDate(d),
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: d.getDate(),
                monthName: d.toLocaleDateString('en-US', { month: 'short' }),
                isToday: i === 0,
                isLeave: isLeaveDay(_formatDate(d)),
            });
        }
        return days;
    }

    // — Next 7 days (for owner calendar) —
    function getNextWeek() {
        return getNextDays(7);
    }

    // — Export / Import —
    function exportData() {
        return JSON.stringify({
            appointments: getAllAppointments(),
            settings: getSettings(),
            exportedAt: new Date().toISOString(),
        }, null, 2);
    }
    function importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.appointments) _set(KEYS.APPOINTMENTS, data.appointments);
            if (data.settings) _set(KEYS.SETTINGS, data.settings);
            return { success: true };
        } catch {
            return { success: false, error: 'Invalid data format.' };
        }
    }

    // — Stats for owner —
    function getDayStats(dateStr) {
        const all = getAllAppointments().filter(a => a.date === dateStr);
        return {
            total: all.filter(a => a.status !== 'cancelled').length,
            upcoming: all.filter(a => a.status === 'upcoming').length,
            completed: all.filter(a => a.status === 'completed').length,
            cancelled: all.filter(a => a.status === 'cancelled').length,
        };
    }

    return {
        SERVICES,
        getSettings, updateSettings, isLeaveDay, toggleLeaveDay,
        verifyPin, changePin,
        getAllAppointments, getAppointmentsByDate, getAppointmentsByPhone, getAppointmentById,
        getSlots, bookSlot, cancelBooking, completeBooking,
        getNextDays, getNextWeek, getDayStats,
        exportData, importData,
    };
})();
