const CACHE_NAME = 'jyd-app-v1.0.0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次
let lastVersionCheck = 0;
let currentAppVersion = '';

const BASE_URL = location.pathname.substring(0, location.pathname.length - 12);
const DATE_FILE_URL = BASE_URL + 'static/date';
const urlsToCache = [
	BASE_URL,
	BASE_URL + 'index.html',
	BASE_URL + 'static/manifest.json',
	BASE_URL + 'static/sw.js',
	DATE_FILE_URL, // 缓存date文件用于版本检查
];

// 获取当前应用版本（从date文件）
async function getCurrentVersion() {
	try {
		const response = await fetch(DATE_FILE_URL + '?t=' + Date.now());
		if (response.ok) {
			return await response.text();
		}
	} catch (error) {
		console.log('Failed to fetch version:', error);
	}
	return '';
}

// 检查是否有新版本
async function checkForUpdate(last, force) {
	const now = Date.now();

	// 避免过于频繁的检查
	if (now - lastVersionCheck < VERSION_CHECK_INTERVAL && !force) {
		return false;
	}

	lastVersionCheck = now;

	try {
		const newVersion = last || await getCurrentVersion();
		if (newVersion && newVersion !== currentAppVersion) {
			console.log('New version detected:', newVersion, 'Old version:', currentAppVersion);
			return true;
		}
	} catch (error) {
		console.log('Version check failed:', error);
	}

	return false;
}

// 更新缓存
async function updateCache() {
	try {
		// 删除旧缓存
		const cacheNames = await caches.keys();
		await Promise.all(
			cacheNames.map(cacheName => {
				if (cacheName !== CACHE_NAME) {
					console.log('Deleting old cache:', cacheName);
					return caches.delete(cacheName);
				}
			})
		);

		// 创建新缓存
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(urlsToCache);

		// 更新当前版本
		currentAppVersion = await getCurrentVersion();
		console.log('Cache updated successfully. Version:', currentAppVersion);

		// 通知所有客户端有新版本
		const clients = await self.clients.matchAll();
		clients.forEach(client => {
			client.postMessage({
				type: 'NEW_VERSION_AVAILABLE',
				version: currentAppVersion
			});
		});

		return true;
	} catch (error) {
		console.log('Cache update failed:', error);
		return false;
	}
}

// 安装Service Worker
self.addEventListener('install', event => {
	console.log('Service Worker installing...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => {
				console.log('Opened cache');
				return cache.addAll(urlsToCache);
			})
			.then(() => {
				// 立即激活新的Service Worker
				return self.skipWaiting();
			})
	);
});

// 激活Service Worker
self.addEventListener('activate', event => {
	console.log('Service Worker activating...');
	event.waitUntil(
		Promise.all([
			// 清理旧缓存
			caches.keys().then(cacheNames => {
				return Promise.all(
					cacheNames.map(cacheName => {
						if (cacheName !== CACHE_NAME) {
							console.log('Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						}
					})
				);
			}),
			// 控制所有客户端
			self.clients.claim(),
			// 初始化版本检查
			getCurrentVersion().then(version => {
				currentAppVersion = version;
				console.log('Current app version:', currentAppVersion);
			})
		])
	);
});

// 拦截请求
self.addEventListener('fetch', event => {
	// 对date文件的请求不缓存，总是获取最新版本
	if (event.request.url.includes(DATE_FILE_URL)) {
		event.respondWith(
			fetch(event.request).then(response => {
				// 检查版本更新
				checkForUpdate(response.text()).then(hasUpdate => {
					if (hasUpdate) {
						console.log('Update detected during fetch, updating cache...');
						updateCache();
					}
				});
				return response.clone();
			}).catch(error => {
				console.log('Date file fetch failed:', error);
				return new Response(currentAppVersion || Date.now().toString());
			})
		);
		return;
	}

	event.respondWith(
		caches.match(event.request)
			.then(response => {
				// 如果缓存中有，返回缓存内容
				if (response) {
					return response;
				}

				// 否则从网络获取
				return fetch(event.request).then(response => {
					// 检查是否为有效响应
					if (!response || response.status !== 200 || response.type !== 'basic') {
						return response;
					}

					// 克隆响应
					const responseToCache = response.clone();

					caches.open(CACHE_NAME)
						.then(cache => {
							cache.put(event.request, responseToCache);
						});

					return response;
				});
			}
			)
	);
});

// 监听消息（用于手动触发更新检查）
self.addEventListener('message', event => {
	if (event.data && event.data.type === 'CHECK_FOR_UPDATE') {
		checkForUpdate(null, true).then(hasUpdate => {
			if (hasUpdate) {
				updateCache().then(success => {
					event.source.postMessage({
						type: 'UPDATE_RESULT',
						success: success,
						version: currentAppVersion
					});
				});
			} else {
				event.source.postMessage({
					type: 'UPDATE_RESULT',
					success: false,
					version: currentAppVersion
				});
			}
		});
	}
});

// 定期检查更新
self.addEventListener('periodicsync', event => {
	if (event.tag === 'version-check') {
		event.waitUntil(
			checkForUpdate().then(hasUpdate => {
				if (hasUpdate) {
					return updateCache();
				}
			})
		);
	}
});

console.log('Service Worker loaded with auto-update functionality');