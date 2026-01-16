const API_BASE = '/api';

// State
window.currentData = {
    projects: [],
    tasks: [],
    teams: [],
    members: []
};
let calendarDate = new Date(); // Calendar state
let calendarView = 'month'; // 'month' or 'week'
let calendarFilters = { project: '', priority: '' };

// --------------------------------------------------------------------------
//                                  INIT
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    updateUserProfileDisplay();
    setupAvatarMenu();
    setupTabs();
    setupCalendar();
    loadAllData();
    applyRolePermissions();
    setupMemberModalLogic();
    setupEmojiPicker();
    console.log("Application initialized");
});

// --------------------------------------------------------------------------
//                                  LOGOUT
// --------------------------------------------------------------------------
window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_initials');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_id');
    localStorage.removeItem('team_member_id');
    localStorage.removeItem('user_bio');
    localStorage.removeItem('user_phone');
    window.location.href = 'index.html';
}



function updateUserProfileDisplay() {
    const name = localStorage.getItem('user_name');
    const email = localStorage.getItem('user_email');
    const initials = localStorage.getItem('user_initials');
    const bio = localStorage.getItem('user_bio');
    const role = localStorage.getItem('user_role');
    const phone = localStorage.getItem('user_phone');

    if (name) {
        document.querySelectorAll('.user-name, .greeting-name').forEach(el => el.textContent = name);
    }
    if (email) {
        document.querySelectorAll('.user-email').forEach(el => el.textContent = email);
    }
    if (initials) {
        document.querySelectorAll('.avatar').forEach(el => el.textContent = initials);
    }

    // Profile tab specific displays
    const bioEl = document.getElementById('profile-bio-display');
    if (bioEl) bioEl.textContent = bio || '...';

    const roleEl = document.getElementById('profile-role-display');
    if (roleEl) roleEl.textContent = role || 'Administrateur';

    const phoneEl = document.getElementById('profile-phone-display');
    if (phoneEl) phoneEl.textContent = phone || 'Non renseigné';
}

function setupAvatarMenu() {
    const avatarBtn = document.getElementById('avatar-btn');
    const menu = document.getElementById('avatar-menu');

    if (!avatarBtn || !menu) return;

    // Toggle menu on click
    avatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.hidden;
        menu.hidden = !isHidden;
        avatarBtn.setAttribute('aria-expanded', !isHidden);
    });

    // Handle menu items
    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.avatar-menu-item');
        if (!item) return;

        const action = item.getAttribute('data-action');
        if (action === 'logout') {
            window.logout();
        } else if (action === 'settings') {
            switchToTab('settings');
        } else if (action === 'profile') {
            switchToTab('profile');
        }

        menu.hidden = true;
        avatarBtn.setAttribute('aria-expanded', 'false');
    });
}

function setupTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';

        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// --------------------------------------------------------------------------
