import { NextResponse } from 'next/server'

/** Kill-switch worker: leftover production SW updates to this, then uninstalls itself. */
const KILL_SWITCH = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',(event)=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map((k)=>caches.delete(k)));
    await self.registration.unregister();
    const clients=await self.clients.matchAll({type:'window'});
    for (const client of clients) {
      if ('navigate' in client) void client.navigate(client.url);
    }
  })());
});
`

export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }
  return new NextResponse(KILL_SWITCH, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  })
}
