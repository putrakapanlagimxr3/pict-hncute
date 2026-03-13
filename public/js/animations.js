window.GSAPManager = {
    initButtons: () => {
        const buttons = document.querySelectorAll('button, a.btn, .filter-btn');
        
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if(btn.disabled) return;
                gsap.to(btn, { scale: 1.05, duration: 0.2, ease: "power1.out" });
            });
            btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { scale: 1, duration: 0.2, ease: "power1.out" });
            });
            
            btn.addEventListener('mousedown', () => {
                if(btn.disabled) return;
                gsap.to(btn, { scale: 0.95, duration: 0.1, ease: "power1.out" });
            });
            btn.addEventListener('mouseup', () => {
                if(btn.disabled) return;
                gsap.to(btn, { scale: 1.05, duration: 0.1, ease: "power1.out" });
            });
        });
    },

    openModal: (modalEl) => {
        if (!modalEl) return;
        modalEl.classList.remove('hidden');
        modalEl.classList.add('flex');
        
        const content = modalEl.querySelector('.modal-content') || modalEl.firstElementChild;
        if (content) {
            gsap.set(content, { scale: 0.8, opacity: 0 });
            gsap.to(content, { 
                scale: 1, 
                opacity: 1, 
                duration: 0.4, 
                ease: "back.out(1.7)" 
            });
        }
    },

    closeModal: (modalEl) => {
        if (!modalEl) return;
        const content = modalEl.querySelector('.modal-content') || modalEl.firstElementChild;
        if (content) {
            gsap.to(content, {
                scale: 0.8,
                opacity: 0,
                duration: 0.2,
                ease: "power2.in",
                onComplete: () => {
                    modalEl.classList.add('hidden');
                    modalEl.classList.remove('flex');
                }
            });
        } else {
            modalEl.classList.add('hidden');
            modalEl.classList.remove('flex');
        }
    },

    showToast: (toastEl, message) => {
        if (!toastEl) return;
        
        const msgEl = toastEl.querySelector('#toast-msg') || toastEl.querySelector('#toast-message');
        if (message && msgEl) msgEl.textContent = message;

        const isEditStyle = toastEl.classList.contains('-translate-x-1/2');
        
        if (isEditStyle) {
            gsap.to(toastEl, { y: '0%', duration: 0.5, ease: "elastic.out(1, 0.75)" });
            setTimeout(() => {
                gsap.to(toastEl, { y: '-150%', duration: 0.3, ease: "power2.in" });
            }, 3000);
        } else {
            gsap.to(toastEl, { x: '0%', duration: 0.5, ease: "elastic.out(1, 0.75)" });
            setTimeout(() => {
                gsap.to(toastEl, { x: '150%', duration: 0.3, ease: "power2.in" });
            }, 3000);
        }
    },

    animateCountdown: (element, number) => {
        if (!element) return;
        element.textContent = number;
        
        gsap.fromTo(element, 
            { scale: 0.5, opacity: 0, rotation: -30 }, 
            { scale: 1.2, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }
        );
        gsap.to(element, { scale: 1, duration: 0.2, delay: 0.4 });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        window.GSAPManager.initButtons();
    });
});