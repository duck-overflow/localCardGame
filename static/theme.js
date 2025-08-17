(function(){
    const root = document.documentElement;
    function apply(val) {
        if (val === 'dark' || !val) {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', val);
        }
    }
    const stored = localStorage.getItem('theme') || 'dark';
    apply(stored);
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
            apply(e.newValue || 'dark');
        }
    });
    window.addEventListener('theme:apply', (e) => {
        const val = (e.detail && e.detail.value) || localStorage.getItem('theme') || 'dark';
        apply(val);
    });
})();
