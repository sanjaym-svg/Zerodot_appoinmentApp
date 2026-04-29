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

        // Initialize Firebase — auto-sync silently
        const fbOk = SalonData.initFirebase((changedPath) => {
            renderStats(); renderAppointments();
            if (currentTab === 'staff') OwnerTabs.renderStaffTab(showToast);
            if (currentTab === 'payments') OwnerTabs.renderPaymentsTab(showToast);
            if (currentTab === 'reports') OwnerTabs.renderReportsTab();
        });
        // Auto-migrate on first connect (silent)
        if (fbOk) SalonData.migrateToFirebase();
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
            appointments.sort((a, b) => (so[a.status] ?? 9) - (so[b.status] ?? 9) || a.timeSlot.localeCompare(b.timeSlot));
        }
        if (!appointments.length) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No appointments ' + (filterDate ? 'for this day' : 'found') + '.</p></div>';
            return;
        }
        container.innerHTML = '';
        appointments.forEach(appt => {
            let statusBg = 'transparent', statusColor = 'var(--text-muted)';
            if (appt.status === 'upcoming') { statusBg = 'rgba(59, 130, 246, 0.15)'; statusColor = 'var(--info)'; }
            else if (appt.status === 'completed') { statusBg = 'var(--success)'; statusColor = '#000'; }
            else if (appt.status === 'cancelled') { statusBg = 'rgba(239, 68, 68, 0.15)'; statusColor = 'var(--error)'; }

            const svcLabel = appt.services ? appt.services.map(s => s.name).join(', ') : (appt.service || '');
            const isPaid = appt.payment && appt.payment.status === 'paid';
            
            const card = document.createElement('div');
            card.className = 'owner-appointment-card';
            card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;margin-bottom:12px;transition:var(--transition);';
            card.addEventListener('mouseover', () => card.style.background = '#141414');
            card.addEventListener('mouseout', () => card.style.background = 'var(--bg-card)');
            
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                    <!-- LEFT COLUMN -->
                    <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:1.05rem;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${appt.name}</span>
                            <span style="padding:2px 6px;border-radius:4px;font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:${statusBg};color:${statusColor};flex-shrink:0;">${appt.status}</span>
                        </div>
                        <div style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">${appt.timeSlot} <span style="color:var(--text-secondary);font-weight:400;margin-left:4px;">${appt.phone} • <span style="text-transform:capitalize;">${appt.gender}</span></span></div>
                        <div style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${svcLabel}</div>
                    </div>
                    
                    <!-- RIGHT COLUMN -->
                    <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;flex-shrink:0;">
                        <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">₹${appt.totalAmount || 0}</div>
                        ${isPaid ? `<div style="font-size:0.7rem;color:var(--success);font-weight:600;">Paid via ${appt.payment.method}</div>` : ''}
                        
                        ${appt.status === 'upcoming' ? `
                        <div style="display:flex;gap:6px;margin-top:12px;">
                            <button class="btn btn-sm complete-btn" data-id="${appt.id}" data-amount="${appt.totalAmount || 0}" style="background:var(--success);color:#000;border:none;padding:4px 10px;font-size:0.75rem;border-radius:4px;cursor:pointer;font-weight:600;">Pay</button>
                            <a href="tel:${appt.phone}" class="btn btn-secondary btn-sm" style="padding:4px 10px;font-size:0.75rem;border-radius:4px;text-decoration:none;">Call</a>
                            <button class="btn btn-ghost btn-sm cancel-btn" data-id="${appt.id}" style="color:var(--error);padding:4px 10px;font-size:0.75rem;border-radius:4px;cursor:pointer;background:transparent;border:none;">Cancel</button>
                        </div>
                        ` : ''}
                        ${appt.status === 'completed' && !isPaid ? `<button class="btn btn-success btn-sm pay-btn" data-id="${appt.id}" data-amount="${appt.totalAmount || 0}" style="margin-top:12px;padding:4px 10px;font-size:0.75rem;border-radius:4px;">Collect</button>` : ''}
                    </div>
                </div>`;
            container.appendChild(card);
        });

        container.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                OwnerTabs.openPaymentModal(btn.dataset.id, parseInt(btn.dataset.amount) || 0, (msg, type) => {
                    showToast(msg, type); renderStats(); renderAppointments();
                });
            });
        });
        container.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                OwnerTabs.openPaymentModal(btn.dataset.id, parseInt(btn.dataset.amount) || 0, (msg, type) => {
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
        // Event bindings for payments are now handled dynamically in owner-tabs.js 
        // during renderPaymentsTab() because the DOM is frequently rebuilt.
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
            const price = parseInt(document.getElementById('new-svc-price').value) || 0;
            if (!name) { showToast('Enter service name', 'error'); return; }
            const activeGender = document.querySelector('.svc-mgr-tab.active')?.dataset.gender || 'male';
            SalonData.addService(activeGender, { name, icon: '', price });
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
        // Working hours are now handled by renderWorkingHours()
    }

    function renderWorkingHours() {
        const grid = document.getElementById('day-hours-grid');
        const s = SalonData.getSettings();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        let hoursObj = s.workingHours;
        if (!hoursObj) {
            // Fallback for older data
            hoursObj = {};
            for (let i = 0; i < 7; i++) {
                hoursObj[i] = { open: s.openTime || 9, close: s.closeTime || 20, isClosed: false };
            }
        }

        grid.innerHTML = '';
        days.forEach((day, index) => {
            const h = hoursObj[index];
            grid.innerHTML += `
                <div class="day-hours-row" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div class="day-hours-name" style="width:50px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;font-size:0.8rem;letter-spacing:0.05em;">${day.substring(0, 3)}</div>
                    <div class="day-hours-inputs" style="display:flex;align-items:center;gap:8px;${h.isClosed ? 'opacity:0.3;pointer-events:none;' : ''}">
                        <input type="time" class="settings-input hour-open" data-day="${index}" value="${String(h.open).padStart(2, '0')}:00" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);color-scheme:dark;">
                        <span class="day-hours-dash" style="color:var(--text-muted);">-</span>
                        <input type="time" class="settings-input hour-close" data-day="${index}" value="${String(h.close).padStart(2, '0')}:00" style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);color-scheme:dark;">
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" class="day-closed-cb" data-day="${index}" ${h.isClosed ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `;
        });

        grid.querySelectorAll('.day-closed-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const inputs = e.target.closest('.day-hours-row').querySelector('.day-hours-inputs');
                inputs.style.opacity = e.target.checked ? '0.3' : '1';
                inputs.style.pointerEvents = e.target.checked ? 'none' : 'auto';
            });
        });
    }

    function bindSettings() {
        renderWorkingHours();
        document.getElementById('btn-save-hours').addEventListener('click', () => {
            const grid = document.getElementById('day-hours-grid');
            const newHours = {};
            let valid = true;
            grid.querySelectorAll('.day-hours-row').forEach(row => {
                const dayIdx = row.querySelector('.hour-open').dataset.day;
                const openStr = row.querySelector('.hour-open').value;
                const closeStr = row.querySelector('.hour-close').value;
                const open = parseInt(openStr.split(':')[0]);
                const close = parseInt(closeStr.split(':')[0]);
                const isClosed = row.querySelector('.day-closed-cb').checked;
                if (!isClosed && (isNaN(open) || isNaN(close) || open < 0 || close > 24 || open >= close)) {
                    valid = false;
                }
                newHours[dayIdx] = { open, close, isClosed };
            });
            if (!valid) { showToast('Invalid hours detected.', 'error'); return; }
            SalonData.updateSettings({ workingHours: newHours });
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
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    initPinGate();
});
