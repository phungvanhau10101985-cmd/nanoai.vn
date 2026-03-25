/* Web Push — import vào sw.js (Workbox). Không dùng import/module ở đây. */
self.addEventListener('push', function (event) {
  var data = {}
  try {
    if (event.data) data = event.data.json()
  } catch (e) {
    try {
      var t = event.data && event.data.text()
      if (t) data = JSON.parse(t)
    } catch (e2) {}
  }
  var title = data.title || 'NanoAI'
  var body = data.body || ''
  var urlPath = data.url || '/'
  var origin = self.location.origin
  var openUrl = urlPath.indexOf('http') === 0 ? urlPath : origin + (urlPath.charAt(0) === '/' ? urlPath : '/' + urlPath)

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: data.tag || 'nanoai',
      renotify: !!data.renotify,
      data: { url: openUrl },
    })
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var raw = (event.notification.data && event.notification.data.url) || self.location.origin + '/'
  var urlToOpen = raw.indexOf('http') === 0 ? raw : self.location.origin + (raw.charAt(0) === '/' ? raw : '/' + raw)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          return client.focus().then(function () {
            if ('navigate' in client) {
              try {
                return client.navigate(urlToOpen)
              } catch (e) {}
            }
            return self.clients.openWindow(urlToOpen)
          })
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen)
    })
  )
})