//                                  TOASTS
// --------------------------------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const icon = type === 'success'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --------------------------------------------------------------------------
//                                  FETCH
// --------------------------------------------------------------------------
async function apiFetch(input, init = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        init.headers = {
            ...init.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    try {
        const response = await fetch(input, init);
        if (response.status === 401) {
            window.location.href = 'index.html';
            return;
        }
        return response;
    } catch (error) {
        showToast('Erreur réseau: Impossible de joindre le serveur', 'error');
        throw error;
    }
}

async function loadAllData() {
    // Show skeletons in home
    document.getElementById('home-projects-list').innerHTML =
        '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';

    const loadPromises = [
        loadProjects(),
        loadTasks(),
        loadTeams(),
        loadMembers()
    ];

    try {
        await Promise.all(loadPromises);
        updateDashboard();
        updateHome();
        populateProjectSelects();
        if (role === 'Admin' || role === 'Sous-Admin') {
            populateMemberSelect('task-assigned');
        }
        setupCalendar(); // Re-setup to bind filters
        if (document.getElementById('calendar-tab').classList.contains('active')) {
            renderCalendar();
        }
        applyRolePermissions(); // Re-apply permissions after data load
    } catch (err) {
        console.error("Initial load failed", err);
    }
}

async function loadMembers() {
    try {
        const res = await apiFetch(`${API_BASE}/TeamMembers`);
        if (!res.ok) return;

        currentData.members = await res.json();

        // Refresh teams and dashboard to update member counts and stats
        loadTeams();
        updateDashboard();

        const list = document.getElementById('members-list');
        if (list && document.getElementById('members-tab').classList.contains('active')) {
            displayMembers();
        }
    } catch (e) { console.error(e); }
}


async function displayMembers() {
    const list = document.getElementById('members-list');
    if (!list) return;

    if (currentData.members.length === 0) {
        const role = localStorage.getItem('user_role') || 'User';
        const canAdd = role === 'Admin' || role === 'Sous-Admin';
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
                <h3>Aucun membre trouvé</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Commencez par ajouter votre premier collaborateur !</p>
                ${canAdd ? '<button class="btn btn-primary" onclick="openMemberEdit()">Ajouter un membre</button>' : ''}
            </div>
        `;
        return;
    }

    // Fetch system roles for all members
    const membersWithRoles = await Promise.all(currentData.members.map(async (m) => {
        try {
            const res = await apiFetch(`${API_BASE}/Auth/GetUserRole/${encodeURIComponent(m.email)}`);
            if (res.ok) {
                const data = await res.json();
                return { ...m, systemRole: data.role || 'User' };
            }
        } catch (e) {
            console.error('Error loading role for', m.email, e);
        }
        return { ...m, systemRole: 'User' };
    }));

    const role = localStorage.getItem('user_role') || 'User';
    const canManageMembers = role === 'Admin' || role === 'Sous-Admin';

    list.innerHTML = membersWithRoles.map(m => {
        const roleLabel = m.systemRole === 'Admin' ? 'Administrateur' :
            m.systemRole === 'Sous-Admin' ? 'Sous-Admin' :
                m.systemRole === 'Chef de Projet' ? 'Chef de Projet' : 'Utilisateur';

        return `
        <div class="card member-card ${m.role === 'Chef de groupe' ? 'is-leader' : ''}" ${canManageMembers ? `onclick="openMemberEdit('${m.id}')"` : 'style="cursor: default;"'}>
            <div class="section-header" style="margin-bottom: 12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="avatar" style="width:40px; height:40px; font-size:0.9rem;">${getInitials(m.name)}</div>
                    <div>
                        <div class="card-title" style="font-weight:700; font-size:1.05rem; display: flex; align-items: center; gap: 8px;">
                            ${m.name} 
                            ${m.role === 'Chef de groupe' ? '<span title="Chef de groupe" style="font-size: 1.1rem;">👑</span>' : ''}
                            ${m.role === 'Superviseur' ? '<span title="Superviseur" style="font-size: 1.1rem;">🛡️</span>' : ''}
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${roleLabel}</div>
                    </div>
                </div>
                <div class="action-buttons admin-delete member-action">
                    <button class="btn icon-btn" onclick="event.stopPropagation(); window.deleteMember(${m.id})" title="Supprimer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; font-size:0.9rem; color:var(--text-secondary);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    ${m.email}
                </div>
                <div style="display:flex; align-items:center; gap:8px; font-size:0.85rem; margin-top:4px;">
                    <span class="badge" style="background:rgba(var(--primary-rgb), 0.1); color:var(--primary);">
                        ${m.team ? '👥 ' + m.team.name : 'Sans équipe'}
                    </span>
                </div>
            </div>
        </div>
    `;
    }).join('');
}

// --------------------------------------------------------------------------
//                                  TABS
// --------------------------------------------------------------------------
function setupTabs() {
    // Standard sidebar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchToTab(btn.dataset.tab);
        });
    });

    // Delegated listener for any element with data-tab or data-action="profile"
    document.addEventListener('click', (e) => {
        const profileBtn = e.target.closest('[data-action="profile"]');
        if (profileBtn) {
            e.preventDefault();
            console.log("Profile action triggered");
            switchToTab('profile');
            const menu = document.getElementById('avatar-menu');
            if (menu) menu.hidden = true;
        }

        const settingsBtn = e.target.closest('[data-action="settings"]');
        if (settingsBtn) {
            e.preventDefault();
            console.log("Settings action triggered");
            switchToTab('settings');
            const menu = document.getElementById('avatar-menu');
            if (menu) menu.hidden = true;
        }

        const logoutBtn = e.target.closest('[data-action="logout"]');
        if (logoutBtn) {
            e.preventDefault();
            console.log("Logout action triggered");
            logout();
        }
    });

    // Calendar navigation
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    const todayBtn = document.getElementById('today-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => {
        if (calendarView === 'month') {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
        } else {
            calendarDate.setDate(calendarDate.getDate() - 7);
        }
        renderCalendar();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        if (calendarView === 'month') {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
        } else {
            calendarDate.setDate(calendarDate.getDate() + 7);
        }
        renderCalendar();
    });
    if (todayBtn) todayBtn.addEventListener('click', () => {
        calendarDate = new Date();
        renderCalendar();
    });
}

window.switchToTab = async function (tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(b => b.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const panel = document.getElementById(`${tabName}-tab`);
    if (panel) panel.classList.add('active');

    if (tabName === 'profile') displayProfile();
    if (tabName === 'settings') {
        displaySettings();
        load2FAStatus();
    }
    if (tabName === 'calendar') renderCalendar();
    if (tabName === 'teams') displayTeams();
    if (tabName === 'members') await displayMembers();
    if (tabName === 'logs') await loadLogs();

    applyRolePermissions();
}

function applyRolePermissions() {
    const role = localStorage.getItem('user_role') || 'User';
    const adminOnlyElements = document.querySelectorAll('.admin-only');

    adminOnlyElements.forEach(el => {
        // Special case for delete buttons if they have .admin-delete class
        if (el.classList.contains('admin-delete')) {
            if (role === 'Admin' || role === 'Sous-Admin') el.style.display = '';
            else el.style.display = 'none';
            return;
        }

        if (role === 'Admin' || role === 'Sous-Admin') {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Hide New Task button for standard users (explicit check)
    const newTaskBtn = document.querySelector('[data-action="new-task"]');
    if (newTaskBtn) {
        if (role === 'Admin' || role === 'Sous-Admin' || role === 'Chef de Projet') {
            newTaskBtn.style.display = '';
        } else {
            newTaskBtn.style.display = 'none';
        }
    }

    // Handle greeting
    const greeting = document.querySelector('.greeting-name');
    if (greeting) {
        if (role === 'Admin') {
            greeting.textContent = 'Administrateur';
        } else if (role === 'Chef de Projet') {
            greeting.textContent = 'Chef de Projet';
        } else {
            greeting.textContent = localStorage.getItem('user_name') || 'Utilisateur';
        }
    }

    // Hide personal stats for Admin/Sous-Admin
    const heroStats = document.querySelector('.hero-stats');
    const heroText = document.querySelector('.hero-content p');
    const profileStats = document.querySelector('.profile-stats-card');
    const profileGrid = document.querySelector('.profile-grid');

    if (role === 'Admin' || role === 'Sous-Admin') {
        if (heroStats) heroStats.style.display = 'none';
        if (heroText) heroText.style.display = 'none';
        if (profileStats) profileStats.style.display = 'none';
        if (profileGrid) profileGrid.classList.add('single-col');
    } else {
        if (heroStats) heroStats.style.display = '';
        if (heroText) heroText.style.display = '';
        if (profileStats) profileStats.style.display = '';
        if (profileGrid) profileGrid.classList.remove('single-col');
    }

    // Hide Sidebar Tabs for Users with No Projects
    const hasProjects = window.currentData && window.currentData.projects && window.currentData.projects.length > 0;
    if (role === 'User' && !hasProjects) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const tab = btn.getAttribute('data-tab');
            if (tab && tab !== 'home' && tab !== 'profile' && tab !== 'settings') {
                btn.parentElement.style.display = 'none';
            }
        });
    } else {
        // Reset (show them back)
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.parentElement.style.display = '';
        });
    }

    // Hide Recent Projects Section on Home for Project-less Users
    const recentProjectsSection = document.getElementById('home-recent-projects-section');
    if (recentProjectsSection) {
        if (role === 'User' && !hasProjects) {
            recentProjectsSection.style.display = 'none';
        } else {
            recentProjectsSection.style.display = '';
        }
    }
}

function displayProfile() {
    const name = localStorage.getItem('user_name') || 'Utilisateur';
    const email = localStorage.getItem('user_email') || 'email@example.com';
    const initials = localStorage.getItem('user_initials') || 'U';

    document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = email);
    document.querySelectorAll('.profile-avatar-large').forEach(el => el.textContent = initials);

    const projCount = currentData.projects.length;
    const taskCount = currentData.tasks.length;
    const doneCount = currentData.tasks.filter(t => t.status === 3).length;

    setText('profile-proj-count', projCount);
    setText('profile-task-count', taskCount);
    setText('profile-done-count', doneCount);
}

// --------------------------------------------------------------------------
//                                 SETTINGS
// --------------------------------------------------------------------------
function displaySettings() {
    const name = localStorage.getItem('user_name') || '';
    const email = localStorage.getItem('user_email') || '';
    const bio = localStorage.getItem('user_bio') || '';
    const role = localStorage.getItem('user_role') || '';
    const phone = localStorage.getItem('user_phone') || '';

    const nameInput = document.getElementById('settings-fullname');
    const emailInput = document.getElementById('settings-email');
    const bioInput = document.getElementById('settings-bio');
    const roleInput = document.getElementById('settings-role');
    const phoneInput = document.getElementById('settings-phone');

    if (nameInput) nameInput.value = name;
    if (emailInput) emailInput.value = email;
    if (bioInput) bioInput.value = bio;
    if (roleInput) roleInput.value = role;
    if (phoneInput) phoneInput.value = phone;
}

window.saveProfileUpdate = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.innerText;
    btn.innerText = "Enregistrement...";
    btn.disabled = true;

    const fullName = document.getElementById('settings-fullname').value;
    const email = document.getElementById('settings-email').value;
    const bio = document.getElementById('settings-bio').value;
    const role = document.getElementById('settings-role').value;
    const phone = document.getElementById('settings-phone').value;

    // Validation Phone (Morocco)
    const phoneRegex = /^(\+212|0)([ \-_/]*)(\d[ \-_/]*){9}$/;
    if (phone && !phoneRegex.test(phone)) {
        showToast('Format invalide (Ex: +212 6... ou 06...)', 'error');
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    try {
        const res = await apiFetch(`${API_BASE}/Auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, bio, role, phone })
        });

        if (res.ok) {
            const data = await res.json();
            // Update local storage
            localStorage.setItem('user_name', data.fullName);
            localStorage.setItem('user_email', data.email);
            localStorage.setItem('user_initials', data.fullName.substring(0, 2).toUpperCase());
            if (data.bio) localStorage.setItem('user_bio', data.bio);
            if (data.role) localStorage.setItem('user_role', data.role);
            if (data.phone) localStorage.setItem('user_phone', data.phone);

            // Update UI across app
            updateUserProfileDisplay();
            showToast('Profil mis à jour avec succès !');
        } else {
            const errs = await res.json();
            showToast('Erreur lors de la mise à jour', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erreur réseau', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

window.handlePasswordChange = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-password');
    const originalText = btn.innerText;

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }

    btn.innerText = 'Mise à jour...';
    btn.disabled = true;

    try {
        const res = await apiFetch(`${API_BASE}/Auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });

        if (res.ok) {
            showToast('Mot de passe mis à jour !');
            closeModal('change-password-modal');
            document.getElementById('change-password-form').reset();
        } else {
            let message = 'Erreur lors du changement';
            try {
                const data = await res.json();
                message = data.message || (Array.isArray(data) ? data[0].description : (data.errors ? Object.values(data.errors).flat()[0] : message));
            } catch (e) { }
            showToast(message, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erreur réseau', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Handle Email Change
window.handleEmailChange = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-email');
    const originalText = btn.innerText;

    const currentPassword = document.getElementById('current-password-email').value;
    const newEmail = document.getElementById('new-email').value;
    const confirmEmail = document.getElementById('confirm-new-email').value;

    if (newEmail !== confirmEmail) {
        showToast('Les adresses email ne correspondent pas', 'error');
        return;
    }

    btn.innerText = 'Mise à jour...';
    btn.disabled = true;

    try {
        const res = await apiFetch(`${API_BASE}/Auth/change-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newEmail })
        });

        if (res.ok) {
            showToast('Adresse email mise à jour ! Veuillez vous reconnecter.');
            closeModal('change-email-modal');
            document.getElementById('change-email-form').reset();
            // Update the displayed email
            document.getElementById('settings-email').value = newEmail;
            // Optionally log out the user since email changed
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user_id');
                window.location.href = '/login.html';
            }, 2000);
        } else {
            let message = 'Erreur lors du changement';
            try {
                const data = await res.json();
                message = data.message || (Array.isArray(data) ? data[0].description : (data.errors ? Object.values(data.errors).flat()[0] : message));
            } catch (e) { }
            showToast(message, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erreur réseau', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Two-Factor Authentication
async function load2FAStatus() {
    try {
        const res = await apiFetch(`${API_BASE}/Auth/2fa-status`);
        if (res.ok) {
            const status = await res.json();
            const text = document.getElementById('2fa-status-text');
            const btn = document.getElementById('btn-2fa-toggle');
            if (text && btn) {
                text.textContent = status.isEnabled ? 'Activée' : 'Non activée';
                text.style.color = status.isEnabled ? 'var(--success)' : 'var(--text-secondary)';
                btn.textContent = status.isEnabled ? 'Désactiver' : 'Activer';
                btn.dataset.enabled = status.isEnabled;
            }
        }
    } catch (e) { console.error(e); }
}

window.handle2FAToggle = async function () {
    const btn = document.getElementById('btn-2fa-toggle');
    const isEnabled = btn.dataset.enabled === 'true';

    if (isEnabled) {
        if (!confirm('Désactiver la double authentification ?')) return;
        try {
            const res = await apiFetch(`${API_BASE}/Auth/2fa-disable`, { method: 'POST' });
            if (res.ok) {
                showToast('2FA désactivée');
                load2FAStatus();
            }
        } catch (e) { console.error(e); }
    } else {
        try {
            const res = await apiFetch(`${API_BASE}/Auth/2fa-setup`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                document.getElementById('2fa-secret-key').textContent = data.sharedKey;
                render2FAQRCode(data.authenticatorUri);
                openModal('2fa-setup-modal');
            }
        } catch (e) { console.error(e); }
    }
}

window.handle2FAVerify = async function (e) {
    e.preventDefault();
    const code = document.getElementById('2fa-code').value;
    const btn = document.getElementById('btn-verify-2fa');
    const originalText = btn.innerText;

    btn.innerText = 'Vérification...';
    btn.disabled = true;

    try {
        const res = await apiFetch(`${API_BASE}/Auth/2fa-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        if (res.ok) {
            showToast('Double authentification activée !');
            closeModal('2fa-setup-modal');
            load2FAStatus();
        } else {
            const data = await res.json();
            showToast(data.message || 'Code invalide', 'error');
        }
    } catch (e) {
        showToast('Erreur lors de la vérification', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function render2FAQRCode(uri) {
    const container = document.getElementById('2fa-qrcode');
    if (!container) return;

    // Clear previous QR code
    container.innerHTML = '';

    // Create new QR Code
    new QRCode(container, {
        text: uri,
        width: 180,
        height: 180,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// --------------------------------------------------------------------------
//                                CALENDAR
// --------------------------------------------------------------------------
function setupCalendar() {
    // Fill project filter
    const projFilter = document.getElementById('calendar-filter-project');
    if (projFilter) {
        projFilter.innerHTML = '<option value="">Tous les projets</option>' +
            currentData.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        projFilter.addEventListener('change', (e) => {
            calendarFilters.project = e.target.value;
            renderCalendar();
        });
    }

    const prioFilter = document.getElementById('calendar-filter-priority');
    if (prioFilter) {
        prioFilter.addEventListener('change', (e) => {
            calendarFilters.priority = e.target.value;
            renderCalendar();
        });
    }

    // View toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            calendarView = btn.dataset.view;
            renderCalendar();
        });
    });

    document.getElementById('prev-month')?.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });
    document.getElementById('today-btn')?.addEventListener('click', () => {
        calendarDate = new Date();
        renderCalendar();
    });
}

function renderCalendar() {
    if (calendarView === 'week') {
        renderWeekView();
        return;
    }

    const monthYearEl = document.getElementById('calendar-month-year');
    const daysContainer = document.getElementById('calendar-days');
    if (!monthYearEl || !daysContainer) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    // Display Month/Year
    const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(calendarDate);
    monthYearEl.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

    // Clear grid
    daysContainer.innerHTML = '';
    const gridHeader = document.querySelector('.calendar-grid-header');
    if (gridHeader) gridHeader.style.display = 'grid';

    // Calculate days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Day of week (0-6, where 0 is Sunday, but we want 1=Mon, ..., 0=Sun)
    let startDayOfWeek = firstDay.getDay();
    if (startDayOfWeek === 0) startDayOfWeek = 7; // Convert Sun (0) to 7

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const daysInMonth = lastDay.getDate();

    // Days from previous month
    for (let i = startDayOfWeek - 1; i > 0; i--) {
        const d = prevMonthLastDay - i + 1;
        const fullDate = new Date(year, month - 1, d);
        daysContainer.appendChild(createCalendarDay(d, true, false, fullDate));
    }

    // Days from current month
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const fullDate = new Date(year, month, i);
        daysContainer.appendChild(createCalendarDay(i, false, isToday, fullDate));
    }

    // Days from next month
    const remainingSlots = 42 - daysContainer.children.length; // 6 weeks
    for (let i = 1; i <= remainingSlots; i++) {
        const fullDate = new Date(year, month + 1, i);
        daysContainer.appendChild(createCalendarDay(i, true, false, fullDate));
    }

    // Bind events to days
    populateCalendarEvents(year, month);
}

function renderWeekView() {
    const monthYearEl = document.getElementById('calendar-month-year');
    const daysContainer = document.getElementById('calendar-days');
    if (!monthYearEl || !daysContainer) return;

    // Hide standard grid header for week view (we'll make our own)
    const gridHeader = document.querySelector('.calendar-grid-header');
    if (gridHeader) gridHeader.style.display = 'none';

    // Get current week (Mon-Sun)
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const day = calendarDate.getDate();
    let dayOfWeek = calendarDate.getDay(); // 0 is Sun
    if (dayOfWeek === 0) dayOfWeek = 7;

    const monday = new Date(calendarDate);
    monday.setDate(day - (dayOfWeek - 1));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    monthYearEl.textContent = `Semaine du ${monday.getDate()} au ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    daysContainer.innerHTML = '';

    for (let i = 0; i < 7; i++) {
        const current = new Date(monday);
        current.setDate(monday.getDate() + i);
        const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const isToday = current.toDateString() === new Date().toDateString();

        const dayEl = createCalendarDay(current.getDate(), false, isToday, current);
        dayEl.querySelector('.day-number').innerHTML = `<span style="font-size:0.8rem; opacity:0.6; display:block">${labels[i]}</span> ${current.getDate()}`;
        daysContainer.appendChild(dayEl);
    }

    populateCalendarEvents(); // General populate works for visible days
}

function createCalendarDay(num, isOtherMonth, isToday, fullDate) {
    const div = document.createElement('div');
    div.className = 'calendar-day' + (isOtherMonth ? ' other-month' : '') + (isToday ? ' today' : '');
    div.dataset.date = fullDate.toISOString().split('T')[0];

    div.innerHTML = `
        <span class="day-number">${num}</span>
        <div class="day-events"></div>
        <div class="workload-indicator"><div class="workload-bar"></div></div>
    `;

    // Drop Zone
    div.addEventListener('dragover', (e) => {
        e.preventDefault();
        div.classList.add('drag-over');
    });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', async (e) => {
        e.preventDefault();
        div.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('task-id');
        if (taskId) {
            await rescheduleTask(taskId, div.dataset.date);
        }
    });

    // Double click to create
    div.addEventListener('dblclick', (e) => {
        if (e.target.closest('.calendar-event')) return; // Don't trigger on events
        const modal = document.getElementById('task-modal');
        if (modal) {
            document.getElementById('task-form').reset();
            document.getElementById('task-id').value = '';
            document.getElementById('task-due').value = div.dataset.date;
            modal.style.display = 'block';
        }
    });

    return div;
}

async function rescheduleTask(taskId, newDate) {
    const task = currentData.tasks.find(t => t.id == taskId);
    if (!task) return;

    try {
        const res = await apiFetch(`${API_BASE}/Tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...task, dueDate: newDate })
        });

        if (res.ok) {
            showToast('Tâche replanifiée !');
            loadAllData(); // Refresh everything
        } else {
            showToast('Erreur lors de la replanification', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erreur réseau', 'error');
    }
}

function populateCalendarEvents() {
    const days = document.querySelectorAll('.calendar-day');
    const dayMap = {};
    days.forEach(d => {
        const dateAttr = d.dataset.date;
        dayMap[dateAttr] = {
            container: d.querySelector('.day-events'),
            bar: d.querySelector('.workload-bar'),
            count: 0
        };
        if (dayMap[dateAttr].container) dayMap[dateAttr].container.innerHTML = '';
    });

    // Filtering logic
    const filteredTasks = currentData.tasks.filter(t => {
        if (calendarFilters.project && t.projectId != calendarFilters.project) return false;
        if (calendarFilters.priority && t.priority != calendarFilters.priority) return false;
        return true;
    });

    // Projects
    currentData.projects.forEach(p => {
        if (!p.deadline) return;
        const dateStr = p.deadline.split('T')[0];
        if (dayMap[dateStr]) {
            const eventEl = document.createElement('div');
            eventEl.className = 'calendar-event event-project';
            eventEl.title = `Projet: ${p.name}`;
            eventEl.textContent = `📁 ${p.name}`;
            eventEl.onclick = (e) => { e.stopPropagation(); openProjectModal(p.id); };
            dayMap[dateStr].container?.appendChild(eventEl);
        }
    });

    // Tasks
    filteredTasks.forEach(t => {
        if (!t.dueDate) return;
        const dateStr = t.dueDate.split('T')[0];
        if (dayMap[dateStr]) {
            dayMap[dateStr].count++;
            const eventEl = document.createElement('div');
            eventEl.className = 'calendar-event event-task';
            eventEl.draggable = true;
            eventEl.title = `Tâche: ${t.title}`;
            eventEl.textContent = `📍 ${t.title}`;

            eventEl.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('task-id', t.id);
                e.dataTransfer.effectAllowed = 'move';
            });

            eventEl.onclick = (e) => { e.stopPropagation(); openTaskModal(t.id); };
            dayMap[dateStr].container?.appendChild(eventEl);
        }
    });

    // Update workload indicators
    Object.values(dayMap).forEach(day => {
        if (day.bar) {
            const percent = Math.min(day.count * 20, 100);
            day.bar.style.width = percent + '%';
            if (day.count > 4) day.bar.className = 'workload-bar high';
            else if (day.count > 2) day.bar.className = 'workload-bar medium';
            else day.bar.className = 'workload-bar low';
        }
    });
}
//                                PROJECTS
// --------------------------------------------------------------------------
async function loadProjects() {
    try {
        const res = await apiFetch(`${API_BASE}/Projects`);
        currentData.projects = await res.json();
        displayProjects();
        populateProjectSelects();
        applyRolePermissions();
    } catch (e) { console.error(e); }
}

function displayProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;

    // Check user role for permissions
    const role = localStorage.getItem('user_role') || 'User';
    const canEdit = role === 'Admin' || role === 'Sous-Admin' || role === 'Chef de Projet';

    list.innerHTML = currentData.projects.map(p => `
        <div class="card project-card" data-status="${p.status}" ${canEdit ? `onclick="openProjectEdit(${p.id})"` : 'style="cursor: default;"'}>
            <div class="section-header" style="margin-bottom: 10px;">
                <div class="card-title" style="font-weight:700;">${p.name}</div>
                <div class="action-buttons">
                    <button class="btn icon-btn" onclick="event.stopPropagation(); window.openProjectChat(${p.id})" title="Discussion de groupe">💬</button>
                    ${(role === 'Admin' || role === 'Sous-Admin') ? `<button class="btn icon-btn" onclick="event.stopPropagation(); window.deleteProject(${p.id})" title="Supprimer">🗑️</button>` : ''}
                </div>
            </div>
            <p style="color:var(--text-secondary); margin-bottom: 1rem; flex:1;">${p.description || 'Pas de description'}</p>
            
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--text-muted);">
                <span>${p.team ? '👥 ' + p.team.name + ' (' + (p.team.members ? p.team.members.length : 0) + ' membres)' : 'Pas d\'équipe'}</span>
                <span>📅 ${formatDate(p.deadline)}</span>
            </div>
             <div style="margin-top:10px;">
                <span style="font-size:0.75rem; padding:4px 8px; border-radius:10px; background:var(--surface-active);">
                    ${getStatusLabel(p.status)}
                </span>
            </div>
        </div>
    `).join('');

    // Update visibility for "New Project" button
    const newProjectBtn = document.querySelector('[data-action="new-project"]');
    if (newProjectBtn) {
        newProjectBtn.style.display = canEdit ? '' : 'none';
    }
}

function updateHome() {
    // Recent projects on Home
    const homeList = document.getElementById('home-projects-list');
    if (homeList) {
        // Take first 3
        const recent = currentData.projects.slice(0, 3);
        homeList.innerHTML = recent.map(p => `
             <div class="card home-card">
                <div style="font-weight:700; margin-bottom:0.5rem;">${p.name}</div>
                <p style="font-size:0.9rem; color:var(--text-secondary);">${p.description || ''}</p>
                <div style="margin-top:1rem; font-size:0.8rem; opacity:0.7;">
                    ${p.team && p.team.members ? p.team.members.length + ' membres' : '0 membres'}
                </div>
             </div>
        `).join('');
    }
}

// --------------------------------------------------------------------------
//                                  TEAMS
// --------------------------------------------------------------------------
async function loadTeams() {
    try {
        const res = await apiFetch(`${API_BASE}/Teams`);
        currentData.teams = await res.json();
        displayTeams();
    } catch (e) { console.error(e); }
}

function displayTeams() {
    const list = document.getElementById('teams-list');
    if (!list) return;

    // Check user role for delete permission
    const role = localStorage.getItem('user_role') || 'User';
    const canDelete = role === 'Admin' || role === 'Sous-Admin';

    list.innerHTML = currentData.teams.map(t => `
        <div class="card">
            <div class="section-header">
                <strong>${t.name}</strong>
                ${canDelete ? `<button class="btn icon-btn" onclick="window.deleteTeam(${t.id})" title="Supprimer">🗑️</button>` : ''}
            </div>
            <p style="color:var(--text-secondary); font-size:0.9rem;">${t.description || '...'}</p>
            <div style="margin-top:1rem; font-size:0.85rem;">
                <div style="margin-bottom:0.5rem;">👤 ${t.members ? t.members.length : 0} membres</div>
                <div style="display:flex; flex-direction:column; gap:4px; padding-left:8px; border-left:2px solid var(--border);">
                    ${t.members && t.members.length > 0
            ? t.members.map(m => `<span style="color:var(--text-secondary); display: flex; align-items: center; gap: 5px;">${m.name} ${m.role === 'Chef de groupe' ? '<span title="Chef de groupe" style="font-size: 0.9rem;">👑</span>' : ''}</span>`).join('')
            : '<span style="opacity:0.6; font-style:italic;">Aucun membre</span>'}
                </div>
            </div>
        </div>
    `).join('');

    // Also hide the "New Team" button if it exists and user is restricted
    const newTeamBtn = document.querySelector('[data-action="new-team"]');
    if (newTeamBtn) {
        newTeamBtn.style.display = canDelete ? '' : 'none';
    }
}

// --------------------------------------------------------------------------
//                                  TASKS (KANBAN)
// --------------------------------------------------------------------------
async function loadTasks() {
    try {
        const res = await apiFetch(`${API_BASE}/Tasks`);
        let tasks = await res.json();

        // Frontend Filtering
        const search = document.getElementById('task-search')?.value.toLowerCase();
        const projFilter = document.getElementById('task-filter-project')?.value;

        if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search));
        if (projFilter) tasks = tasks.filter(t => t.projectId == projFilter);

        currentData.tasks = tasks;
        displayKanban();
    } catch (e) { console.error(e); }
}

function displayKanban() {
    // Columns
    const cols = {
        0: document.getElementById('kanban-todo'),
        1: document.getElementById('kanban-inprogress'),
        2: document.getElementById('kanban-review'),
        3: document.getElementById('kanban-done')
    };

    // Clear cols
    Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

    // Counters
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };

    currentData.tasks.forEach(task => {
        const status = task.status || 0;
        counts[status]++;

        const col = cols[status];
        if (col) {
            col.innerHTML += createTaskCard(task);
        }
    });

    // Update Badges
    document.getElementById('count-todo').textContent = counts[0];
    document.getElementById('count-inprogress').textContent = counts[1];
    document.getElementById('count-review').textContent = counts[2];
    document.getElementById('count-done').textContent = counts[3];

    // Mini stat update
    const activeTasks = counts[1]; // En cours
    const completedTasks = counts[3]; // Terminé

    const msTasks = document.getElementById('mini-stat-tasks');
    if (msTasks) msTasks.textContent = activeTasks;

    const msCompleted = document.getElementById('mini-stat-completed');
    if (msCompleted) msCompleted.textContent = completedTasks;
}

function createTaskCard(task) {
    const assignedName = task.assignedTo?.name
        ? `<div class="mini-avatar" title="${task.assignedTo.name}">${getInitials(task.assignedTo.name)}</div>`
        : '';

    const isCompleted = task.status === 3;
    const role = localStorage.getItem('user_role') || 'User';
    // Admins, Sous-Admins and Chef de Projet can still access completed tasks
    const canEdit = ['Admin', 'Sous-Admin', 'Chef de Projet'].includes(role);

    // Lock if completed AND user is NOT privileged
    const isLocked = isCompleted && !canEdit;

    const clickAction = isLocked ? "event.stopPropagation(); showToast('Tâche terminée et verrouillée', 'info')" : `openTaskDetail(${task.id})`;

    return `
        <div class="task-card ${isLocked ? 'locked' : ''}" data-priority="${task.priority}" onclick="${clickAction}" style="${isCompleted ? 'opacity:0.75;' : ''}">
            <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem;">${task.title}</div>
            <div class="task-meta">
                <span>${task.project ? task.project.name : 'Sans projet'}</span>
                <span class="${isOverdue(task.deadline) ? 'text-danger' : ''}">${formatDateShort(task.deadline)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.8rem;">
                 <span class="badge" style="font-size:0.7rem; color:var(--text-muted);">${getPriorityLabel(task.priority)}</span>
                 <div style="display:flex; align-items:center; gap:5px;">
                     ${task.status !== 3 ? `<button class="btn icon-btn" onclick="event.stopPropagation(); updateTaskStatus(${task.id}, 3)" title="Marquer comme terminé" style="padding:2px; height:auto;">✅</button>` : ''}
                     <div class="task-members">${assignedName}</div>
                 </div>
            </div>
        </div>
    `;
}

// --------------------------------------------------------------------------
//                                DASHBOARD
// --------------------------------------------------------------------------
function updateDashboard() {
    const { projects, tasks, teams } = currentData;

    // Stats
    setText('total-projects', projects.length);
    setText('total-tasks', tasks.length);
    setText('completed-tasks', tasks.filter(t => t.status === 3 || t.status === 'Done').length);
    setText('total-teams', teams.length);

    // Deadlines
    const upcoming = tasks
        .filter(t => t.deadline && new Date(t.deadline) > new Date() && t.status !== 3)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
        .slice(0, 5);

    const dlContainer = document.getElementById('upcoming-deadlines');
    if (dlContainer) {
        if (upcoming.length === 0) dlContainer.innerHTML = '<p class="text-muted">Aucune échéance proche.</p>';
        else {
            dlContainer.innerHTML = upcoming.map(t => `
                <div class="deadline-item" onclick="openTaskDetail(${t.id})" style="cursor:pointer">
                    <div>
                        <div style="font-weight:500;">${t.title}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary);">${t.project ? t.project.name : ''}</div>
                    </div>
                    <div class="deadline-date">${formatDateShort(t.deadline)}</div>
                </div>
            `).join('');
        }
    }

    // Simple Progress bars by project
    const progContainer = document.getElementById('dashboard-progress-container');
    if (progContainer) {
        progContainer.innerHTML = projects.slice(0, 4).map(p => {
            const pTasks = tasks.filter(t => t.projectId === p.id);
            const total = pTasks.length;
            const done = pTasks.filter(t => t.status === 3).length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);

            return `
                <div style="margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem; font-size:0.9rem;">
                        <span>${p.name}</span>
                        <span>${pct}%</span>
                    </div>
                    <div style="height:8px; background:var(--border); border-radius:99px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background: rgb(var(--primary)); border-radius:99px;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}


// --------------------------------------------------------------------------
//                                CRUD & ACTIONS
// --------------------------------------------------------------------------

// Project
window.openProjectEdit = function (id) {
    const role = localStorage.getItem('user_role') || 'User';
    if (role !== 'Admin' && role !== 'Sous-Admin' && role !== 'Chef de Projet') {
        showToast("Vous n'avez pas l'autorisation de modifier ce projet.", "error");
        return;
    }
    const p = currentData.projects.find(x => x.id === id);
    if (!p) return;

    // Populate form
    document.getElementById('project-id').value = p.id;
    document.getElementById('project-name').value = p.name;
    document.getElementById('project-description').value = p.description || '';
    populateTeamSelect('project-team', p.teamId);
    document.getElementById('project-deadline').value = p.deadline ? p.deadline.slice(0, 16) : '';
    document.getElementById('project-status').value = p.status;

    document.getElementById('project-modal-title').innerText = 'Modifier le Projet';
    openModal('project-modal');
};

window.saveProject = async function (e) {
    e.preventDefault();
    const id = document.getElementById('project-id').value;
    const data = {
        id: id ? parseInt(id) : 0,
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        teamId: parseInt(document.getElementById('project-team').value),
        deadline: document.getElementById('project-deadline').value || null,
        status: parseInt(document.getElementById('project-status').value)
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/Projects/${id}` : `${API_BASE}/Projects`;

        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal('project-modal');
            showToast('Projet enregistré !');
            loadProjects();
        } else showToast('Erreur lors de la sauvegarde.', 'error');
    } catch (err) { console.error(err); }
}

window.deleteProject = async function (id) {
    if (!confirm('Supprimer ce projet ?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/Projects/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Projet supprimé');
            loadProjects();
        }
    } catch (err) { }
}

// Tasks
window.openTaskDetail = async function (id) {
    try {
        // Fetch full detail
        const res = await apiFetch(`${API_BASE}/Tasks/${id}`);
        const task = await res.json();

        const content = document.getElementById('task-detail-content');
        if (!content) return;

        content.innerHTML = `
            <div class="task-detail-container">
                <button class="modal-close-btn" data-action="close-modal" data-target="task-detail-modal">&times;</button>
                
                <div class="task-detail-header">
                    <div>
                        <h2 style="font-size:1.8rem; margin-bottom: 0.25rem;">${task.title}</h2>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="badge" style="background: rgba(var(--primary), 0.1); color: rgb(var(--primary));">
                                ${task.project ? task.project.name : 'Sans projet'}
                            </span>
                            <span class="text-muted" style="font-size: 0.85rem;">
                                Échéance: ${task.deadline ? formatDateShort(task.deadline) : 'Aucune'}
                            </span>
                        </div>
                    </div>
                    <div class="badge ${task.priority}" style="font-size: 0.9rem; padding: 0.5rem 1rem;">
                        ${getPriorityLabel(task.priority)}
                    </div>
                </div>
                
                <div class="task-detail-grid">
                    <div class="task-detail-main">
                         <div class="task-info-group">
                            <label>Description</label>
                            <p style="color:var(--text-secondary); line-height:1.7; font-size: 1rem;">
                                ${task.description || 'Aucune description fournie.'}
                            </p>
                         </div>
                         
                         <div class="comments-section" style="margin-top: 1rem;">
                            <h3>Commentaires</h3>
                            <div id="comments-list-${id}" class="comments-list" style="margin-bottom:1.5rem;">
                                Chargement...
                            </div>
                            
                            <div class="comment-input-area">
                                <input type="text" id="new-comment-${id}" placeholder="Ajouter un commentaire..." onkeypress="handleCommentKey(event, ${id})">
                                <button class="btn btn-primary btn-sm" onclick="postComment(${id})">Envoyer</button>
                            </div>
                         </div>
                    </div>
                    
                    <div class="task-detail-sidebar">
                        <div class="task-info-group">
                            <label>Statut de la tâche</label>
                            <div class="status-pill-group">
                                ${[0, 1, 2, 3].map(status => {
            const isActive = task.status === status;
            const userRole = localStorage.getItem('user_role');

            // ID-based check
            const currentMemberId = parseInt(localStorage.getItem('team_member_id'));
            const assignedId = task.assignedToId || task.AssignedToId;
            const isAssigneeById = currentMemberId && assignedId && currentMemberId === assignedId;

            // Email-based check (fallback)
            const storageEmail = localStorage.getItem('user_email') || localStorage.getItem('userEmail') || '';
            const userEmail = storageEmail.toLowerCase().trim();
            const assignedObj = task.assignedTo || task.AssignedTo || {};
            const assignedEmail = (assignedObj.email || assignedObj.Email || '').toLowerCase().trim();
            const isAssigneeByEmail = userEmail && assignedEmail && userEmail === assignedEmail;

            const isManager = ['Admin', 'Sous-Admin', 'Chef de Projet'].includes(userRole);
            const isAssignee = isAssigneeById || isAssigneeByEmail;

            const canEdit = isManager || isAssignee;
            const labels = ['À faire', 'En cours', 'En revue', 'Terminé'];

            // ALWAYS allow click to trigger the security check (and debug toast)
            const onClick = `onclick="updateStatusViaPill(${id}, ${status})"`;
            const readonlyClass = canEdit ? '' : 'readonly';

            if (isActive) console.log(`Perm check for task ${id}: user=${userEmail}, assigned=${assignedEmail}, canEdit=${canEdit}`);

            return `<div class="status-pill ${isActive ? 'active' : ''} ${readonlyClass}" data-status="${status}" ${onClick}>${labels[status]}</div>`;
        }).join('')}
                            </div>
                        </div>

                        <div class="task-info-group">
                            <label>Projet</label>
                            <div class="task-info-value">${task.project ? task.project.name : 'N/A'}</div>
                        </div>

                        <div class="task-info-group">
                            <label>Assigné à</label>
                            <div class="task-info-value" style="display: flex; align-items: center; gap: 8px;">
                                <div class="avatar" style="width: 24px; height: 24px; font-size: 0.7rem;">
                                    ${task.assignedTo ? getInitials(task.assignedTo.name) : '?'}
                                </div>
                                ${task.assignedTo ? task.assignedTo.name : 'Personne'}
                            </div>
                        </div>

                        <div style="margin-top: auto; padding-top: 2rem;">
                             ${['Admin', 'Sous-Admin', 'Chef de Projet'].includes(localStorage.getItem('user_role')) ?
                `<button class="btn btn-danger" style="width: 100%;" onclick="window.deleteTask(${id}); closeModal('task-detail-modal');">Supprimer la tâche</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        openModal('task-detail-modal');
        loadComments(id);

    } catch (e) { console.error(e); }
};

window.handleCommentKey = function (e, taskId) {
    if (e.key === 'Enter') postComment(taskId);
}

window.postComment = async function (taskId) {
    const input = document.getElementById(`new-comment-${taskId}`);
    const content = input.value.trim();
    if (!content) return;

    // Quick hack: First available member = author
    const authorId = currentData.members.length > 0 ? currentData.members[0].id : null;
    if (!authorId) return showToast('Créer d\'abord un membre pour commenter', 'error');

    try {
        const res = await apiFetch(`${API_BASE}/Comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, taskId, authorId })
        });
        if (res.ok) {
            input.value = '';
            loadComments(taskId);
        }
    } catch (e) { }
}

async function loadComments(taskId) {
    const container = document.getElementById(`comments-list-${taskId}`);
    try {
        const res = await apiFetch(`${API_BASE}/Comments/task/${taskId}`);
        const comments = await res.json();

        if (comments.length === 0) {
            container.innerHTML = '<span class="text-muted">Pas encore de commentaires.</span>';
            return;
        }

        container.innerHTML = comments.map(c => `
            <div style="background:var(--surface); padding:0.8rem; border-radius:0.5rem; margin-bottom:0.5rem; border:1px solid var(--border); position:relative; group;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.3rem;">
                    <strong>${c.author ? c.author.name : 'Inconnu'}</strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${formatDateShort(c.createdAt)}</span>
                        <button onclick="window.deleteComment(${c.id}, ${taskId})" style="background:none; border:none; color:rgb(var(--danger)); cursor:pointer; padding:2px; display:flex;" title="Supprimer">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
                <div style="word-break:break-all;">${c.content}</div>
            </div>
        `).join('');
    } catch (e) { }
}

window.deleteComment = async function (commentId, taskId) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/Comments/${commentId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Commentaire supprimé');
            loadComments(taskId);
        }
    } catch (e) { console.error(e); }
};

