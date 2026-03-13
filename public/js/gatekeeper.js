(function() {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    const userRole = sessionStorage.getItem('userRole') || localStorage.getItem('userRole');
    const userDataStr = sessionStorage.getItem('userData') || localStorage.getItem('userData');

    const publicPages = ['login.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (!token && !publicPages.includes(currentPage)) {
        window.location.href = 'login.html?next=' + encodeURIComponent(currentPage);
    }

    if (token && publicPages.includes(currentPage)) {
        window.location.href = 'index.html';
    }

    window.Auth = {
        getToken: () => token,
        getRole: () => userRole,
        getUser: () => JSON.parse(userDataStr || '{}'),
        logout: () => {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'login.html';
        },
        requireAdmin: () => {
            if (userRole !== 'admin') {
                window.location.href = 'template-selection.html';
            }
        }
    };
})();