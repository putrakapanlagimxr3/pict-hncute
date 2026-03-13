const ThemeManager = {
    init: () => {
        const stored = localStorage.getItem('theme') || 'system';
        ThemeManager.setTheme(stored, false);
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (localStorage.getItem('theme') === 'system') {
                ThemeManager.apply(e.matches ? 'dark' : 'light');
            }
        });
    },

    setTheme: (mode, save = true) => {
        if (save) localStorage.setItem('theme', mode);
        
        if (mode === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            ThemeManager.apply(isDark ? 'dark' : 'light');
        } else {
            ThemeManager.apply(mode);
        }
        
        ThemeManager.updateUI(mode);
    },

    apply: (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    },

    updateUI: (mode) => {
        const btns = document.querySelectorAll('.theme-btn');
        btns.forEach(btn => {
            if (btn.dataset.theme === mode) {
                btn.classList.add('active-theme');
            } else {
                btn.classList.remove('active-theme');
            }
        });
        
        const selects = document.querySelectorAll('.theme-select');
        selects.forEach(sel => sel.value = mode);
    },
    
    getTheme: () => {
        return localStorage.getItem('theme') || 'system';
    }
};

ThemeManager.init();