// ========================================
// Zerodot Salon — Client Booking Logic
// Multi-service, Worker Selection, Prices
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // State
    let selectedDate = null;
    let selectedSlot = null;
    let selectedGender = null;
    let selectedServices = []; // Array of service objects
    let selectedWorkerId = null;
    let cancelTargetId = null;

    // Refs
    const dateStrip = document.getElementById('date-strip');
    const slotsGrid = document.getElementById('slots-grid');
    const slotsContainer = document.getElementById('slots-container');
    const slotsTitle = document.getElementById('slots-title');
    const formWrapper = document.getElementById('booking-form-wrapper');
    const formOverlay = document.getElementById('form-overlay');
    const formSlotInfo = document.getElementById('form-slot-info');
    const genderToggle = document.getElementById('gender-toggle');
    const serviceGrid = document.getElementById('service-grid');
    const serviceSummary = document.getElementById('service-summary');
    const serviceSummaryList = document.getElementById('service-summary-list');
    const serviceSummaryTotal = document.getElementById('service-summary-total');
    const serviceCountBadge = document.getElementById('service-count-badge');
    const workerGroup = document.getElementById('worker-group');
    const workerSelector = document.getElementById('worker-selector');
    const mainContent = document.getElementById('main-content');
    const confirmationScreen = document.getElementById('confirmation-screen');
    const checkBookingSection = document.getElementById('check-booking-section');
    const bookingsList = document.getElementById('bookings-list');
    const cancelModal = document.getElementById('cancel-modal');
    const toast = document.getElementById('toast');

    // ——— Initialize ———
    function init() {
        renderDateStrip();
        bindEvents();
    }

    // ——— Date Strip ———
    function renderDateStrip() {
        const days = SalonData.getNextDays(3);
        dateStrip.innerHTML = '';

        days.forEach((day, idx) => {
            const card = document.createElement('div');
            card.className = 'date-card' + (idx === 0 ? ' active' : '') + (day.isLeave ? ' leave' : '');
            card.dataset.date = day.date;
            card.innerHTML = `
                <div class="day-name">${day.dayName}</div>
                <div class="day-num">${day.dayNum}</div>
                <div class="month-name">${day.monthName}</div>
                ${day.isToday ? '<div class="today-badge">Today</div>' : ''}
                ${day.isLeave ? '<div class="leave-badge">Closed</div>' : ''}
            `;

            if (!day.isLeave) {
                card.addEventListener('click', () => selectDate(day.date));
            }

            dateStrip.appendChild(card);
        });

        // Auto-select first non-leave day
        const firstAvailable = days.find(d => !d.isLeave);
        if (firstAvailable) {
            selectDate(firstAvailable.date);
        } else {
            slotsGrid.innerHTML = '';
            slotsContainer.innerHTML = `
                <div class="leave-message">
                    <div class="leave-icon">🏖️</div>
                    <h3>Salon is closed</h3>
                    <p>All upcoming days are marked as leave. Please check back later.</p>
                </div>
            `;
        }
    }

    function selectDate(dateStr) {
        selectedDate = dateStr;
        selectedSlot = null;

        document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
        const active = document.querySelector(`.date-card[data-date="${dateStr}"]`);
        if (active) active.classList.add('active');

        renderSlots();
    }

    // ——— Time Slots ———
    function renderSlots() {
        if (!selectedDate) return;

        if (SalonData.isLeaveDay(selectedDate)) {
            slotsContainer.innerHTML = `
                <div class="leave-message">
                    <div class="leave-icon">🏖️</div>
                    <h3>Salon is closed on this day</h3>
                    <p>Please select another date.</p>
                </div>
            `;
            return;
        }

        const slots = SalonData.getSlots(selectedDate);
        const availableSlots = slots.filter(s => !s.isPast);

        if (availableSlots.length === 0) {
            slotsContainer.innerHTML = `
                <div class="no-slots-message">
                    <div class="icon">⏰</div>
                    <p>No available slots for this day. All time slots have passed.</p>
                </div>
            `;
            return;
        }

        slotsContainer.innerHTML = '<div class="slots-grid animate-stagger" id="slots-grid"></div>';
        const grid = document.getElementById('slots-grid');

        availableSlots.forEach(slot => {
            const card = document.createElement('div');
            card.className = 'slot-card' + (slot.isBooked ? ' booked' : '');
            card.dataset.time = slot.time;

            const startTime = slot.time.split(' - ')[0];
            const spotsLeft = slot.capacity - slot.bookingsCount;
            const spotsLabel = slot.isBooked ? 'Full' :
                (slot.capacity > 1 ? `${spotsLeft} spot${spotsLeft > 1 ? 's' : ''}` : 'Available');

            card.innerHTML = `
                <div class="slot-time">${startTime}</div>
                <div class="slot-status">${spotsLabel}</div>
            `;

            if (!slot.isBooked) {
                card.addEventListener('click', () => selectSlot(slot.time, card));
            }

            grid.appendChild(card);
        });
    }

    function selectSlot(timeStr, cardEl) {
        selectedSlot = timeStr;
        document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');
        showBookingForm();
    }

    // ——— Booking Form ———
    function showBookingForm() {
        const dayInfo = SalonData.getNextDays(3).find(d => d.date === selectedDate);
        formSlotInfo.textContent = `📅 ${dayInfo.dayName}, ${dayInfo.dayNum} ${dayInfo.monthName} · ${selectedSlot}`;

        // Reset form
        document.getElementById('input-name').value = '';
        document.getElementById('input-phone').value = '';
        document.getElementById('input-notes').value = '';
        selectedGender = null;
        selectedServices = [];
        selectedWorkerId = null;
        document.querySelectorAll('.gender-option').forEach(o => o.classList.remove('active'));
        serviceGrid.innerHTML = '';
        serviceSummary.style.display = 'none';
        serviceCountBadge.style.display = 'none';
        workerGroup.style.display = 'none';

        formOverlay.classList.add('visible');
        formWrapper.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function hideBookingForm() {
        formOverlay.classList.remove('visible');
        formWrapper.classList.remove('visible');
        document.body.style.overflow = '';
    }

    // ——— Services (Multi-select with prices) ———
    function renderServices(gender) {
        const services = SalonData.getServices()[gender] || [];
        serviceGrid.innerHTML = '';
        selectedServices = [];
        updateServiceSummary();

        services.forEach(svc => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.dataset.serviceId = svc.id;
            card.innerHTML = `
                <div class="service-check-mark">✓</div>
                <div class="service-icon">${svc.icon}</div>
                <div class="service-name">${svc.name}</div>
                <div class="service-price">₹${svc.price}</div>
            `;
            card.addEventListener('click', () => toggleService(svc, card));
            serviceGrid.appendChild(card);
        });
    }

    function toggleService(svc, cardEl) {
        const idx = selectedServices.findIndex(s => s.id === svc.id);
        if (idx > -1) {
            // Remove
            selectedServices.splice(idx, 1);
            cardEl.classList.remove('active');
        } else {
            // Add
            selectedServices.push({ ...svc });
            cardEl.classList.add('active');
        }
        updateServiceSummary();
        updateWorkerSelector();
    }

    function updateServiceSummary() {
        if (selectedServices.length === 0) {
            serviceSummary.style.display = 'none';
            serviceCountBadge.style.display = 'none';
            return;
        }

        serviceCountBadge.style.display = 'inline';
        serviceCountBadge.textContent = `${selectedServices.length} selected`;

        const total = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

        serviceSummaryList.innerHTML = selectedServices
            .map(s => `<span class="summary-chip">${s.icon} ${s.name} <span class="chip-price">₹${s.price}</span></span>`)
            .join('');

        serviceSummaryTotal.innerHTML = `Total: <strong>₹${total}</strong>`;
        serviceSummary.style.display = 'block';
    }

    // ——— Worker Selector ———
    function updateWorkerSelector() {
        if (!selectedDate || !selectedSlot) return;

        const serviceIds = selectedServices.map(s => s.id);
        const available = SalonData.getAvailableWorkers(selectedDate, selectedSlot, serviceIds);

        if (available.length === 0) {
            workerGroup.style.display = 'none';
            selectedWorkerId = null;
            return;
        }

        workerGroup.style.display = 'block';
        workerSelector.innerHTML = '';

        // "Any available" option
        const anyCard = document.createElement('div');
        anyCard.className = 'worker-card' + (!selectedWorkerId ? ' active' : '');
        anyCard.innerHTML = `
            <div class="worker-avatar">🎲</div>
            <div class="worker-name">Anyone Available</div>
        `;
        anyCard.addEventListener('click', () => {
            selectedWorkerId = null;
            document.querySelectorAll('.worker-card').forEach(c => c.classList.remove('active'));
            anyCard.classList.add('active');
        });
        workerSelector.appendChild(anyCard);

        available.forEach(w => {
            const card = document.createElement('div');
            card.className = 'worker-card' + (selectedWorkerId === w.id ? ' active' : '');
            card.innerHTML = `
                <div class="worker-avatar">${w.avatar}</div>
                <div class="worker-name">${w.name}</div>
            `;
            card.addEventListener('click', () => {
                selectedWorkerId = w.id;
                document.querySelectorAll('.worker-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
            workerSelector.appendChild(card);
        });
    }

    // ——— Confirm Booking ———
    function confirmBooking() {
        const name = document.getElementById('input-name').value.trim();
        const phone = document.getElementById('input-phone').value.trim();
        const notes = document.getElementById('input-notes').value.trim();

        if (!name) return showToast('Please enter your name', 'error');
        if (!phone || phone.length < 10 || !/^\d{10}$/.test(phone)) return showToast('Enter a valid 10-digit phone number', 'error');
        if (!selectedGender) return showToast('Please select gender', 'error');
        if (selectedServices.length === 0) return showToast('Please select at least one service', 'error');

        const result = SalonData.bookSlot({
            name,
            phone,
            gender: selectedGender,
            services: selectedServices.map(s => ({ id: s.id, name: s.name, price: s.price, icon: s.icon })),
            date: selectedDate,
            timeSlot: selectedSlot,
            notes,
            workerId: selectedWorkerId || '',
        });

        if (!result.success) {
            showToast(result.error, 'error');
            return;
        }

        hideBookingForm();
        showConfirmation(result.appointment);
    }

    // ——— Confirmation Screen ———
    function showConfirmation(appt) {
        mainContent.style.display = 'none';
        confirmationScreen.style.display = 'block';

        const dayInfo = SalonData.getNextDays(3).find(d => d.date === appt.date);
        const dateLabel = dayInfo ? `${dayInfo.dayName}, ${dayInfo.dayNum} ${dayInfo.monthName}` : appt.date;

        const serviceNames = (appt.services || []).map(s => `${s.icon || '✂️'} ${s.name}`).join(', ');
        const total = appt.totalAmount || 0;

        confirmationScreen.innerHTML = `
            <div class="confirmation-screen">
                <div class="confirmation-icon">✓</div>
                <div class="confirmation-title">Booking Confirmed!</div>
                <div class="confirmation-id">Booking ID: <span>${appt.id}</span></div>
                <div class="confirmation-details">
                    <div class="confirmation-row">
                        <span class="label">Name</span>
                        <span class="value">${appt.name}</span>
                    </div>
                    <div class="confirmation-row">
                        <span class="label">Date</span>
                        <span class="value">${dateLabel}</span>
                    </div>
                    <div class="confirmation-row">
                        <span class="label">Time</span>
                        <span class="value">${appt.timeSlot}</span>
                    </div>
                    <div class="confirmation-row">
                        <span class="label">Services</span>
                        <span class="value">${serviceNames}</span>
                    </div>
                    <div class="confirmation-row">
                        <span class="label">Total</span>
                        <span class="value confirmation-total">₹${total}</span>
                    </div>
                    ${appt.workerName ? `<div class="confirmation-row"><span class="label">Stylist</span><span class="value">${appt.workerName}</span></div>` : ''}
                    <div class="confirmation-row">
                        <span class="label">Phone</span>
                        <span class="value">${appt.phone}</span>
                    </div>
                    ${appt.notes ? `<div class="confirmation-row"><span class="label">Notes</span><span class="value">${appt.notes}</span></div>` : ''}
                </div>
                <button class="btn btn-primary btn-full" id="btn-back-home">Book Another</button>
            </div>
        `;

        document.getElementById('btn-back-home').addEventListener('click', () => {
            confirmationScreen.style.display = 'none';
            mainContent.style.display = 'block';
            renderDateStrip();
        });
    }

    // ——— Check Booking ———
    function toggleCheckBooking() {
        const isVisible = checkBookingSection.style.display !== 'none';
        checkBookingSection.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            document.getElementById('search-phone').value = '';
            bookingsList.innerHTML = '';
            document.getElementById('search-phone').focus();
            checkBookingSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function searchBookings() {
        const phone = document.getElementById('search-phone').value.trim();
        if (!phone || phone.length < 10) {
            showToast('Enter a valid 10-digit phone number', 'error');
            return;
        }

        const bookings = SalonData.getAppointmentsByPhone(phone);
        if (bookings.length === 0) {
            bookingsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>No bookings found for this number.</p>
                </div>
            `;
            return;
        }

        bookings.sort((a, b) => new Date(b.date) - new Date(a.date));
        bookingsList.innerHTML = '';

        bookings.forEach(b => {
            const statusClass = b.status === 'upcoming' ? 'badge-upcoming' : b.status === 'completed' ? 'badge-completed' : 'badge-cancelled';
            // Handle both old single-service and new multi-service format
            const serviceLabel = b.services
                ? b.services.map(s => s.name).join(', ')
                : (b.service || 'Service');

            const card = document.createElement('div');
            card.className = 'booking-card';
            card.innerHTML = `
                <div class="booking-card-header">
                    <div>
                        <div class="booking-card-title">${serviceLabel}</div>
                        <div class="booking-card-id">${b.id}</div>
                    </div>
                    <span class="booking-status-badge ${statusClass}">${b.status}</span>
                </div>
                <div class="booking-card-details">
                    <span class="booking-card-detail">📅 ${b.date}</span>
                    <span class="booking-card-detail">⏰ ${b.timeSlot}</span>
                    ${b.totalAmount ? `<span class="booking-card-detail">💰 ₹${b.totalAmount}</span>` : ''}
                    ${b.workerName ? `<span class="booking-card-detail">💇 ${b.workerName}</span>` : ''}
                </div>
                ${b.status === 'upcoming' ? `
                    <div class="booking-card-actions">
                        <button class="btn btn-danger btn-sm cancel-booking-btn" data-id="${b.id}">Cancel Booking</button>
                    </div>
                ` : ''}
            `;
            bookingsList.appendChild(card);
        });

        document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                cancelTargetId = btn.dataset.id;
                cancelModal.classList.add('visible');
            });
        });
    }

    // ——— Cancel Modal ———
    function handleCancelConfirm() {
        if (!cancelTargetId) return;
        const result = SalonData.cancelBooking(cancelTargetId);
        cancelModal.classList.remove('visible');

        if (result.success) {
            showToast('Booking cancelled successfully', 'success');
            searchBookings();
            renderSlots();
        } else {
            showToast(result.error, 'error');
        }
        cancelTargetId = null;
    }

    // ——— Toast ———
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast toast-${type} visible`;
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // ——— Event Bindings ———
    function bindEvents() {
        // Gender toggle
        genderToggle.addEventListener('click', (e) => {
            const option = e.target.closest('.gender-option');
            if (!option) return;
            selectedGender = option.dataset.gender;
            document.querySelectorAll('.gender-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            renderServices(selectedGender);
        });

        // Form actions
        document.getElementById('btn-confirm-booking').addEventListener('click', confirmBooking);
        document.getElementById('btn-cancel-form').addEventListener('click', hideBookingForm);
        formOverlay.addEventListener('click', hideBookingForm);

        // Check booking
        document.getElementById('btn-check-booking').addEventListener('click', toggleCheckBooking);
        document.getElementById('btn-search').addEventListener('click', searchBookings);
        document.getElementById('search-phone').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchBookings();
        });

        // Cancel modal
        document.getElementById('modal-cancel-yes').addEventListener('click', handleCancelConfirm);
        document.getElementById('modal-cancel-no').addEventListener('click', () => {
            cancelModal.classList.remove('visible');
            cancelTargetId = null;
        });

        // Phone input — digits only
        document.getElementById('input-phone').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
        document.getElementById('search-phone').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    init();
});
