// Zerodot Salon — Owner Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
    let currentTab = 'appointments';
    let filterDate = null;
    let modalCallback = null;
    let svcMgrGender = 'male';

    const pinGate = document.getElementById('pin-gate');
    const dashboard = document.getElementById('dashboard');
    const pinError = document.getElementById('pin-error');
    const toast = document.getElementById('toast');
    const actionModal = document.getElementById('action-modal');

    // PIN Gate
    function initPinGate() {
        const pins = document.querySelectorAll('.pin-digit');
        pins.forEach((input, idx) => {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
                if (e.target.value && idx < 3) pins[idx + 1].focus();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !e.target.value && idx > 0) pins[idx - 1].focus();
                if (e.key === 'Enter') tryUnlock();
            });
        });
        pins[0].focus();
        document.getElementById('btn-pin-submit').addEventListener('click', tryUnlock);
    }

    function tryUnlock() {
        const pin = Array.from(document.querySelectorAll('.pin-digit')).map(i => i.value).join('');
        if (pin.length < 4) { pinError.classList.add('visible'); pinError.textContent = 'Please enter all 4 digits.'; return; }
        if (SalonData.verifyPin(pin)) {
            pinGate.style.display = 'none'; dashboard.style.display = 'block'; initDashboard();
        } else {
            pinError.classList.add('visible'); pinError.textContent = 'Incorrect PIN. Try again.';
            document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
            document.getElementById('pin-0').focus();
        }
    }

    function initDashboard() {
        loadSettings(); renderStats(); renderDateFilter(); renderAppointments();
        renderCalendarTab();
        OwnerTabs.renderStaffTab(showToast);
        OwnerTabs.renderPaymentsTab(showToast);
        OwnerTabs.renderReportsTab();
        OwnerTabs.renderServiceManager(showToast);
        bindTabs(); bindSettings(); bindLogout(); bindStaffTab(); bindPaymentsTab(); bindServiceManager();

        // Initialize Firebase sync
        const fbOk = SalonData.initFirebase((changedPath) => {
            renderStats(); renderAppointments();
            if (currentTab === 'staff') OwnerTabs.renderStaffTab(showToast);
            if (currentTab === 'payments') OwnerTabs.renderPaymentsTab(showToast);
            if (currentTab === 'reports') OwnerTabs.renderReportsTab();
        });

        // Update Firebase status indicator
        updateFirebaseStatus(fbOk);
        document.addEventListener('firebase-status', (e) => updateFirebaseStatus(e.detail.connected));

        // Migrate button
        document.getElementById('btn-migrate-fb').addEventListener('click', () => {
            const result = SalonData.migrateToFirebase();
            if (result.success) showToast(`✅ Migrated ${result.migrated} data sets to cloud`, 'success');
            else showToast(result.error || 'Migration failed', 'error');
        });
    }

    function updateFirebaseStatus(connected) {
        const dot = document.getElementById('fb-status-dot');
        const text = document.getElementById('fb-status-text');
        if (!dot || !text) return;
        if (connected) {
            dot.className = 'fb-dot online';
            text.textContent = 'Connected — syncing in real-time';
        } else {
            dot.className = 'fb-dot offline';
            text.textContent = 'Offline — using local storage';
        }
    }

    // Tabs
    function bindTabs() {
        document.querySelectorAll('.owner-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTab = tab.dataset.tab;
                document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('tab-' + currentTab).classList.add('active');
                if (currentTab === 'appointments') { renderStats(); renderAppointments(); }
                if (currentTab === 'staff') OwnerTabs.renderStaffTab(showToast);
                if (currentTab === 'payments') OwnerTabs.renderPaymentsTab(showToast);
                if (currentTab === 'reports') OwnerTabs.renderReportsTab();
                if (currentTab === 'settings') { renderCalendarTab(); OwnerTabs.renderServiceManager(showToast); }
            });
        });
    }

    // Stats
    function renderStats() {
        const dateStr = filterDate || _today();
        const stats = SalonData.getDayStats(dateStr);
        document.getElementById('stat-upcoming').textContent = stats.upcoming;
        document.getElementById('stat-completed').textContent = stats.completed;
        document.getElementById('stat-revenue').textContent = '₹' + stats.revenue;
        const days = SalonData.getNextDays(7);
        const day = days.find(d => d.date === dateStr);
        document.getElementById('stats-date-label').textContent = day && day.isToday ? "Today's Overview" : `${day ? day.dayName + ', ' + day.dayNum + ' ' + day.monthName : dateStr}`;
    }

    // Date Filter
    function renderDateFilter() {
        const select = document.getElementById('filter-date');
        const days = SalonData.getNextWeek();
        select.innerHTML = '';
        const allOpt = document.createElement('option');
        allOpt.value = 'all'; allOpt.textContent = '📅 All Upcoming';
        select.appendChild(allOpt);
        days.forEach(day => {
            const opt = document.createElement('option');
            opt.value = day.date;
            opt.textContent = `${day.dayName}, ${day.dayNum} ${day.monthName}${day.isToday ? ' (Today)' : ''}${day.isLeave ? ' — CLOSED' : ''}`;
            select.appendChild(opt);
        });
        select.value = days[0].date; filterDate = days[0].date;
        select.addEventListener('change', () => {
            filterDate = select.value === 'all' ? null : select.value;
            renderStats(); renderAppointments();
        });
    }

    // Appointments List
    function renderAppointments() {
        const container = document.getElementById('appointments-list');
        let appointments;
        if (!filterDate) {
            appointments = SalonData.getAllAppointments().filter(a => a.status !== 'cancelled');
            appointments.sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
        } else {
            appointments = SalonData.getAllAppointments().filter(a => a.date === filterDate);
            const so = { upcoming: 0, completed: 1, cancelled: 2 };
            appointments.sort((a, b) => (so[a.status]??9) - (so[b.status]??9) || a.timeSlot.localeCompare(b.timeSlot));
        }
        if (!appointments.length) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No appointments ' + (filterDate ? 'for this day' : 'found') + '.</p></div>';
            return;
        }
        container.innerHTML = '';
        appointments.forEach(appt => {
            const statusClass = appt.status === 'upcoming' ? 'badge-upcoming' : appt.status === 'completed' ? 'badge-completed' : 'badge-cancelled';
            const svcLabel = appt.services ? appt.services.map(s => (s.icon||'') + ' ' + s.name).join(', ') : (appt.service || '');
            const isPaid = appt.payment && appt.payment.status === 'paid';
            const card = document.createElement('div');
            card.className = 'owner-appointment-card';
            card.innerHTML = `
                <div class="owner-appointment-header">
                    <div class="owner-client-name">${appt.name}</div>
                    <span class="booking-status-badge ${statusClass}">${appt.status}</span>
                </div>
                <div class="owner-appointment-meta">
                    <span>📅 ${appt.date}</span><span>⏰ ${appt.timeSlot}</span>
                    <span>📱 <a href="tel:${appt.phone}" style="color:var(--info);text-decoration:none;">${appt.phone}</a></span>
                    <span>${appt.gender === 'male' ? '👨' : '👩'} ${appt.gender}</span>
                    <span>✂️ ${svcLabel}</span>
                    ${appt.totalAmount ? '<span>💰 ₹' + appt.totalAmount + '</span>' : ''}
                    ${appt.workerName ? '<span>💇 ' + appt.workerName + '</span>' : ''}
                    ${isPaid ? '<span style="color:var(--success)">✅ Paid ₹' + appt.payment.amount + ' (' + appt.payment.method + ')</span>' : ''}
                    ${appt.notes ? '<span>📝 ' + appt.notes + '</span>' : ''}
                </div>
                <div class="owner-appointment-actions">
                    ${appt.status === 'upcoming' ? `
                        <button class="btn btn-success btn-sm complete-btn" data-id="${appt.id}" data-amount="${appt.totalAmount||0}">💰 Complete & Pay</button>
                        <button class="btn btn-danger btn-sm cancel-btn" data-id="${appt.id}">✕ Cancel</button>
                        <a href="tel:${appt.phone}" class="btn btn-secondary btn-sm">📞 Call</a>
                    ` : ''}
                    ${appt.status === 'completed' && !isPaid ? `<button class="btn btn-success btn-sm pay-btn" data-id="${appt.id}" data-amount="${appt.totalAmount||0}">💰 Collect Payment</button>` : ''}
                </div>`;
            container.appendChild(card);
        });

        container.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                OwnerTabs.openPaymentModal(btn.dataset.id, parseInt(btn.dataset.amount)||0, (msg, type) => {
                    showToast(msg, type); renderStats(); renderAppointments();
                });
            });
        });
        container.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                OwnerTabs.openPaymentModal(btn.dataset.id, parseInt(btn.dataset.amount)||0, (msg, type) => {
                    showToast(msg, type); renderStats(); renderAppointments();
                });
            });
        });
        container.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showModal('Cancel Appointment?', 'This will cancel the client\'s appointment.', () => {
                    SalonData.cancelBooking(btn.dataset.id, 'Cancelled by owner');
                    showToast('Appointment cancelled', 'success');
                    renderStats(); renderAppointments();
                });
            });
        });
    }

    // Calendar Tab (inside settings)
    function renderCalendarTab() {
        const strip = document.getElementById('owner-date-strip');
        const days = SalonData.getNextWeek();
        strip.innerHTML = '';
        days.forEach(day => {
            const stats = SalonData.getDayStats(day.date);
            const card = document.createElement('div');
            card.className = 'date-card' + (day.isLeave ? ' leave' : '');
            card.innerHTML = `<div class="day-name">${day.dayName}</div><div class="day-num">${day.dayNum}</div><div class="month-name">${day.monthName}</div>${day.isToday ? '<div class="today-badge">Today</div>' : ''}${day.isLeave ? '<div class="leave-badge">Closed</div>' : '<div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">' + stats.total + ' appts</div>'}`;
            strip.appendChild(card);
        });

        const calendar = document.getElementById('leave-calendar');
        calendar.innerHTML = '';
        SalonData.getNextDays(14).forEach(day => {
            const cell = document.createElement('div');
            cell.className = 'leave-day-cell' + (day.isLeave ? ' is-leave' : '');
            cell.innerHTML = `<div class="cell-day">${day.dayNum}</div><div class="cell-label">${day.dayName}</div>`;
            cell.addEventListener('click', () => {
                const isNowLeave = SalonData.toggleLeaveDay(day.date);
                cell.classList.toggle('is-leave', isNowLeave);
                showToast(isNowLeave ? `${day.dayName} ${day.dayNum} marked as leave` : `${day.dayName} ${day.dayNum} unmarked`, 'success');
                renderCalendarTab();
            });
            calendar.appendChild(cell);
        });
    }

    // Staff tab bindings
    function bindStaffTab() {
        document.getElementById('btn-add-worker').addEventListener('click', () => {
            OwnerTabs.showWorkerForm(null, showToast);
        });
    }

    // Payments tab bindings
    function bindPaymentsTab() {
        document.getElementById('btn-client-search').addEventListener('click', () => OwnerTabs.renderClientHistory());
        document.getElementById('client-search-phone').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') OwnerTabs.renderClientHistory();
        });
        document.getElementById('client-search-phone').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // Service Manager bindings
    function bindServiceManager() {
        document.querySelectorAll('.svc-mgr-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                svcMgrGender = tab.dataset.gender;
                document.querySelectorAll('.svc-mgr-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                OwnerTabs.renderServiceManager(showToast);
            });
        });
        document.getElementById('btn-show-add-svc').addEventListener('click', () => {
            document.getElementById('add-service-form').style.display = 'block';
            document.getElementById('btn-show-add-svc').style.display = 'none';
        });
        document.getElementById('btn-cancel-new-svc').addEventListener('click', () => {
            document.getElementById('add-service-form').style.display = 'none';
            document.getElementById('btn-show-add-svc').style.display = '';
        });
        document.getElementById('btn-save-new-svc').addEventListener('click', () => {
            const name = document.getElementById('new-svc-name').value.trim();
            const icon = document.getElementById('new-svc-icon').value.trim() || '✂️';
            const price = parseInt(document.getElementById('new-svc-price').value) || 0;
            if (!name) { showToast('Enter service name', 'error'); return; }
            const activeGender = document.querySelector('.svc-mgr-tab.active')?.dataset.gender || 'male';
            SalonData.addService(activeGender, { name, icon, price });
            showToast('Service added!', 'success');
            document.getElementById('new-svc-name').value = '';
            document.getElementById('new-svc-price').value = '';
            document.getElementById('add-service-form').style.display = 'none';
            document.getElementById('btn-show-add-svc').style.display = '';
            OwnerTabs.renderServiceManager(showToast);
        });
    }

    // Settings
    function loadSettings() {
        const s = SalonData.getSettings();
        document.getElementById('setting-open').value = s.openTime;
        document.getElementById('setting-close').value = s.closeTime;
    }

    function bindSettings() {
        document.getElementById('btn-save-hours').addEventListener('click', () => {
            const open = parseInt(document.getElementById('setting-open').value);
            const close = parseInt(document.getElementById('setting-close').value);
            if (isNaN(open) || isNaN(close) || open < 0 || close > 24 || open >= close) {
                showToast('Invalid hours.', 'error'); return;
            }
            SalonData.updateSettings({ openTime: open, closeTime: close });
            showToast('Working hours updated', 'success');
        });
        document.getElementById('btn-change-pin').addEventListener('click', () => {
            const currentPin = document.getElementById('setting-current-pin').value;
            const newPin = document.getElementById('setting-new-pin').value;
            if (!SalonData.verifyPin(currentPin)) { showToast('Current PIN is incorrect', 'error'); return; }
            if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { showToast('New PIN must be 4 digits', 'error'); return; }
            SalonData.changePin(newPin);
            document.getElementById('setting-current-pin').value = '';
            document.getElementById('setting-new-pin').value = '';
            showToast('PIN changed successfully', 'success');
        });
        document.getElementById('btn-export').addEventListener('click', () => {
            const data = SalonData.exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `zerodot_backup_${_today()}.json`; a.click();
            URL.revokeObjectURL(url);
            showToast('Data exported', 'success');
        });
        document.getElementById('btn-import').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            showModal('Import Data?', 'This will replace all existing data.', () => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = SalonData.importData(reader.result);
                    if (result.success) { showToast('Data imported', 'success'); loadSettings(); renderStats(); renderDateFilter(); renderAppointments(); renderCalendarTab(); }
                    else showToast(result.error, 'error');
                };
                reader.readAsText(file);
            });
            e.target.value = '';
        });
    }

    function bindLogout() {
        document.getElementById('btn-logout').addEventListener('click', () => {
            dashboard.style.display = 'none'; pinGate.style.display = 'flex';
            document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
            pinError.classList.remove('visible');
            document.getElementById('pin-0').focus();
        });
    }

    function showModal(title, message, onConfirm) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        document.getElementById('modal-content').innerHTML = '';
        modalCallback = onConfirm;
        actionModal.classList.add('visible');
    }

    document.getElementById('modal-yes').addEventListener('click', () => {
        actionModal.classList.remove('visible');
        if (modalCallback) modalCallback(); modalCallback = null;
    });
    document.getElementById('modal-no').addEventListener('click', () => {
        actionModal.classList.remove('visible'); modalCallback = null;
    });

    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast toast-${type} visible`;
        setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    function _today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    initPinGate();
});