window.updateStatusViaPill = function (id, status) {
    const pills = document.querySelectorAll('.status-pill');
    pills.forEach(p => p.classList.remove('active'));

    const clickedPill = document.querySelector(`.status-pill[data-status="${status}"]`);
    if (clickedPill) clickedPill.classList.add('active');

    updateTaskStatus(id, status);
};

window.updateTaskStatus = async function (id, status) {
    try {
        const res = await apiFetch(`${API_BASE}/Tasks/${id}`);
        const task = await res.json();

        // Security check
        const userRole = localStorage.getItem('user_role');
        // ID-based check
        const currentMemberId = parseInt(localStorage.getItem('team_member_id'));
        const assignedId = task.assignedToId || task.AssignedToId;
        const isAssigneeById = currentMemberId && assignedId && currentMemberId === assignedId;

        const storageEmail = localStorage.getItem('user_email') || localStorage.getItem('userEmail') || '';
        const userEmail = storageEmail.toLowerCase().trim();
        const assignedObj = task.assignedTo || task.AssignedTo || {};
        const assignedEmail = (assignedObj.email || assignedObj.Email || '').toLowerCase().trim();
        const isAssigneeByEmail = userEmail && assignedEmail && userEmail === assignedEmail;

        const isManager = ['Admin', 'Sous-Admin', 'Chef de Projet'].includes(userRole);
        const isAssignee = isAssigneeById || isAssigneeByEmail;

        if (!isManager && !isAssignee) {
            console.log('--- PERMISSION DEBUG ---');
            console.log('User Role:', userRole);
            console.log('Member ID (Local):', currentMemberId);
            console.log('Task Assigned ID:', assignedId);
            console.log('ID Match:', isAssigneeById);
            console.log('User Email:', userEmail);
            console.log('Task Email:', assignedEmail);
            console.log('Email Match:', isAssigneeByEmail);

            showToast(`Action refusée. Debug: ID(${currentMemberId} vs ${assignedId}), Email(${userEmail} vs ${assignedEmail})`, "error");
            return;
        }

        task.status = parseInt(status);

        const putRes = await apiFetch(`${API_BASE}/Tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });

        if (putRes.ok) {
            showToast('Statut mis à jour');
            loadTasks(); // refresh board
        } else {
            showToast('Erreur lors de la mise à jour', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Une erreur est survenue', 'error');
    }
};

window.saveTask = async function (e) {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const data = {
        id: id ? parseInt(id) : 0,
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        projectId: parseInt(document.getElementById('task-project').value),
        assignedToId: document.getElementById('task-assigned').value ? parseInt(document.getElementById('task-assigned').value) : null,
        priority: parseInt(document.getElementById('task-priority').value),
        status: parseInt(document.getElementById('task-status').value),
        deadline: document.getElementById('task-deadline').value || null
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/Tasks/${id}` : `${API_BASE}/Tasks`;
        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('task-modal');
            showToast('Tâche enregistrée !');
            loadTasks();
        }
    } catch (e) { }
}

