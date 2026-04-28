// ========================================
// Zerodot Salon — Owner Dashboard Logic
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    let currentTab = 'appointments';
    let filterDate = null;
    let modalCallback = null;

    // Refs
    const pinGate = document.getElementById('pin-gate');
    const dashboard = document.getElementById('dashboard');
    const pinError = document.getElementById('pin-error');
    const toast = document.getElementById('toast');
    const actionModal = document.getElementById('action-modal');

    // ——— PIN Gate ———
    function initPinGate() {
        const pins = document.querySelectorAll('.pin-digit');
        pins.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
                if (e.target.value && idx < 3) {
                    pins[idx + 1].focus();
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                    pins[idx - 1].focus();
                }
                if (e.key === 'Enter') {
                    tryUnlock();
                }
            });
        });
        pins[0].focus();

        document.getElementById('btn-pin-submit').addEventListener('click', tryUnlock);
    }

    function tryUnlock() {
        const pin = Array.from(document.querySelectorAll('.pin-digit')).map(i => i.value).join('');
        if (pin.length < 4) {
            pinError.classList.add('visible');
            pinError.textContent = 'Please enter all 4 digits.';
            return;
        }

        if (SalonData.verifyPin(pin)) {
            pinGate.style.display = 'none';
            dashboard.style.display = 'block';
            initDashboard();
        } else {
            pinError.classList.add('visible');
            pinError.textContent = 'Incorrect PIN. Try again.';
            document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
            document.getElementById('pin-0').focus();
        }
    }

    // ——— Dashboard Init ———
    function initDashboard() {
        loadSettings();
        renderStats();
        renderDateFilter();
        renderAppointments();
        renderCalendarTab();
        bindTabs();
        bindSettings();
        bindLogout();
    }

    // ——— Tabs ———
    function bindTabs() {
        document.querySelectorAll('.owner-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTab = tab.dataset.tab;
                document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('tab-' + currentTab).classList.add('active');

                if (currentTab === 'calendar') renderCalendarTab();
                if (currentTab === 'appointments') {
                    renderStats();
                    renderAppointments();
                }
            });
        });
    }

    // ——— Stats ———
    function renderStats() {
        const dateStr = filterDate || _today();
        const stats = SalonData.getDayStats(dateStr);
        document.getElementById('stat-upcoming').textContent = stats.upcoming;
        document.getElementById('stat-completed').textContent = stats.completed;
        document.getElementById('stat-cancelled').textContent = stats.cancelled;

        // Update label
        const days = SalonData.getNextDays(7);
        const day = days.find(d => d.date === dateStr);
        const label = day && day.isToday ? "Today's Overview" : `${day ? day.dayName + ', ' + day.dayNum + ' ' + day.monthName : dateStr}`;
        document.getElementById('stats-date-label').textContent = label;
    }

    // ——— Date Filter ———
    function renderDateFilter() {
        const select = document.getElementById('filter-date');
        const days = SalonData.getNextWeek();
        select.innerHTML = '';

        // Add "All Upcoming" option
        const allOpt = document.createElement('option');
        allOpt.value = 'all';
        allOpt.textContent = '📅 All Upcoming';
        select.appendChild(allOpt);

        days.forEach(day => {
            const opt = document.createElement('option');
            opt.value = day.date;
            opt.textContent = `${day.dayName}, ${day.dayNum} ${day.monthName}${day.isToday ? ' (Today)' : ''}${day.isLeave ? ' — CLOSED' : ''}`;
            select.appendChild(opt);
        });

        // Default to today
        select.value = days[0].date;
        filterDate = days[0].date;

        select.addEventListener('change', () => {
            filterDate = select.value === 'all' ? null : select.value;
            renderStats();
            renderAppointments();
        });
    }

    // ——— Appointments List ———
    function renderAppointments() {
        const container = document.getElementById('appointments-list');
        let appointments;

        if (!filterDate) {
            // All upcoming
            appointments = SalonData.getAllAppointments().filter(a => a.status !== 'cancelled');
            appointments.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                return dateCompare !== 0 ? dateCompare : a.timeSlot.localeCompare(b.timeSlot);
            });
        } else {
            appointments = SalonData.getAllAppointments().filter(a => a.date === filterDate);
            // Sort: upcoming first, then completed, then cancelled
            const statusOrder = { upcoming: 0, completed: 1, cancelled: 2 };
            appointments.sort((a, b) => {
                const sA = statusOrder[a.status] ?? 9;
                const sB = statusOrder[b.status] ?? 9;
                if (sA !== sB) return sA - sB;
                return a.timeSlot.localeCompare(b.timeSlot);
            });
        }

        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>No appointments ${filterDate ? 'for this day' : 'found'}.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        appointments.forEach(appt => {
            const statusClass = appt.status === 'upcoming' ? 'badge-upcoming' : appt.status === 'completed' ? 'badge-completed' : 'badge-cancelled';
            
            const card = document.createElement('div');
            card.className = 'owner-appointment-card';
            card.innerHTML = `
                <div class="owner-appointment-header">
                    <div class="owner-client-name">${appt.name}</div>
                    <span class="booking-status-badge ${statusClass}">${appt.status}</span>
                </div>
                <div class="owner-appointment-meta">
                    <span>📅 ${appt.date}</span>
                    <span>⏰ ${appt.timeSlot}</span>
                    <span>📱 <a href="tel:${appt.phone}" style="color:var(--info);text-decoration:none;">${appt.phone}</a></span>
                    <span>${appt.gender === 'male' ? '👨' : '👩'} ${appt.gender}</span>
                    <span>✂️ ${appt.service}</span>
                    ${appt.notes ? `<span>📝 ${appt.notes}</span>` : ''}
                </div>
                <div class="owner-appointment-actions">
                    ${appt.status === 'upcoming' ? `
                        <button class="btn btn-success btn-sm complete-btn" data-id="${appt.id}">✓ Complete</button>
                        <button class="btn btn-danger btn-sm cancel-btn" data-id="${appt.id}">✕ Cancel</button>
                        <a href="tel:${appt.phone}" class="btn btn-secondary btn-sm">📞 Call</a>
                    ` : ''}
                </div>
            `;
            container.appendChild(card);
        });

        // Bind complete/cancel buttons
        container.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showModal('Mark as Completed?', 'This will mark the appointment as done.', () => {
                    SalonData.completeBooking(btn.dataset.id);
                    showToast('Marked as completed', 'success');
                    renderStats();
                    renderAppointments();
                });
            });
        });

        container.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showModal('Cancel Appointment?', 'This will cancel the client\'s appointment. They won\'t be notified automatically.', () => {
                    SalonData.cancelBooking(btn.dataset.id, 'Cancelled by owner');
                    showToast('Appointment cancelled', 'success');
                    renderStats();
                    renderAppointments();
                });
            });
        });
    }

    // ——— Calendar Tab ———
    function renderCalendarTab() {
        // 7-day strip with counts
        const strip = document.getElementById('owner-date-strip');
        const days = SalonData.getNextWeek();
        strip.innerHTML = '';

        days.forEach(day => {
            const stats = SalonData.getDayStats(day.date);
            const card = document.createElement('div');
            card.className = 'date-card' + (day.isLeave ? ' leave' : '');
            card.innerHTML = `
                <div class="day-name">${day.dayName}</div>
                <div class="day-num">${day.dayNum}</div>
                <div class="month-name">${day.monthName}</div>
                ${day.isToday ? '<div class="today-badge">Today</div>' : ''}
                ${day.isLeave ? '<div class="leave-badge">Closed</div>' : `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">${stats.total} appts</div>`}
            `;
            strip.appendChild(card);
        });

        // Leave calendar for next 14 days
        const calendar = document.getElementById('leave-calendar');
        calendar.innerHTML = '';
        const nextDays = SalonData.getNextDays(14);

        nextDays.forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'leave-day-cell' + (day.isLeave ? ' is-leave' : '');
            cell.innerHTML = `
                <div class="cell-day">${day.dayNum}</div>
                <div class="cell-label">${day.dayName}</div>
            `;
            cell.addEventListener('click', () => {
                const isNowLeave = SalonData.toggleLeaveDay(day.date);
                cell.classList.toggle('is-leave', isNowLeave);
                showToast(isNowLeave ? `${day.dayName} ${day.dayNum} marked as leave` : `${day.dayName} ${day.dayNum} unmarked`, 'success');
                // Refresh strip
                renderCalendarTab();
            });
            calendar.appendChild(cell);
        });
    }

    // ——— Settings ———
    function loadSettings() {
        const s = SalonData.getSettings();
        document.getElementById('setting-open').value = s.openTime;
        document.getElementById('setting-close').value = s.closeTime;
    }

    function bindSettings() {
        // Save hours
        document.getElementById('btn-save-hours').addEventListener('click', () => {
            const open = parseInt(document.getElementById('setting-open').value);
            const close = parseInt(document.getElementById('setting-close').value);

            if (isNaN(open) || isNaN(close) || open < 0 || close > 24 || open >= close) {
                showToast('Invalid hours. Opening must be before closing.', 'error');
                return;
            }

            SalonData.updateSettings({ openTime: open, closeTime: close });
            showToast('Working hours updated', 'success');
        });

        // Change PIN
        document.getElementById('btn-change-pin').addEventListener('click', () => {
            const currentPin = document.getElementById('setting-current-pin').value;
            const newPin = document.getElementById('setting-new-pin').value;

            if (!SalonData.verifyPin(currentPin)) {
                showToast('Current PIN is incorrect', 'error');
                return;
            }
            if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
                showToast('New PIN must be 4 digits', 'error');
                return;
            }

            SalonData.changePin(newPin);
            document.getElementById('setting-current-pin').value = '';
            document.getElementById('setting-new-pin').value = '';
            showToast('PIN changed successfully', 'success');
        });

        // Export
        document.getElementById('btn-export').addEventListener('click', () => {
            const data = SalonData.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zerodot_backup_${_today()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Data exported', 'success');
        });

        // Import
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showModal('Import Data?', 'This will replace all existing data. Make sure you have a backup.', () => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = SalonData.importData(reader.result);
                    if (result.success) {
                        showToast('Data imported successfully', 'success');
                        loadSettings();
                        renderStats();
                        renderDateFilter();
                        renderAppointments();
                        renderCalendarTab();
                    } else {
                        showToast(result.error, 'error');
                    }
                };
                reader.readAsText(file);
            });
            e.target.value = ''; // Reset
        });
    }

    // ——— Logout ———
    function bindLogout() {
        document.getElementById('btn-logout').addEventListener('click', () => {
            dashboard.style.display = 'none';
            pinGate.style.display = 'flex';
            document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
            pinError.classList.remove('visible');
            document.getElementById('pin-0').focus();
        });
    }

    // ——— Modal ———
    function showModal(title, message, onConfirm) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modalCallback = onConfirm;
        actionModal.classList.add('visible');
    }

    document.getElementById('modal-yes').addEventListener('click', () => {
        actionModal.classList.remove('visible');
        if (modalCallback) modalCallback();
        modalCallback = null;
    });

    document.getElementById('modal-no').addEventListener('click', () => {
        actionModal.classList.remove('visible');
        modalCallback = null;
    });

    // ——— Toast ———
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast toast-${type} visible`;
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // ——— Helper ———
    function _today() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // ——— Init ———
    initPinGate();
});
