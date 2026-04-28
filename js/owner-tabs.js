// Zerodot — Owner Tab Renderers
const OwnerTabs = (() => {
    function renderStaffTab(showToast) {
        const list = document.getElementById('workers-list');
        const workers = SalonData.getWorkers();
        if (!workers.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No workers added yet. Add your first team member!</p></div>';
            return;
        }
        list.innerHTML = '';
        workers.forEach(w => {
            const specNames = getSpecNames(w.specializations);
            const card = document.createElement('div');
            card.className = 'worker-card-full' + (w.isActive ? '' : ' inactive');
            card.innerHTML = `
                <div class="worker-card-header">
                    <div class="worker-avatar-lg">${w.avatar}</div>
                    <div class="worker-info">
                        <div class="worker-name-lg">${w.name}</div>
                        <div class="worker-phone">${w.phone ? '📱 ' + w.phone : ''}</div>
                    </div>
                    <span class="booking-status-badge ${w.isActive ? 'badge-completed' : 'badge-cancelled'}">${w.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="worker-specs">${specNames.length ? specNames.map(n => '<span class="spec-tag">' + n + '</span>').join('') : '<span class="spec-tag dim">All services</span>'}</div>
                <div class="worker-card-actions">
                    <button class="btn btn-secondary btn-sm toggle-worker" data-id="${w.id}">${w.isActive ? '⏸ Deactivate' : '▶ Activate'}</button>
                    <button class="btn btn-secondary btn-sm edit-worker" data-id="${w.id}">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm remove-worker" data-id="${w.id}">🗑️</button>
                </div>`;
            list.appendChild(card);
        });
        list.querySelectorAll('.toggle-worker').forEach(b => b.addEventListener('click', () => {
            const w = SalonData.getWorkerById(b.dataset.id);
            SalonData.updateWorker(b.dataset.id, { isActive: !w.isActive });
            showToast(w.isActive ? 'Worker deactivated' : 'Worker activated', 'success');
            renderStaffTab(showToast);
        }));
        list.querySelectorAll('.remove-worker').forEach(b => b.addEventListener('click', () => {
            if (confirm('Remove this worker?')) {
                SalonData.removeWorker(b.dataset.id);
                showToast('Worker removed', 'success');
                renderStaffTab(showToast);
            }
        }));
        list.querySelectorAll('.edit-worker').forEach(b => b.addEventListener('click', () => {
            showWorkerForm(b.dataset.id, showToast);
        }));
    }

    function getSpecNames(ids) {
        if (!ids || !ids.length) return [];
        const all = SalonData.getAllServicesList();
        return ids.map(id => { const s = all.find(x => x.id === id); return s ? s.name : id; });
    }

    function showWorkerForm(editId, showToast) {
        const form = document.getElementById('worker-form');
        const title = document.getElementById('worker-form-title');
        form.style.display = 'block';
        form.dataset.editId = editId || '';
        title.textContent = editId ? 'Edit Worker' : 'Add New Worker';
        const genderToggle = document.getElementById('worker-gender-toggle');
        let workerGender = 'male';

        if (editId) {
            const w = SalonData.getWorkerById(editId);
            document.getElementById('worker-name').value = w.name;
            document.getElementById('worker-phone').value = w.phone || '';
            workerGender = w.gender || 'male';
            genderToggle.querySelectorAll('.gender-option').forEach(o => {
                o.classList.toggle('active', o.dataset.gender === workerGender);
            });
            renderSpecGrid(workerGender, w.specializations || []);
        } else {
            document.getElementById('worker-name').value = '';
            document.getElementById('worker-phone').value = '';
            genderToggle.querySelectorAll('.gender-option').forEach(o => {
                o.classList.toggle('active', o.dataset.gender === 'male');
            });
            renderSpecGrid('male', []);
        }

        genderToggle.onclick = (e) => {
            const opt = e.target.closest('.gender-option');
            if (!opt) return;
            workerGender = opt.dataset.gender;
            genderToggle.querySelectorAll('.gender-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            renderSpecGrid(workerGender, []);
        };

        document.getElementById('btn-save-worker').onclick = () => {
            const name = document.getElementById('worker-name').value.trim();
            if (!name) { showToast('Enter worker name', 'error'); return; }
            const selectedSpecs = Array.from(document.querySelectorAll('.spec-checkbox:checked')).map(c => c.value);
            if (editId) {
                SalonData.updateWorker(editId, { name, phone: document.getElementById('worker-phone').value.trim(), gender: workerGender, specializations: selectedSpecs, avatar: workerGender === 'female' ? '👩' : '👨' });
                showToast('Worker updated', 'success');
            } else {
                SalonData.addWorker({ name, phone: document.getElementById('worker-phone').value.trim(), gender: workerGender, specializations: selectedSpecs });
                showToast('Worker added!', 'success');
            }
            form.style.display = 'none';
            renderStaffTab(showToast);
        };
        document.getElementById('btn-cancel-worker').onclick = () => { form.style.display = 'none'; };
    }

    function renderSpecGrid(gender, selected) {
        const grid = document.getElementById('specialization-grid');
        const svcs = SalonData.getServices();
        const allSvcs = [...(svcs.male || []), ...(svcs.female || [])];
        grid.innerHTML = allSvcs.map(s => `
            <label class="spec-item">
                <input type="checkbox" class="spec-checkbox" value="${s.id}" ${selected.includes(s.id) ? 'checked' : ''}>
                <span>${s.icon} ${s.name}</span>
            </label>`).join('');
    }

    function renderPaymentsTab(showToast) {
        const today = SalonData.getRevenueStats('today');
        const week = SalonData.getRevenueStats('week');
        const month = SalonData.getRevenueStats('month');
        document.getElementById('pay-today').textContent = '₹' + today.totalRevenue;
        document.getElementById('pay-week').textContent = '₹' + week.totalRevenue;
        document.getElementById('pay-month').textContent = '₹' + month.totalRevenue;

        // Pending payments
        const pending = SalonData.getAllAppointments().filter(a => a.status === 'completed' && (!a.payment || a.payment.status !== 'paid'));
        const list = document.getElementById('pending-payments-list');
        if (!pending.length) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending payments!</p></div>';
        } else {
            list.innerHTML = '';
            pending.forEach(a => {
                const svcLabel = a.services ? a.services.map(s => s.name).join(', ') : (a.service || '');
                const div = document.createElement('div');
                div.className = 'payment-pending-card';
                div.innerHTML = `
                    <div class="payment-pending-info">
                        <div class="payment-client">${a.name}</div>
                        <div class="payment-detail">${svcLabel} · ${a.date} · ₹${a.totalAmount || 0}</div>
                    </div>
                    <button class="btn btn-success btn-sm mark-paid-btn" data-id="${a.id}" data-amount="${a.totalAmount || 0}">💰 Collect</button>`;
                list.appendChild(div);
            });
            list.querySelectorAll('.mark-paid-btn').forEach(b => b.addEventListener('click', () => {
                openPaymentModal(b.dataset.id, parseInt(b.dataset.amount) || 0, showToast);
            }));
        }
    }

    function openPaymentModal(appointmentId, defaultAmount, showToast) {
        const modal = document.getElementById('payment-modal');
        const amountInput = document.getElementById('payment-amount');
        amountInput.value = defaultAmount;
        let method = 'cash';
        const toggle = document.getElementById('payment-method-toggle');
        toggle.querySelectorAll('.payment-method-option').forEach(o => {
            o.classList.toggle('active', o.dataset.method === 'cash');
            o.onclick = () => {
                method = o.dataset.method;
                toggle.querySelectorAll('.payment-method-option').forEach(x => x.classList.remove('active'));
                o.classList.add('active');
            };
        });
        const appt = SalonData.getAppointmentById(appointmentId);
        document.getElementById('payment-modal-info').textContent = appt ? `${appt.name} — ${appt.services ? appt.services.map(s=>s.name).join(', ') : ''}` : '';
        modal.classList.add('visible');
        document.getElementById('payment-confirm').onclick = () => {
            const amt = parseInt(amountInput.value) || 0;
            SalonData.markPayment(appointmentId, method, amt);
            modal.classList.remove('visible');
            showToast('Payment recorded ✅', 'success');
            renderPaymentsTab(showToast);
        };
        document.getElementById('payment-cancel').onclick = () => { modal.classList.remove('visible'); };
    }

    function renderClientHistory() {
        const phone = document.getElementById('client-search-phone').value.trim();
        const container = document.getElementById('client-history-result');
        if (!phone || phone.length < 10) { container.innerHTML = ''; return; }
        const history = SalonData.getClientHistory(phone);
        if (!history.bookings.length) {
            container.innerHTML = '<div class="empty-state"><p>No records found.</p></div>';
            return;
        }
        container.innerHTML = `
            <div class="client-summary-card">
                <div class="client-stat"><span class="client-stat-num">${history.totalVisits}</span><span>Visits</span></div>
                <div class="client-stat"><span class="client-stat-num">₹${history.totalSpent}</span><span>Total Spent</span></div>
                <div class="client-stat"><span class="client-stat-num">${history.isRepeatClient ? '⭐' : '🆕'}</span><span>${history.isRepeatClient ? 'Repeat' : 'New'}</span></div>
            </div>
            <div class="client-history-list">${history.bookings.sort((a,b) => new Date(b.date)-new Date(a.date)).map(b => {
                const svc = b.services ? b.services.map(s=>s.name).join(', ') : (b.service||'');
                const statusCls = b.status === 'completed' ? 'badge-completed' : b.status === 'cancelled' ? 'badge-cancelled' : 'badge-upcoming';
                return `<div class="client-history-item"><div><strong>${svc}</strong><div style="font-size:0.78rem;color:var(--text-muted)">${b.date} · ${b.timeSlot}</div></div><div style="text-align:right"><span class="booking-status-badge ${statusCls}">${b.status}</span>${b.payment&&b.payment.status==='paid'?`<div style="font-size:0.8rem;color:var(--success);margin-top:4px">₹${b.payment.amount}</div>`:''}</div></div>`;
            }).join('')}</div>`;
    }

    function renderReportsTab() {
        const stats = SalonData.getRevenueStats('week');
        const chart = document.getElementById('revenue-chart');
        const maxRev = Math.max(...stats.dailyRevenue.map(d => d.revenue), 1);
        chart.innerHTML = '<div class="chart-bars">' + stats.dailyRevenue.map(d => {
            const pct = Math.round((d.revenue / maxRev) * 100);
            return `<div class="chart-bar-wrapper"><div class="chart-bar" style="height:${Math.max(pct, 4)}%"><span class="chart-bar-val">${d.revenue > 0 ? '₹'+d.revenue : ''}</span></div><div class="chart-bar-label">${d.dayName}</div></div>`;
        }).join('') + '</div>';

        // Top services
        const topSvcs = SalonData.getTopServices(5);
        const topList = document.getElementById('top-services-list');
        if (!topSvcs.length) { topList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet</p>'; }
        else {
            const maxCount = topSvcs[0].count;
            topList.innerHTML = topSvcs.map((s, i) => `<div class="top-service-row"><span class="top-rank">#${i+1}</span><span class="top-name">${s.name}</span><div class="top-bar-bg"><div class="top-bar-fill" style="width:${Math.round(s.count/maxCount*100)}%"></div></div><span class="top-count">${s.count}</span></div>`).join('');
        }

        // Worker performance
        const wStats = SalonData.getWorkerStats();
        const wList = document.getElementById('worker-performance-list');
        const entries = Object.values(wStats);
        if (!entries.length) { wList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet</p>'; }
        else {
            wList.innerHTML = entries.map(e => `<div class="worker-perf-row"><span class="worker-perf-avatar">${e.worker.avatar||'👤'}</span><span class="worker-perf-name">${e.worker.name}</span><span class="worker-perf-stat">${e.appointments} jobs</span><span class="worker-perf-rev">₹${e.revenue}</span></div>`).join('');
        }

        // Client stats
        const clients = SalonData.getUniqueClients();
        document.getElementById('client-stats-row').innerHTML = `
            <div class="client-stat-card"><div class="client-stat-num">${clients.total}</div><div class="client-stat-label">Total Clients</div></div>
            <div class="client-stat-card"><div class="client-stat-num">${clients.repeat}</div><div class="client-stat-label">Repeat Clients</div></div>`;
    }

    function renderServiceManager(showToast) {
        let activeGender = document.querySelector('.svc-mgr-tab.active')?.dataset.gender || 'male';
        const svcs = SalonData.getServices()[activeGender] || [];
        const list = document.getElementById('service-manager-list');
        list.innerHTML = '';
        svcs.forEach(s => {
            const row = document.createElement('div');
            row.className = 'svc-mgr-row';
            row.innerHTML = `
                <span class="svc-mgr-icon">${s.icon}</span>
                <span class="svc-mgr-name">${s.name}</span>
                <span class="svc-mgr-price">₹${s.price}</span>
                <button class="btn btn-ghost btn-sm svc-edit" data-id="${s.id}" title="Edit">✏️</button>
                <button class="btn btn-ghost btn-sm svc-del" data-id="${s.id}" title="Delete">🗑️</button>`;
            list.appendChild(row);
        });
        list.querySelectorAll('.svc-del').forEach(b => b.addEventListener('click', () => {
            if (confirm('Remove this service?')) {
                SalonData.removeService(activeGender, b.dataset.id);
                showToast('Service removed', 'success');
                renderServiceManager(showToast);
            }
        }));
        list.querySelectorAll('.svc-edit').forEach(b => b.addEventListener('click', () => {
            const svc = svcs.find(s => s.id === b.dataset.id);
            if (!svc) return;
            const newName = prompt('Service name:', svc.name);
            if (newName === null) return;
            const newPrice = prompt('Price (₹):', svc.price);
            if (newPrice === null) return;
            const newIcon = prompt('Icon emoji:', svc.icon);
            SalonData.updateService(activeGender, svc.id, { name: newName || svc.name, price: parseInt(newPrice) || svc.price, icon: newIcon || svc.icon });
            showToast('Service updated', 'success');
            renderServiceManager(showToast);
        }));
    }

    return { renderStaffTab, showWorkerForm, renderPaymentsTab, openPaymentModal, renderClientHistory, renderReportsTab, renderServiceManager };
})();
