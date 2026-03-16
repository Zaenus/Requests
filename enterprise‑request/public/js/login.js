// Admin login page.
// Reads the optional `returnTo` query parameter and redirects there
// after a successful login (defaults to /adm).
(function () {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn      = document.getElementById('login-btn');
    const errorBox      = document.getElementById('login-error');

    function getReturnTo() {
        const params = new URLSearchParams(window.location.search);
        const returnTo = params.get('returnTo');
        // Only allow relative paths to prevent open-redirect attacks.
        if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
            return returnTo;
        }
        return '/adm';
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }

    async function doLogin() {
        hideError();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Please enter your username and password.');
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in…';

        try {
            const res = await fetch('/api/authentication/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                showError(data.error || 'Login failed. Please try again.');
                return;
            }
            // The server sets an HttpOnly cookie — redirect to the original page.
            window.location.href = getReturnTo();
        } catch {
            showError('Unable to connect. Please try again.');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }

    loginBtn.addEventListener('click', doLogin);

    // Allow submitting the form by pressing Enter.
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') doLogin();
        });
    });
}());
