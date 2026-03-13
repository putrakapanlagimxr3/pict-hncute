document.addEventListener('DOMContentLoaded', () => {
    if (typeof gsap !== 'undefined') {
        
        gsap.fromTo(document.body, 
            { opacity: 0, scale: 0.98 }, 
            { duration: 0.6, opacity: 1, scale: 1, ease: "power2.out", clearProps: "all" }
        );

        window.smoothNavigate = (url) => {
            gsap.to(document.body, {
                duration: 0.5,
                opacity: 0,
                scale: 0.98,
                ease: "power2.in",
                onComplete: () => {
                    window.location.href = url;
                }
            });
        };
        
        const links = document.querySelectorAll('a.transition-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (link.target === '_blank' || href.startsWith('#') || href === '') return;
                e.preventDefault();
                window.smoothNavigate(href);
            });
        });

    } else {
        console.warn("GSAP not found. Fallback to standard navigation.");
        window.smoothNavigate = (url) => window.location.href = url;
    }
});