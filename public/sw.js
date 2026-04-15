// Enhanced Service Worker for SpeechFlow PWA
const CACHE_NAME = 'speechflow-v2';
const API_CACHE_NAME = 'speechflow-api-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/src/index.html',
  '/src/styles/main.css',
  '/src/scripts/main.js',
  '/src/scripts/storage.js',
  '/public/manifest.json'
];

const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

function shouldHandleRequest(request) {
  return true;
}

function getCacheStrategy(request) {
  if (request.url.includes('/api/') || request.url.includes('sarvam.ai')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  if (request.destination === 'document') {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  return CACHE_STRATEGIES.CACHE_FIRST;
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return new Response('Content not available offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    if (request.destination === 'document') {
      return caches.match('/src/index.html');
    }
    
    return new Response('Offline - content not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      const cache = caches.open(CACHE_NAME);
      cache.then(c => c.put(request, networkResponse.clone()));
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
}

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell:', CACHE_NAME);
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('App shell cached');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Failed to cache app shell:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (!shouldHandleRequest(request)) {
    return;
  }
  
  const strategy = getCacheStrategy(request);
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      event.respondWith(cacheFirstStrategy(request));
      break;
    case CACHE_STRATEGIES.NETWORK_FIRST:
      event.respondWith(networkFirstStrategy(request));
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      event.respondWith(staleWhileRevalidateStrategy(request));
      break;
    default:
      event.respondWith(networkFirstStrategy(request));
  }
});

self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(handleOfflineSync());
  }
  
  if (event.tag === 'sync-history') {
    event.waitUntil(syncHistoryData());
  }
});

async function handleOfflineSync() {
  console.log('Processing offline operations...');
  
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['offlineQueue'], 'readwrite');
    const store = transaction.objectStore('offlineQueue');
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const items = request.result;
      
      for (const item of items) {
        try {
          await processOfflineItem(item);
          await removeQueueItem(item.id);
        } catch (error) {
          console.error('Failed to sync item:', item.id, error);
          await updateQueueItemStatus(item.id, 'failed');
        }
      }
      
      notifyClients({ type: 'SYNC_COMPLETE', count: items.length });
    };
  } catch (error) {
    console.error('Offline sync failed:', error);
  }
}

async function processOfflineItem(item) {
  const { operation, payload } = item;
  
  switch (operation) {
    case 'save-document':
      return saveDocumentToServer(payload);
    case 'save-history':
      return saveHistoryToServer(payload);
    case 'upload-file':
      return uploadFileToServer(payload);
    default:
      console.warn('Unknown operation:', operation);
  }
}

async function saveDocumentToServer(payload) {
  console.log('Saving document to server:', payload);
}

async function saveHistoryToServer(payload) {
  console.log('Saving history to server:', payload);
}

async function uploadFileToServer(payload) {
  console.log('Uploading file to server:', payload);
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SpeechFlowDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removeQueueItem(id) {
  const db = await openDatabase();
  const transaction = db.transaction(['offlineQueue'], 'readwrite');
  const store = transaction.objectStore('offlineQueue');
  store.delete(id);
}

async function updateQueueItemStatus(id, status) {
  const db = await openDatabase();
  const transaction = db.transaction(['offlineQueue'], 'readwrite');
  const store = transaction.objectStore('offlineQueue');
  
  const getRequest = store.get(id);
  getRequest.onsuccess = () => {
    const item = getRequest.result;
    if (item) {
      item.status = status;
      item.updatedAt = new Date();
      store.put(item);
    }
  };
}

async function syncHistoryData() {
  console.log('Syncing history data...');
  notifyClients({ type: 'HISTORY_SYNC' });
}

function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'CACHE_URLS':
      cacheUrls(data.urls);
      break;
    case 'CLEAR_CACHE':
      clearAllCaches();
      break;
    case 'GET_CACHED_URLS':
      getCachedUrls().then(urls => {
        event.ports[0].postMessage({ urls });
      });
      break;
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.error('Failed to cache URL:', url, error);
    }
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('All caches cleared');
}

async function getCachedUrls() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  return requests.map(request => request.url);
}

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body || 'New notification',
        icon: data.icon || '/src/assets/icons/icon-192x192.png',
        badge: data.badge || '/src/assets/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: data.id || '1'
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'SpeechFlow', options)
      );
    } catch (error) {
      console.error('Push notification error:', error);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
  );
});

self.addEventListener('controllerchange', (event) => {
  console.log('Service Worker controller changed');
  window.location.reload();
});
