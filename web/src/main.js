import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

// Manage dynamic viewport height for mobile keyboards & safe areas
function setupViewportManager() {
  const updateViewport = () => {
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    
    // Set CSS variable for dynamic app height
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
    
    // Detect if virtual keyboard is likely open (height reduction > 100px)
    const isKeyboardOpen = (window.innerHeight - height) > 100;
    document.documentElement.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewport);
    window.visualViewport.addEventListener('scroll', () => {
      // Prevent iOS visual viewport scroll offset from drifting the document
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
        window.scrollTo(0, 0);
      }
    });
  }

  window.addEventListener('resize', updateViewport);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateViewport, 150);
  });

  // Initial calculation
  updateViewport();
}

setupViewportManager();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

// Register Service Worker for offline PWA caching if supported in standard browsers.
// Inside the native Android WebView, assets are already cached/served locally via flash storage.
const isNativeApp = navigator.userAgent.includes('SimpleListsApp');
if (isNativeApp && 'serviceWorker' in navigator) {
  // If previously registered in WebView, unregister to avoid stale cache conflicting with native dynamic disk bundle
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
} else if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.log('PWA Service Worker registration skipped or failed:', err);
      });
  });
}
