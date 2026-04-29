// Zerodot — Owner Tab Renderers
const OwnerTabs = (() => {
    function renderStaffTab(showToast) {
        const list = document.getElementById('workers-list');
        const workers = SalonData.getWorkers();
        if (!workers.length) {
            list.innerHTML = '<div class="empty-state"><p>No workers added yet. Add your first team member!</p></div>';
            return;
        }
        list.innerHTML = '';
        workers.forEach(w => {
            const specNames = getSpecNames(w.specializations);
            const card = document.createElement('div');
            card.className = 'worker-card-full' + (w.isActive ? '' : ' inactive');
            card.innerHTML = `
                <div class="worker-card-header" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <div class="worker-avatar-lg" style="width:40px;height:40px;border-radius:50%;background:#1F1F1F;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#FFFFFF;">${w.name ? w.name.charAt(0).toUpperCase() : '?'}</div>
                    <div class="worker-info" style="flex:1;">
                        <div class="worker-name-lg" style="font-weight:700;font-size:1.05rem;">${w.name}</div>
                        <div class="worker-phone" style="font-size:0.8rem;color:var(--text-secondary);">${w.phone ? w.phone : ''}</div>
                    </div>
                    <span class="booking-status-badge ${w.isActive ? 'badge-completed' : 'badge-cancelled'}" style="font-size:0.7rem;padding:2px 6px;">${w.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="worker-specs">${specNames.length ? specNames.map(n => '<span class="spec-tag">' + n + '</span>').join('') : '<span class="spec-tag dim">All services</span>'}</div>
                <div class="worker-card-actions">
                    <button class="btn btn-secondary btn-sm toggle-worker" data-id="${w.id}">${w.isActive ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn btn-secondary btn-sm edit-worker" data-id="${w.id}">Edit</button>
                    <button class="btn btn-danger btn-sm remove-worker" data-id="${w.id}">Delete</button>
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
                SalonData.updateWorker(editId, { name, phone: document.getElementById('worker-phone').value.trim(), gender: workerGender, specializations: selectedSpecs, avatar: name ? name.charAt(0).toUpperCase() : '?' });
                showToast('Worker updated', 'success');
            } else {
                SalonData.addWorker({ name, phone: document.getElementById('worker-phone').value.trim(), gender: workerGender, specializations: selectedSpecs, avatar: name ? name.charAt(0).toUpperCase() : '?' });
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

    let currentLedgerDate = new Date().toISOString().split('T')[0];

    function renderPaymentsTab(showToast) {
        // Daily Ledger
        const ledger = SalonData.getDailyLedger(currentLedgerDate);
        document.getElementById('ledger-date-display').textContent = currentLedgerDate === new Date().toISOString().split('T')[0] ? 'Today' : currentLedgerDate;
        
        const openBal = document.getElementById('ledger-opening-balance');
        openBal.textContent = '₹' + ledger.openingBalance;
        
        const openHint = document.getElementById('ledger-opening-hint');
        openHint.textContent = '(Auto-calculated)';
        openBal.classList.add('editable');

        openBal.onclick = () => {
            const amt = prompt('Set Global Initial Cash Seed (₹) [Affects all history]:', SalonData.getSeedOpeningBalance());
            if (amt !== null) {
                SalonData.setSeedOpeningBalance(amt);
                renderPaymentsTab(showToast);
            }
        };

        document.getElementById('ledger-cash-total').textContent = '₹' + ledger.revenueCash;
        document.getElementById('ledger-upi-total').textContent = '₹' + ledger.revenueUpi;
        if(document.getElementById('ledger-card-total')) document.getElementById('ledger-card-total').textContent = '₹' + ledger.revenueCard;
        if(document.getElementById('ledger-digital-total')) document.getElementById('ledger-digital-total').textContent = 'Digital Revenue (Not in hand): ₹' + ledger.digitalRevenue;
        
        document.getElementById('ledger-closing-balance').textContent = '₹' + ledger.closingBalance;
        if(document.getElementById('ledger-hand-cash')) document.getElementById('ledger-hand-cash').textContent = '₹' + ledger.handCash;

        // Payments List
        const payList = document.getElementById('ledger-payments-section');
        if (!ledger.payments.length) {
            payList.innerHTML = '<div class="empty-state" style="padding:10px;font-size:0.8rem;">No payments recorded</div>';
        } else {
            payList.innerHTML = ledger.payments.map(p => `
                <div class="ledger-item">
                    <div class="ledger-item-left">
                        <div class="ledger-item-icon ${p.method}">${p.method === 'cash' ? 'C' : (p.method === 'upi' ? 'U' : '💳')}</div>
                        <div>
                            <div class="ledger-item-name">${p.name}</div>
                            <div class="ledger-item-meta">${p.services} · ${p.time}</div>
                        </div>
                    </div>
                    <div class="ledger-item-amount income">+₹${p.amount}</div>
                </div>
            `).join('');
        }

        // Expenses & Withdrawals List
        const expList = document.getElementById('ledger-expenses-list');
        if (!ledger.expenses.length) {
            expList.innerHTML = '<div class="empty-state" style="padding:5px;font-size:0.75rem;">No entries</div>';
        } else {
            expList.innerHTML = ledger.expenses.map(e => `
                <div class="ledger-item">
                    <div class="ledger-item-left">
                        <div class="ledger-item-icon ${e.type === 'withdrawal' ? 'withdrawal' : 'expense'}">${e.type === 'withdrawal' ? '💸' : (e.method === 'upi' ? 'U' : 'C')}</div>
                        <div>
                            <div class="ledger-item-name">${e.note || (e.type === 'withdrawal' ? 'Owner Withdrawal' : 'Expense')}</div>
                            <div class="ledger-item-meta">${e.method === 'upi' ? 'UPI / GPay' : 'Cash'} · ${e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : ''}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div class="ledger-item-amount debit">-₹${e.amount}</div>
                        <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:0.7rem;" onclick="window.deleteExpense('${currentLedgerDate}', '${e.id}')">✕</button>
                    </div>
                </div>
            `).join('');
        }

        // Bind Next/Prev
        document.getElementById('btn-prev-day').onclick = () => {
            const d = new Date(currentLedgerDate);
            d.setDate(d.getDate() - 1);
            currentLedgerDate = d.toISOString().split('T')[0];
            renderPaymentsTab(showToast);
        };
        document.getElementById('btn-next-day').onclick = () => {
            const d = new Date(currentLedgerDate);
            d.setDate(d.getDate() + 1);
            currentLedgerDate = d.toISOString().split('T')[0];
            renderPaymentsTab(showToast);
        };

        // Bind Add Expense
        document.getElementById('btn-add-expense').onclick = () => {
            const note = document.getElementById('expense-note').value.trim();
            const amt = document.getElementById('expense-amount').value;
            const methodSelect = document.getElementById('expense-method');
            const typeSelect = document.getElementById('expense-type');
            const categorySelect = document.getElementById('expense-category');
            
            const method = methodSelect ? methodSelect.value : 'cash';
            const type = typeSelect ? typeSelect.value : 'expense';
            const category = categorySelect ? categorySelect.value : 'other';
            
            if (!amt) return;
            SalonData.addExpense(currentLedgerDate, note, amt, method, type, category);
            document.getElementById('expense-note').value = '';
            document.getElementById('expense-amount').value = '';
            renderPaymentsTab(showToast);
        };

        // Re-bind delete expense to window so it can be called from inline onclick
        window.deleteExpense = (dateStr, expId) => {
            if (confirm('Delete this expense?')) {
                SalonData.deleteExpense(dateStr, expId);
                renderPaymentsTab(showToast);
            }
        };

        renderClientHistory();
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
        document.getElementById('payment-modal-info').textContent = appt ? `${appt.name} — ${appt.services ? appt.services.map(s => s.name).join(', ') : ''}` : '';
        modal.classList.add('visible');
        document.getElementById('payment-confirm').onclick = () => {
            const amt = parseInt(amountInput.value) || 0;
            SalonData.markPayment(appointmentId, method, amt);
            modal.classList.remove('visible');
            showToast('Payment recorded ✅', 'success');
            // Check if we are on the dashboard (owner.js) to re-render appointments
            if (typeof renderAppointments === 'function') {
                renderAppointments();
                renderStats();
            }
            renderPaymentsTab(showToast);
        };
        document.getElementById('payment-cancel').onclick = () => { modal.classList.remove('visible'); };
    }

    function renderClientHistory() {
        const container = document.getElementById('client-history-timeline');
        if (!container) return;
        const allAppts = SalonData.getAllAppointments().filter(a => a.status === 'completed' || a.status === 'upcoming');
        // Sort descending
        allAppts.sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if (!allAppts.length) {
            container.innerHTML = '<div class="empty-state">No transactions yet</div>';
            return;
        }

        let html = '';
        let currentMonth = '';

        allAppts.forEach(a => {
            const d = new Date(a.date);
            const monthStr = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (monthStr !== currentMonth) {
                html += `<div class="txn-month-header">${monthStr}</div>`;
                currentMonth = monthStr;
            }
            
            const isPaid = a.payment && a.payment.status === 'paid';
            const statusClass = isPaid ? 'paid' : 'pending';
            const amount = a.totalAmount || 0;
            const svcs = (a.services||[]).map(s=>s.name).join(', ') || a.service || '';

            html += `
                <div class="txn-item">
                    <div class="txn-avatar">${a.name.charAt(0).toUpperCase()}</div>
                    <div class="txn-details">
                        <div class="txn-name">${a.name}</div>
                        <div class="txn-service">${svcs}</div>
                    </div>
                    <div class="txn-right">
                        <div class="txn-amount ${statusClass}">₹${amount}</div>
                        <div class="txn-time">${a.date}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function renderReportsTab() {
        const today = new Date();
        let totalRev = 0, totalExp = 0, totalBookings = 0;
        for(let i=6; i>=0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const ledger = SalonData.getDailyLedger(dateStr);
            totalRev += ledger.revenueTotal || 0;
            totalExp += ledger.expensesTotal || 0;
            totalBookings += ledger.payments.length;
        }
        
        const kpiGrid = document.getElementById('kpi-grid');
        if (kpiGrid) {
            kpiGrid.innerHTML = `
                <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Revenue</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--text-accent);">₹${totalRev}</div>
                </div>
                <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Expenses</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--error);">₹${totalExp}</div>
                </div>
                <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Profit</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--success);">₹${totalRev - totalExp}</div>
                </div>
                <div class="kpi-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Bookings</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--text-accent);">${totalBookings}</div>
                </div>
            `;
        }

        const stats = SalonData.getRevenueStats('week');
        const chart = document.getElementById('revenue-chart');
        const maxRev = Math.max(...stats.dailyRevenue.map(d => d.revenue), 1);
        chart.innerHTML = '<div class="chart-bars">' + stats.dailyRevenue.map(d => {
            const pct = Math.round((d.revenue / maxRev) * 100);
            return `<div class="chart-bar-wrapper"><div class="chart-bar" style="height:${Math.max(pct, 4)}%;background:var(--text-accent);"><span class="chart-bar-val">${d.revenue > 0 ? '₹' + d.revenue : ''}</span></div><div class="chart-bar-label">${d.dayName}</div></div>`;
        }).join('') + '</div>';

        // Top services
        const topSvcs = SalonData.getTopServices(5);
        const topList = document.getElementById('top-services-list');
        if (!topSvcs.length) { topList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet</p>'; }
        else {
            const maxCount = topSvcs[0].count;
            topList.innerHTML = topSvcs.map((s, i) => `<div class="top-service-row"><span class="top-rank">#${i + 1}</span><span class="top-name">${s.name}</span><div class="top-bar-bg"><div class="top-bar-fill" style="width:${Math.round(s.count / maxCount * 100)}%"></div></div><span class="top-count">${s.count}</span></div>`).join('');
        }

        // Worker performance
        const wStats = SalonData.getWorkerStats();
        const wList = document.getElementById('worker-performance-list');
        const entries = Object.values(wStats);
        if (!entries.length) { wList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No data yet</p>'; }
        else {
            wList.innerHTML = entries.map(e => `<div class="worker-perf-row" style="display:flex;align-items:center;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:8px;"><div class="worker-perf-avatar" style="width:32px;height:32px;border-radius:50%;background:#222;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#fff;margin-right:12px;">${e.worker.name ? e.worker.name.charAt(0).toUpperCase() : '?'}</div><span class="worker-perf-name" style="flex:1;">${e.worker.name}</span><span class="worker-perf-stat" style="color:var(--text-muted);font-size:0.85rem;margin-right:16px;">${e.appointments} jobs</span><span class="worker-perf-rev" style="font-weight:600;">₹${e.revenue}</span></div>`).join('');
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
            row.style.cssText = 'display:flex;align-items:center;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:8px;transition:all 0.2s;';
            row.innerHTML = `
                <span class="svc-mgr-name" style="flex:1;font-weight:600;">${s.name}</span>
                <span class="svc-mgr-price" style="color:var(--success);font-weight:600;margin-right:16px;">₹${s.price}</span>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-ghost btn-sm svc-edit" data-id="${s.id}" style="padding:4px 8px;font-size:0.75rem;">Edit</button>
                    <button class="btn btn-ghost btn-sm svc-del" data-id="${s.id}" style="padding:4px 8px;font-size:0.75rem;color:var(--error);">Delete</button>
                </div>`;
            row.addEventListener('mouseover', () => row.style.background = 'var(--bg-card-hover)');
            row.addEventListener('mouseout', () => row.style.background = 'var(--bg-card)');
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
            SalonData.updateService(activeGender, svc.id, { name: newName || svc.name, price: parseInt(newPrice) || svc.price, icon: '' });
            showToast('Service updated', 'success');
            renderServiceManager(showToast);
        }));
    }

    return { renderStaffTab, showWorkerForm, renderPaymentsTab, openPaymentModal, renderClientHistory, renderReportsTab, renderServiceManager };
})();
