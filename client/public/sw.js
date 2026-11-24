/* Service worker используется только для Web Push (офлайн-режим не поддерживается). */
self.addEventListener('push', (event) => {
  let data = { title: 'HabitTrack', body: 'Не забудьте отметить привычки!' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/brand/icon-192.png',
      badge: '/brand/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const current = clients.find((client) => new URL(client.url).pathname === new URL(url, self.location.origin).pathname);
      if (current) return current.focus();
      return self.clients.openWindow(url);
    }),
  );
});
