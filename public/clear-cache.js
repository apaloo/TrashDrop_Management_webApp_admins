console.clear(); localStorage.clear(); sessionStorage.clear(); caches?.keys().then(keys => keys.forEach(key => caches.delete(key)));