window.deleteTask = async function (id) {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/Tasks/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Tâche supprimée');
            loadTasks();
        }
    } catch (e) { }
}

// Teams
window.saveTeam = async function (e) {
    e.preventDefault();
    const id = document.getElementById('team-id').value;
    const data = {
        id: id ? parseInt(id) : 0,
        name: document.getElementById('team-name').value,
        description: document.getElementById('team-description').value
    };
    // ... similar save logic ...
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/Teams/${id}` : `${API_BASE}/Teams`;
        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            closeModal('team-modal');
            showToast('Équipe enregistrée !');
            loadTeams();
        }
    } catch (e) { }
}

window.deleteTeam = async function (id) {
    if (!confirm('Supprimer cette équipe ?')) return;
    try {
        await apiFetch(`${API_BASE}/Teams/${id}`, { method: 'DELETE' });
        showToast('Équipe supprimée');
        loadTeams();
    } catch (e) { }
}

// Members
function setupMemberModalLogic() {
    const roleSelect = document.getElementById('member-system-role');
    if (roleSelect) {
        roleSelect.addEventListener('change', toggleMemberTeamField);
    }
}

function toggleMemberTeamField() {
    const roleSelect = document.getElementById('member-system-role');
    const teamSelect = document.getElementById('member-team');

    // Find the container form-group to hide
    if (!roleSelect || !teamSelect) return;
    const teamGroup = teamSelect.closest('.form-group');
    if (!teamGroup) return;

    if (roleSelect.value === 'Sous-Admin') {
        teamGroup.style.display = 'none';
        teamSelect.removeAttribute('required');
        teamSelect.value = ''; // Clear value
    } else {
        teamGroup.style.display = '';
        teamSelect.setAttribute('required', 'true');
    }
}

window.toggleRoleBadges = function () {
    const roleSelect = document.getElementById('member-system-role');
    const chefContainer = document.getElementById('chef-de-groupe-container');
    const supContainer = document.getElementById('superviseur-container');

    if (!roleSelect) return;

    // Reset both
    if (chefContainer) {
        chefContainer.style.display = 'none';
        document.getElementById('member-is-chef-groupe').checked = false;
    }
    if (supContainer) {
        supContainer.style.display = 'none';
        document.getElementById('member-is-superviseur').checked = false;
    }

    if (roleSelect.value === 'Chef de Projet' && chefContainer) {
        chefContainer.style.display = 'block';
    } else if (roleSelect.value === 'Sous-Admin' && supContainer) {
        supContainer.style.display = 'block';
    }
}

window.openMemberEdit = async function (id) {
    try {
        // Use loose equality to handle string/number conversion
        const m = currentData.members.find(x => x.id == id);
        populateTeamSelect('member-team', m ? m.teamId : null);

        if (m) {
            document.getElementById('member-id').value = m.id;
            document.getElementById('member-name').value = m.name;
            document.getElementById('member-email').value = m.email;
            document.getElementById('member-modal-title').innerText = 'Modifier le Membre';
            document.getElementById('member-is-chef-groupe').checked = m.role === 'Chef de groupe';
            document.getElementById('member-is-superviseur').checked = m.role === 'Superviseur';

            // Load system role
            try {
                const res = await apiFetch(`${API_BASE}/Auth/GetUserRole/${encodeURIComponent(m.email)}`);
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('member-system-role').value = data.role || 'User';
                }
            } catch (e) {
                console.error('Error loading system role:', e);
                document.getElementById('member-system-role').value = 'User';
            }
        } else {
            document.getElementById('member-form').reset();
            document.getElementById('member-id').value = '';
            document.getElementById('member-system-role').value = 'User';
            document.getElementById('member-is-chef-groupe').checked = false;
            document.getElementById('member-is-superviseur').checked = false;
            document.getElementById('member-modal-title').innerText = 'Nouveau Membre';
        }

        // Set initial state of team field based on loaded role
        toggleMemberTeamField();
        toggleRoleBadges();
        // Restore checkbox state if it was cleared by toggleRoleBadges but needs to be checked
        if (m) {
            if (m.role === 'Chef de groupe') {
                const chefBox = document.getElementById('member-is-chef-groupe');
                if (chefBox && chefBox.closest('.form-group').style.display !== 'none') chefBox.checked = true;
            }
            if (m.role === 'Superviseur') {
                const supBox = document.getElementById('member-is-superviseur');
                if (supBox && supBox.closest('.form-group').style.display !== 'none') supBox.checked = true;
            }
        }

        openModal('member-modal');
    } catch (error) {
        console.error("Error opening member edit modal:", error);
        showToast("Erreur lors de l'ouverture du membre", "error");
    }
};

window.saveMember = async function (e) {
    e.preventDefault();
    const id = document.getElementById('member-id').value;
    const teamVal = document.getElementById('member-team').value;

    // Determine role based on checkbox (dependent on system role)
    const systemRole = document.getElementById('member-system-role').value;
    const isChefGroupe = document.getElementById('member-is-chef-groupe').checked;
    const isSuperviseur = document.getElementById('member-is-superviseur').checked;

    let memberRole = "Collaborateur";
    if (systemRole === 'Chef de Projet' && isChefGroupe) {
        memberRole = "Chef de groupe";
    } else if (systemRole === 'Sous-Admin' && isSuperviseur) {
        memberRole = "Superviseur";
    }

    const data = {
        id: id ? parseInt(id) : 0,
        name: document.getElementById('member-name').value,
        email: document.getElementById('member-email').value,
        role: memberRole,
        teamId: teamVal ? parseInt(teamVal) : null
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/TeamMembers/${id}` : `${API_BASE}/TeamMembers`;

        const res = await apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            // Update system role if editing existing member
            if (id) {
                const systemRole = document.getElementById('member-system-role').value;
                const roleRes = await apiFetch(`${API_BASE}/Auth/UpdateUserRole`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: data.email, newRole: systemRole })
                });

                if (!roleRes.ok) {
                    console.error('Failed to update system role');
                }
            }

            closeModal('member-modal');
            showToast('Membre enregistré !');
            await loadMembers();
            await displayMembers();
        } else {
            showToast('Erreur lors de la sauvegarde.', 'error');
        }
    } catch (err) { console.error(err); }
};

