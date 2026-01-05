const API_AUTH = '/api/Auth';

document.addEventListener('DOMContentLoaded', () => {
  // Basic toast function for auth pages
  window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = type === 'success'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    toast.innerHTML = `${icon}<span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };
});


async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const originalText = btn.innerText;

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const codeInput = document.getElementById('2fa-code');
  const twoFactorGroup = document.getElementById('2fa-group');

  const isTwoFactorStage = twoFactorGroup.style.display !== 'none';
  const code = codeInput ? codeInput.value : '';

  btn.innerText = isTwoFactorStage ? "Vérification..." : "Connexion...";
  btn.disabled = true;

  try {
    const url = isTwoFactorStage ? `${API_AUTH}/2fa-login` : `${API_AUTH}/login`;
    const body = isTwoFactorStage
      ? { userName: username, password, code }
      : { userName: username, password };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();

      if (data.requiresTwoFactor) {
        twoFactorGroup.style.display = 'block';
        codeInput.required = true;
        codeInput.focus();
        showToast('Code 2FA requis', 'info');
        btn.innerText = "Valider le code";
        btn.disabled = false;
        return;
      }

      localStorage.setItem('token', data.token);
      const user = data.user || {};
      const displayName = user.fullName || user.userName || username;
      localStorage.setItem('user_name', displayName);
      localStorage.setItem('user_email', user.email || '');
      localStorage.setItem('user_initials', displayName.substring(0, 2).toUpperCase());
      localStorage.setItem('user_role', user.role || 'User');
      localStorage.setItem('user_id', user.id || '');
      localStorage.setItem('team_member_id', user.teamMemberId || '');

      showToast('Connexion réussie ! Redirection...');
      setTimeout(() => window.location.href = 'app.html', 1000);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.message || 'Identifiants ou code incorrects', 'error');
      btn.innerText = originalText;
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Erreur serveur', 'error');
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.innerText = "Création...";
  btn.disabled = true;

  const fullName = document.getElementById('fullname').value;
  const userName = document.getElementById('reg-username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch(`${API_AUTH}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, email, password, fullName })
    });

    if (res.ok) {
      showToast('Compte créé ! Connectez-vous.');
      setTimeout(() => window.location.href = 'login.html', 1500);
    } else {
      const errs = await res.json();
      // Try to extract first error description
      let msg = 'Erreur inscription';
      if (Array.isArray(errs) && errs.length > 0) msg = errs[0].description;
      showToast(msg, 'error');
      btn.innerText = originalText;
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Erreur serveur', 'error');
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_email');
  localStorage.removeItem('user_initials');
  localStorage.removeItem('team_member_id');
  window.location.href = 'index.html';
}

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'index.html';
  }
}
