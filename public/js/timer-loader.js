window.TimerConfig = {
    async load() {
        try {
            const res = await fetch('/api/timers');
            if (!res.ok) throw new Error("Failed to load timers");
            const config = await res.json();
            sessionStorage.setItem('timerConfig', JSON.stringify(config));
            return config;
        } catch (e) {
            console.warn("Timer load failed, using defaults", e);
            return { template: 100, booth: 220, edit: 100 };
        }
    },
    get() {
        try {
            const stored = sessionStorage.getItem('timerConfig');
            return stored ? JSON.parse(stored) : { template: 100, booth: 220, edit: 100 };
        } catch (e) { return { template: 100, booth: 220, edit: 100 }; }
    }
};