window.deleteMember = async function (id) {
    if (!confirm('Supprimer ce membre ?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/TeamMembers/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Membre supprimé');
            loadMembers();
        } else {
            let message = 'Erreur lors de la suppression';
            try {
                const data = await res.json();
                if (data && data.message) message = data.message;
            } catch (e) {
                // If not JSON, use status text
                if (res.statusText) message += ` (${res.status} ${res.statusText})`;
                else message += ` (${res.status})`;
            }
            showToast(message, 'error');
        }
    } catch (err) {
        showToast('Erreur réseau', 'error');
    }
};


// --------------------------------------------------------------------------
//                                  HELPERS
// --------------------------------------------------------------------------
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.display = 'block';
        // Trigger opacity transition
        requestAnimationFrame(() => m.style.opacity = '1');
    }
}
function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.style.opacity = '0';
        setTimeout(() => m.style.display = 'none', 300);
    }
}

// Global Click handling for buttons
document.addEventListener('click', e => {
    // Modal close
    if (e.target.dataset.action === 'close-modal') {
        closeModal(e.target.dataset.target);
    }
    // Modal Backdrop
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
    // New buttons
    if (e.target.closest('[data-action="new-project"]')) {
        window.openProjectModal(); // Call with no ID for new project
    }
    if (e.target.closest('[data-action="new-task"]')) {
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-modal-title').innerText = 'Nouvelle Tâche';
        populateProjectSelect('task-project');
        populateMemberSelect('task-assigned');
        openModal('task-modal');
    }
    if (e.target.closest('[data-action="new-team"]')) {
        document.getElementById('team-form').reset();
        document.getElementById('team-id').value = '';
        document.getElementById('team-modal-title').innerText = 'Nouvelle Équipe';
        openModal('team-modal');
    }
});


