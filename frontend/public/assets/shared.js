const API_BASE = 'http://localhost:3001/api';

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');

  const icons = document.querySelectorAll('.theme-icon');
  const isDark = document.documentElement.classList.contains('dark');

  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  icons.forEach((icon) => {
    icon.textContent = isDark ? '☀️' : '🌙';
  });
}

function applyTheme() {
  if (
    localStorage.getItem('theme') === 'dark' ||
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  }

  const icons = document.querySelectorAll('.theme-icon');
  const isDark = document.documentElement.classList.contains('dark');
  icons.forEach((icon) => {
    icon.textContent = isDark ? '☀️' : '🌙';
  });
}

function toggleMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function showLogoutModal(callback) {
  const modal = document.getElementById('logoutModal');
  const confirmButton = document.getElementById('logoutConfirm');
  const cancelButton = document.getElementById('logoutCancel');

  if (!modal || !confirmButton || !cancelButton) {
    callback(false);
    return;
  }

  modal.classList.remove('hidden');

  const onConfirm = () => {
    modal.classList.add('hidden');
    confirmButton.removeEventListener('click', onConfirm);
    cancelButton.removeEventListener('click', onCancel);
    callback(true);
  };

  const onCancel = () => {
    modal.classList.add('hidden');
    confirmButton.removeEventListener('click', onConfirm);
    cancelButton.removeEventListener('click', onCancel);
    callback(false);
  };

  confirmButton.addEventListener('click', onConfirm);
  cancelButton.addEventListener('click', onCancel);
}

function bindLoginButton() {
  const username = localStorage.getItem('usuario');
  const loginButton = document.getElementById('btnLogin');
  const loginButtonMobile = document.getElementById('btnLoginMobile');

  const updateButton = (button) => {
    if (!button) {
      return;
    }

    if (username) {
      button.textContent = username.charAt(0).toUpperCase();
      button.href = '#';
      button.classList.add('cursor-pointer');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        showLogoutModal((confirmed) => {
          if (confirmed) {
            localStorage.removeItem('usuario');
            window.location.href = '/pages/home/index.html';
          }
        });
      });
      return;
    }

    button.textContent = 'Login';
    button.href = '/pages/auth/login.html';
  };

  updateButton(loginButton);
  updateButton(loginButtonMobile);
}

function readJson(url, options = {}) {
  return fetch(`${API_BASE}${url}`, options).then(async (response) => {
    const payload = await response.text();

    if (!response.ok) {
      throw new Error(payload || 'Erro na requisição');
    }

    return payload ? JSON.parse(payload) : null;
  });
}

function setPageTitle(title) {
  document.title = title;
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  bindLoginButton();
});
