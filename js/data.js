// ========================================
// Zerodot Salon — Data Layer
// localStorage + Firebase Realtime Sync
// Full-featured: Multi-service, Workers,
// Payments, Dynamic Service Catalog
// ========================================

const SalonData = (() => {
    const KEYS = {
        APPOINTMENTS: 'zerodot_appointments',
        SETTINGS: 'zerodot_settings',
        WORKERS: 'zerodot_workers',
    };

    const DEFAULT_SETTINGS = {
        openTime: 9,    // 9 AM
        closeTime: 20,  // 8 PM
        slotDuration: 60, // minutes
        leaveDays: [],  // array of date strings "YYYY-MM-DD"
        ownerPin: '1234',
    };

    // Default services — will be copied to settings on first run
    // Owner can add/edit/remove from the dashboard
    const DEFAULT_SERVICES = {
        male: [
            { id: 'haircut_m', name: 'Haircut', icon: '✂️', price: 200 },
            { id: 'beard_trim', name: 'Beard Trim', icon: '🪒', price: 100 },
            { id: 'hair_color_m', name: 'Hair Color', icon: '🎨', price: 800 },
            { id: 'head_massage', name: 'Head Massage', icon: '💆‍♂️', price: 300 },
            { id: 'facial_m', name: 'Facial', icon: '✨', price: 500 },
            { id: 'full_package_m', name: 'Full Package', icon: '👑', price: 1200 },
        ],
        female: [
            { id: 'haircut_f', name: 'Haircut', icon: '✂️', price: 300 },
            { id: 'hair_color_f', name: 'Hair Color', icon: '🎨', price: 1500 },
            { id: 'hair_spa', name: 'Hair Spa', icon: '🧖‍♀️', price: 800 },
            { id: 'facial_f', name: 'Facial', icon: '✨', price: 600 },
            { id: 'bridal_makeup', name: 'Bridal Makeup', icon: '👰', price: 5000 },
            { id: 'threading', name: 'Threading', icon: '🪡', price: 100 },
            { id: 'manicure', name: 'Manicure', icon: '💅', price: 400 },
        ],
    };

    // Firebase path mapping
    const FB_PATHS = {
        [KEYS.APPOINTMENTS]: 'appointments',
        [KEYS.SETTINGS]: 'settings',
        [KEYS.WORKERS]: 'workers',
    };

    // Track if Firebase sync is active
    let _firebaseReady = false;
    let _onDataChange = null; // callback for UI refresh on remote changes

    // — Helpers —
    function _get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
    }
    function _set(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
        // Sync to Firebase if available
        if (_firebaseReady && typeof FirebaseSync !== 'undefined') {
            const fbPath = FB_PATHS[key];
            if (fbPath) {
                FirebaseSync.write(fbPath, val, key);
            }
        }
    }
    function _today() {
        return _formatDate(new Date());
    }
    function _formatDate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    function _generateId(prefix = 'ZD') {
        return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }

    // =============================================
    // SETTINGS
    // =============================================
    function getSettings() {
        return { ...DEFAULT_SETTINGS, ..._get(KEYS.SETTINGS, {}) };
    }
    function updateSettings(partial) {
        const current = getSettings();
        _set(KEYS.SETTINGS, { ...current, ...partial });
    }
    function isLeaveDay(dateStr) {
        return getSettings().leaveDays.includes(dateStr);
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

    // =============================================
    // SERVICES (Dynamic, owner-controlled)
    // =============================================
    function getServices() {
        const s = getSettings();
        if (s.services) return s.services;
        // First run: copy defaults into settings
        updateSettings({ services: DEFAULT_SERVICES });
        return DEFAULT_SERVICES;
    }

    function getAllServicesList() {
        // Returns flat array of all services with gender info
        const svcs = getServices();
        const list = [];
        (svcs.male || []).forEach(s => list.push({ ...s, gender: 'male' }));
        (svcs.female || []).forEach(s => list.push({ ...s, gender: 'female' }));
        return list;
    }

    function addService(gender, service) {
        const svcs = getServices();
        if (!svcs[gender]) svcs[gender] = [];
        const newSvc = {
            id: _generateId('SVC'),
            name: service.name,
            icon: service.icon || '✂️',
            price: service.price || 0,
        };
        svcs[gender].push(newSvc);
        updateSettings({ services: svcs });
        return newSvc;
    }

    function updateService(gender, serviceId, updates) {
        const svcs = getServices();
        if (!svcs[gender]) return false;
        const idx = svcs[gender].findIndex(s => s.id === serviceId);
        if (idx === -1) return false;
        svcs[gender][idx] = { ...svcs[gender][idx], ...updates };
        updateSettings({ services: svcs });
        return true;
    }

    function removeService(gender, serviceId) {
        const svcs = getServices();
        if (!svcs[gender]) return false;
        svcs[gender] = svcs[gender].filter(s => s.id !== serviceId);
        updateSettings({ services: svcs });
        return true;
    }

    // =============================================
    // WORKERS
    // =============================================
    function getWorkers() {
        return _get(KEYS.WORKERS, []);
    }

    function getActiveWorkers() {
        return getWorkers().filter(w => w.isActive);
    }

    function getWorkerById(id) {
        return getWorkers().find(w => w.id === id);
    }

    function addWorker(worker) {
        const workers = getWorkers();
        const newWorker = {
            id: _generateId('W'),
            name: worker.name,
            phone: worker.phone || '',
            gender: worker.gender || 'male',
            specializations: worker.specializations || [], // service IDs
            isActive: true,
            avatar: worker.avatar || (worker.gender === 'female' ? '👩' : '👨'),
            joinedAt: new Date().toISOString(),
        };
        workers.push(newWorker);
        _set(KEYS.WORKERS, workers);
        return newWorker;
    }

    function updateWorker(workerId, updates) {
        const workers = getWorkers();
        const idx = workers.findIndex(w => w.id === workerId);
        if (idx === -1) return false;
        workers[idx] = { ...workers[idx], ...updates };
        _set(KEYS.WORKERS, workers);
        return true;
    }

    function removeWorker(workerId) {
        let workers = getWorkers();
        workers = workers.filter(w => w.id !== workerId);
        _set(KEYS.WORKERS, workers);
        return true;
    }

    function getAvailableWorkers(date, timeSlot, serviceIds) {
        // Find workers who:
        // 1. Are active
        // 2. Can do at least one of the requested services (or have no specializations = can do anything)
        // 3. Are not already booked at this date+time
        const workers = getActiveWorkers();
        const bookedWorkerIds = getAllAppointments()
            .filter(a => a.date === date && a.timeSlot === timeSlot && a.status !== 'cancelled' && a.workerId)
            .map(a => a.workerId);

        return workers.filter(w => {
            // Already booked?
            if (bookedWorkerIds.includes(w.id)) return false;
            // If worker has no specializations, they can do anything
            if (!w.specializations || w.specializations.length === 0) return true;
            // Check if worker can do at least one of the requested services
            if (!serviceIds || serviceIds.length === 0) return true;
            return serviceIds.some(sId => w.specializations.includes(sId));
        });
    }

    // =============================================
    // APPOINTMENTS
    // =============================================
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

    // =============================================
    // SLOT GENERATION
    // =============================================
    function getSlots(dateStr) {
        const s = getSettings();
        const slots = [];
        const now = new Date();
        const isToday = dateStr === _today();

        for (let h = s.openTime; h < s.closeTime; h++) {
            const startLabel = _formatHour(h);
            const endLabel = _formatHour(h + 1);
            const slotTime = `${startLabel} - ${endLabel}`;

            let isPast = false;
            if (isToday && h <= now.getHours()) {
                isPast = true;
            }

            // Count bookings in this slot (multiple workers = multiple bookings possible)
            const slotBookings = getAppointmentsByDate(dateStr).filter(a => a.timeSlot === slotTime);
            const activeWorkers = getActiveWorkers();
            const totalCapacity = Math.max(1, activeWorkers.length); // At least 1 (owner)
            const isFullyBooked = slotBookings.length >= totalCapacity;

            slots.push({
                hour: h,
                time: slotTime,
                isPast,
                isBooked: isFullyBooked,
                bookingsCount: slotBookings.length,
                capacity: totalCapacity,
                booking: slotBookings[0] || null,
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

    // =============================================
    // BOOKING (Multi-service + Worker)
    // =============================================
    function bookSlot(data) {
        // data: { name, phone, gender, services: [{id, name, price}], date, timeSlot, notes, workerId? }
        const appointments = getAllAppointments();

        // Leave day check
        if (isLeaveDay(data.date)) {
            return { success: false, error: 'The salon is closed on this day.' };
        }

        // Check capacity
        const slotBookings = appointments.filter(
            a => a.date === data.date && a.timeSlot === data.timeSlot && a.status !== 'cancelled'
        );
        const activeWorkers = getActiveWorkers();
        const totalCapacity = Math.max(1, activeWorkers.length);
        if (slotBookings.length >= totalCapacity) {
            return { success: false, error: 'This slot is fully booked.' };
        }

        // If worker specified, check they're free
        if (data.workerId) {
            const workerBooked = slotBookings.find(a => a.workerId === data.workerId);
            if (workerBooked) {
                return { success: false, error: 'This worker is already booked for this slot.' };
            }
        }

        // Calculate total
        const services = data.services || [];
        const totalAmount = services.reduce((sum, s) => sum + (s.price || 0), 0);

        // Get worker info
        let workerName = '';
        if (data.workerId) {
            const worker = getWorkerById(data.workerId);
            workerName = worker ? worker.name : '';
        }

        const appointment = {
            id: _generateId(),
            name: data.name,
            phone: data.phone,
            gender: data.gender,
            services: services,
            totalAmount: totalAmount,
            workerId: data.workerId || '',
            workerName: workerName,
            date: data.date,
            timeSlot: data.timeSlot,
            notes: data.notes || '',
            status: 'upcoming',
            payment: {
                status: 'pending',
                method: null,
                amount: totalAmount,
                paidAt: null,
            },
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

    // =============================================
    // PAYMENT TRACKING
    // =============================================
    function markPayment(appointmentId, method, amount) {
        const appointments = getAllAppointments();
        const idx = appointments.findIndex(a => a.id === appointmentId);
        if (idx === -1) return { success: false, error: 'Booking not found.' };

        appointments[idx].payment = {
            status: 'paid',
            method: method, // 'cash', 'upi', 'card'
            amount: amount,
            paidAt: new Date().toISOString(),
        };
        // Also mark as completed if not already
        if (appointments[idx].status === 'upcoming') {
            appointments[idx].status = 'completed';
            appointments[idx].completedAt = new Date().toISOString();
        }
        _set(KEYS.APPOINTMENTS, appointments);
        return { success: true };
    }

    // =============================================
    // CLIENT HISTORY
    // =============================================
    function getClientHistory(phone) {
        const bookings = getAppointmentsByPhone(phone);
        const totalVisits = bookings.filter(b => b.status === 'completed').length;
        const totalSpent = bookings
            .filter(b => b.payment && b.payment.status === 'paid')
            .reduce((sum, b) => sum + (b.payment.amount || 0), 0);

        return {
            bookings,
            totalVisits,
            totalSpent,
            isRepeatClient: totalVisits > 1,
        };
    }

    // =============================================
    // REVENUE & STATS
    // =============================================
    function getRevenueStats(period = 'today') {
        const appointments = getAllAppointments();
        const now = new Date();
        let startDate;

        switch (period) {
            case 'today':
                startDate = _today();
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = _formatDate(weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate = _formatDate(monthAgo);
                break;
            default:
                startDate = '2000-01-01';
        }

        const filtered = appointments.filter(a =>
            a.date >= startDate && a.payment && a.payment.status === 'paid'
        );

        const totalRevenue = filtered.reduce((sum, a) => sum + (a.payment.amount || 0), 0);
        const totalBookings = filtered.length;

        // Revenue by method
        const byMethod = { cash: 0, upi: 0, card: 0 };
        filtered.forEach(a => {
            const m = a.payment.method || 'cash';
            byMethod[m] = (byMethod[m] || 0) + (a.payment.amount || 0);
        });

        // Daily revenue for chart (last 7 days)
        const dailyRevenue = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = _formatDate(d);
            const dayRevenue = appointments
                .filter(a => a.date === dateStr && a.payment && a.payment.status === 'paid')
                .reduce((sum, a) => sum + (a.payment.amount || 0), 0);
            dailyRevenue.push({
                date: dateStr,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: dayRevenue,
            });
        }

        return { totalRevenue, totalBookings, byMethod, dailyRevenue };
    }

    function getTopServices(limit = 5) {
        const appointments = getAllAppointments().filter(a => a.status === 'completed');
        const counts = {};

        appointments.forEach(a => {
            const services = a.services || [{ name: a.service || 'Unknown' }];
            services.forEach(s => {
                counts[s.name] = (counts[s.name] || 0) + 1;
            });
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => ({ name, count }));
    }

    function getWorkerStats() {
        const appointments = getAllAppointments().filter(a => a.status === 'completed');
        const workers = getWorkers();
        const stats = {};

        workers.forEach(w => {
            const workerAppts = appointments.filter(a => a.workerId === w.id);
            const revenue = workerAppts
                .filter(a => a.payment && a.payment.status === 'paid')
                .reduce((sum, a) => sum + (a.payment.amount || 0), 0);
            stats[w.id] = {
                worker: w,
                appointments: workerAppts.length,
                revenue,
            };
        });

        // Unassigned appointments
        const unassigned = appointments.filter(a => !a.workerId);
        if (unassigned.length > 0) {
            stats['_unassigned'] = {
                worker: { name: 'Owner / Unassigned', avatar: '👤' },
                appointments: unassigned.length,
                revenue: unassigned
                    .filter(a => a.payment && a.payment.status === 'paid')
                    .reduce((sum, a) => sum + (a.payment.amount || 0), 0),
            };
        }

        return stats;
    }

    function getDayStats(dateStr) {
        const all = getAllAppointments().filter(a => a.date === dateStr);
        const paidToday = all
            .filter(a => a.payment && a.payment.status === 'paid')
            .reduce((sum, a) => sum + (a.payment.amount || 0), 0);

        return {
            total: all.filter(a => a.status !== 'cancelled').length,
            upcoming: all.filter(a => a.status === 'upcoming').length,
            completed: all.filter(a => a.status === 'completed').length,
            cancelled: all.filter(a => a.status === 'cancelled').length,
            revenue: paidToday,
        };
    }

    function getUniqueClients() {
        const appointments = getAllAppointments().filter(a => a.status === 'completed');
        const phones = new Set(appointments.map(a => a.phone));
        const repeatPhones = [];
        phones.forEach(phone => {
            if (appointments.filter(a => a.phone === phone).length > 1) {
                repeatPhones.push(phone);
            }
        });
        return {
            total: phones.size,
            repeat: repeatPhones.length,
        };
    }

    // =============================================
    // DATE HELPERS
    // =============================================
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

    function getNextWeek() {
        return getNextDays(7);
    }

    // =============================================
    // EXPORT / IMPORT
    // =============================================
    function exportData() {
        return JSON.stringify({
            appointments: getAllAppointments(),
            settings: getSettings(),
            workers: getWorkers(),
            exportedAt: new Date().toISOString(),
        }, null, 2);
    }

    function importData(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (data.appointments) _set(KEYS.APPOINTMENTS, data.appointments);
            if (data.settings) _set(KEYS.SETTINGS, data.settings);
            if (data.workers) _set(KEYS.WORKERS, data.workers);
            return { success: true };
        } catch {
            return { success: false, error: 'Invalid data format.' };
        }
    }



    // =============================================
    // FIREBASE INTEGRATION
    // =============================================
    function initFirebase(onChangeCallback) {
        _onDataChange = onChangeCallback || null;
        if (typeof FirebaseSync === 'undefined') {
            console.warn('FirebaseSync module not loaded');
            return false;
        }
        const ok = FirebaseSync.init();
        if (ok) {
            _firebaseReady = true;
            // Set up real-time listeners for cross-device sync
            _setupListeners();
            // Push current local data to Firebase if Firebase is empty
            _initialSync();
            return true;
        }
        return false;
    }

    function _setupListeners() {
        if (!_firebaseReady) return;

        // Listen for remote changes on each data path
        Object.entries(FB_PATHS).forEach(([localKey, fbPath]) => {
            FirebaseSync.listen(fbPath, localKey, (val) => {
                // Data changed remotely — notify UI
                if (_onDataChange) _onDataChange(fbPath);
            });
        });
    }

    function _initialSync() {
        // For each key, if Firebase has data use it; otherwise push local to Firebase
        Object.entries(FB_PATHS).forEach(([localKey, fbPath]) => {
            const ref = FirebaseSync.getRef(fbPath);
            if (!ref) return;
            ref.once('value').then((snap) => {
                if (snap.val() !== null) {
                    // Firebase has data — update local
                    localStorage.setItem(localKey, JSON.stringify(snap.val()));
                    if (_onDataChange) _onDataChange(fbPath);
                } else {
                    // Firebase empty — push local data up
                    const local = _get(localKey, null);
                    if (local) ref.set(local);
                }
            }).catch(() => { /* offline, ignore */ });
        });
    }

    function migrateToFirebase() {
        if (!_firebaseReady || typeof FirebaseSync === 'undefined') {
            return { success: false, error: 'Firebase not connected' };
        }
        return FirebaseSync.migrateToFirebase();
    }

    function getFirebaseStatus() {
        if (typeof FirebaseSync === 'undefined') return { initialized: false, connected: false };
        return FirebaseSync.getStatus();
    }

    // =============================================
    // PUBLIC API
    // =============================================
    return {
        // Services (dynamic)
        getServices, getAllServicesList, addService, updateService, removeService,
        DEFAULT_SERVICES,

        // Settings
        getSettings, updateSettings, isLeaveDay, toggleLeaveDay,
        verifyPin, changePin,

        // Workers
        getWorkers, getActiveWorkers, getWorkerById,
        addWorker, updateWorker, removeWorker,
        getAvailableWorkers,

        // Appointments
        getAllAppointments, getAppointmentsByDate, getAppointmentsByPhone, getAppointmentById,
        getSlots, bookSlot, cancelBooking, completeBooking,

        // Payments
        markPayment,

        // Analytics
        getClientHistory, getRevenueStats, getTopServices, getWorkerStats,
        getDayStats, getUniqueClients,

        // Dates
        getNextDays, getNextWeek,

        // Data management
        exportData, importData,

        // Firebase
        initFirebase, migrateToFirebase, getFirebaseStatus,
    };
})();