function populateProjectSelect(id) {
    const s = document.getElementById(id);
    s.innerHTML = '<option value="">Choisir un Projet...</option>' +
        currentData.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Attach logic for task-project
    if (id === 'task-project') {
        s.onchange = function () {
            const projectId = parseInt(this.value);
            const project = currentData.projects.find(p => p.id === projectId);
            if (project && project.teamId) {
                populateMemberSelect('task-assigned', project.teamId);
            } else {
                populateMemberSelect('task-assigned');
            }
        };
    }
}
function populateTeamSelect(id, selected = null) {
    const s = document.getElementById(id);
    s.innerHTML = '<option value="">Choisir une Équipe...</option>' +
        currentData.teams.map(t => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${t.name}</option>`).join('');
}
function populateMemberSelect(id, filterTeamId = null) {
    const s = document.getElementById(id);
    let members = currentData.members;

    // Filter if teamId is provided
    if (filterTeamId) {
        members = members.filter(m => m.teamId === filterTeamId);
    }

    s.innerHTML = '<option value="">Non assigné</option>' +
        members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}
function populateProjectSelects() {
    const selectors = ['task-filter-project', 'calendar-filter-project', 'task-project'];
    selectors.forEach(id => {
        const s = document.getElementById(id);
        if (s) {
            const currentVal = s.value;
            const isFilter = id.includes('filter');
            s.innerHTML = (isFilter ? '<option value="">Tous les projets</option>' : '<option value="">Choisir un Projet...</option>') +
                currentData.projects.map(p => `<option value="${p.id}" ${p.id == currentVal ? 'selected' : ''}>${p.name}</option>`).join('');
        }
    });
}

window.openTaskModal = function (taskId) {
    if (taskId) {
        window.openTaskDetail(taskId);
    }
}

window.openProjectModal = function (projectId) {
    if (projectId) {
        window.openProjectEdit(projectId);
    } else {
        // New Project
        document.getElementById('project-form').reset();
        document.getElementById('project-id').value = '';
        document.getElementById('project-modal-title').innerText = 'Nouveau Projet';
        populateTeamSelect('project-team');
        openModal('project-modal');
    }
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}
function setText(id, txt) {
    const e = document.getElementById(id);
    if (e) e.textContent = txt;
}
function formatDate(d) {
    if (!d) return '--';
    return new Date(d).toLocaleDateString();
}
function formatDateShort(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function isOverdue(d) {
    if (!d) return false;
    return new Date(d) < new Date();
}

function getStatusLabel(s) {
    const map = ['Non commencé', 'En cours', 'En attente', 'Terminé', 'Annulé'];
    return map[s] || s;
}
function getPriorityLabel(p) {
    const map = ['Basse', 'Moyenne', 'Haute', 'Critique'];
    return map[p] || p;
}





// --------------------------------------------------------------------------
//                                EMOJI PICKER
// --------------------------------------------------------------------------
function setupEmojiPicker() {
    const emojiBtn = document.getElementById('emoji-btn');
    const picker = document.getElementById('emoji-picker');
    const chatInput = document.getElementById('chat-input');

    if (!emojiBtn || !picker || !chatInput) return;

    const emojis = [
        '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '✨'
    ];

    // Populate picker
    picker.innerHTML = emojis.map(e => `<span class="emoji-item">${e}</span>`).join('');

    // Toggle picker
    emojiBtn.addEventListener('click', (e) => {
        // Only toggle if clicking the button/icon itself, not inside picker
        if (e.target.closest('.emoji-picker')) return;
        picker.hidden = !picker.hidden;
        e.stopPropagation();
    });

    // Pick emoji
    picker.addEventListener('click', (e) => {
        const emoji = e.target.closest('.emoji-item');
        if (!emoji) return;

        const text = emoji.textContent;
        const start = chatInput.selectionStart;
        const end = chatInput.selectionEnd;
        const val = chatInput.value;

        chatInput.value = val.substring(0, start) + text + val.substring(end);

        // Move cursor after emoji
        chatInput.focus();
        const newPos = start + text.length;
        chatInput.setSelectionRange(newPos, newPos);

        // Don't hide picker if child of button handles it
        // picker.hidden = true; 
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target)) {
            picker.hidden = true;
        }
    });
}

// --------------------------------------------------------------------------
//                                ACTIVITY LOGS
// --------------------------------------------------------------------------
window.loadLogs = async function () {
    const list = document.getElementById('logs-list');
    if (!list) return;

    try {
        const res = await apiFetch(`${API_BASE}/Logs`);
        if (!res.ok) {
            list.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement des logs.</p></div>';
            return;
        }

        const logs = await res.json();
        displayLogs(logs);
    } catch (e) {
        console.error(e);
        list.innerHTML = '<div class="empty-state"><p>Erreur réseau lors du chargement des logs.</p></div>';
    }
}

function displayLogs(logs) {
    const list = document.getElementById('logs-list');
    if (!list) return;

    if (logs.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📜</div>
                <p>Aucune activité enregistrée pour le moment.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const formattedDate = date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Determine icon based on action
        let icon = '📝';
        if (log.action.includes('Projet')) icon = '📁';
        if (log.action.includes('Tâche')) icon = '✅';
        if (log.action.includes('Suppression')) icon = '🗑️';
        if (log.action.includes('Création')) icon = '➕';
        if (log.action.includes('Changement de statut')) icon = '🔄';
        if (log.action.includes('Équipe')) icon = '👥';
        if (log.action.includes('Membre')) icon = '👤';
        if (log.action.includes('Commentaire')) icon = '💬';
        if (log.action.includes('Message')) icon = '💬';
        if (log.action.includes('Profil')) icon = '👤';
        if (log.action.includes('Rôle')) icon = '🔐';

        return `
            <div class="log-item">
                <div class="log-icon">${icon}</div>
                <div class="log-content">
                    <div class="log-header">
                        <span class="log-action">${log.action}</span>
                        <span class="log-time">${formattedDate}</span>
                    </div>
                    <div class="log-details">${log.details}</div>
                    <div class="log-user">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" 
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Par ${log.userName || log.userEmail}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.clearLogs = async function () {
    if (!confirm('Voulez-vous vraiment effacer tout le journal des activités ?')) return;

    try {
        const res = await apiFetch(`${API_BASE}/Logs/clear`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Journal effacé');
            loadLogs();
        } else {
            showToast('Erreur lors de la suppression', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Erreur réseau', 'error');
    }
}

