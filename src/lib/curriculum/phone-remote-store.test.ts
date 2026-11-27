import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isLocalDevHost,
  isPhoneRemoteShareMobile,
  lanDevOriginFromIp,
  pickLanIpv4,
  phoneRemoteBrowserOrigin,
  phoneRemoteFacebookShareUrl,
  phoneRemoteMessengerAppShareUrl,
  cloudflareOriginFromMetrics,
  phonePublicHref,
  phoneRemoteQrPayload,
  phoneRemoteZaloShareUrl,
} from './phone-remote-public-origin'
import {
  collapsePhoneCommands,
  createPhoneRemoteSession,
  pullPhoneRemoteCommands,
  pushPhoneRemoteCommands,
  readPhoneRemoteForUser,
  phoneTeacherReturnPath,
  redeemPhoneRemoteLogin,
  splitPhoneLoginKey,
  updatePhoneRemoteFromDesktop,
} from './phone-remote-store'

describe('phone remote public origin', () => {
  it('treats localhost and a LAN address as local', () => {
    assert.equal(isLocalDevHost('localhost'), true)
    assert.equal(isLocalDevHost('127.0.0.1'), true)
    assert.equal(isLocalDevHost('192.168.1.20'), true)
    assert.equal(isLocalDevHost('amia-canelike-exhibitively.ngrok-free.dev'), false)
  })

  it('keeps a single https link for the phone camera', () => {
    const payload = phoneRemoteQrPayload(
      'https://amia-canelike-exhibitively.ngrok-free.dev/giao-trinh/dien-thoai?k=abcdefghij.abcdefghijklmnopqrstuv'
    )
    assert.equal(
      payload,
      'https://amia-canelike-exhibitively.ngrok-free.dev/giao-trinh/dien-thoai?k=abcdefghij.abcdefghijklmnopqrstuv'
    )
    assert.equal(phoneRemoteQrPayload('not a link'), null)
  })

  it('keeps the phone on ngrok instead of localhost', () => {
    assert.equal(
      phoneRemoteBrowserOrigin({
        forwardedHost: 'amia-canelike-exhibitively.ngrok-free.dev',
        host: 'localhost:3000',
        forwardedProto: 'https',
      }),
      'https://amia-canelike-exhibitively.ngrok-free.dev'
    )
    assert.equal(phoneRemoteBrowserOrigin({ host: 'localhost:3000', forwardedProto: 'http' }), null)
    assert.equal(
      phoneRemoteBrowserOrigin({ host: '192.168.1.20:3000', forwardedProto: 'http' }),
      'http://192.168.1.20:3000'
    )
    assert.equal(
      phoneRemoteBrowserOrigin({
        host: 'adjusted-politics-phentermine-phi.trycloudflare.com:3000',
        forwardedProto: 'http',
      }),
      'https://adjusted-politics-phentermine-phi.trycloudflare.com'
    )
  })

  it('reads the Cloudflare tunnel hostname from local metrics', () => {
    const text =
      'cloudflared_tunnel_user_hostnames_counts{userHostname="https://benefit-administrative-artificial-fraction.trycloudflare.com"} 1\n'
    assert.equal(
      cloudflareOriginFromMetrics(text),
      'https://benefit-administrative-artificial-fraction.trycloudflare.com'
    )
    assert.equal(cloudflareOriginFromMetrics('no hostname'), null)
    assert.equal(
      phonePublicHref('https://adjusted-politics-phentermine-phi.trycloudflare.com:3000/lam-bai/CZR9K8'),
      'https://adjusted-politics-phentermine-phi.trycloudflare.com/lam-bai/CZR9K8'
    )
  })

  it('picks the Wi-Fi address for the phone QR', () => {
    assert.equal(pickLanIpv4(['127.0.0.1', '10.8.0.2', '192.168.1.8']), '192.168.1.8')
    assert.equal(lanDevOriginFromIp('192.168.1.8', 3000), 'http://192.168.1.8:3000')
    assert.equal(lanDevOriginFromIp('127.0.0.1', 3000), null)
  })

  it('builds Zalo and Messenger share links from the phone login url', () => {
    const page = 'https://amia-canelike-exhibitively.ngrok-free.dev/giao-trinh/dien-thoai?k=abcdefghij.abcdefghijklmnopqrstuv'
    const encoded = encodeURIComponent(page)
    assert.equal(phoneRemoteZaloShareUrl(page), `https://zalo.me/share?url=${encoded}`)
    assert.equal(phoneRemoteFacebookShareUrl(page), `https://www.facebook.com/sharer/sharer.php?u=${encoded}`)
    assert.equal(phoneRemoteMessengerAppShareUrl(page), `fb-messenger://share/?link=${encoded}`)
    assert.equal(isPhoneRemoteShareMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true)
    assert.equal(isPhoneRemoteShareMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false)
  })
})

describe('phone remote login key', () => {
  it('splits id and secret and rejects a short key', () => {
    const ok = splitPhoneLoginKey('abcdefghij.abcdefghijklmnopqrstuv')
    assert.deepEqual(ok, { id: 'abcdefghij', secret: 'abcdefghijklmnopqrstuv' })
    assert.equal(splitPhoneLoginKey('short.secret'), null)
    assert.equal(splitPhoneLoginKey('abcdefghij'), null)
  })

  it('keeps the latest mouse move and drops unknown commands', () => {
    const out = collapsePhoneCommands([
      { type: 'mouse-pos', relX: 0.1 },
      { type: 'mouse-pos', relX: 0.4 },
      { type: 'worksheet-answer-reveal', typingOn: true },
      { type: 'worksheet-answer-reveal', typingOn: false, control: true },
      { type: 'slide-go', index: 2, __syncSeq: 9 },
      { type: 'Click' },
      { type: '' },
    ])
    assert.equal(out.length, 4)
    assert.equal(out[0]?.type, 'mouse-pos')
    assert.equal(out[0]?.relX, 0.4)
    assert.equal(out[1]?.type, 'worksheet-answer-reveal')
    assert.equal(out[1]?.typingOn, true)
    assert.equal(out[2]?.type, 'worksheet-answer-reveal')
    assert.equal(out[2]?.control, true)
    assert.equal(out[2]?.typingOn, false)
    assert.equal(out[3]?.type, 'slide-go')
    assert.equal(out[3]?.index, 2)
    assert.equal('__syncSeq' in (out[3] ?? {}), false)
  })

  it('does not let a typing heartbeat replace a pause command', () => {
    const out = collapsePhoneCommands([
      { type: 'worksheet-answer-reveal', control: true, typingOn: true, worksheetAnswerTypingPaused: { '0-0': true } },
      { type: 'worksheet-answer-reveal', typingOn: true, worksheetAnswerTypingPaused: {} },
      { type: 'worksheet-answer-reveal', typingOn: true, worksheetAnswerReveal: { '0-0': 4 } },
    ])
    assert.equal(out.length, 2)
    assert.equal(out[0]?.control, true)
    assert.equal((out[0]?.worksheetAnswerTypingPaused as Record<string, boolean>)['0-0'], true)
    assert.equal(out[1]?.control, undefined)
    assert.equal((out[1]?.worksheetAnswerReveal as Record<string, number>)['0-0'], 4)
  })

  it('keeps a figure stop after a run of sim ticks', () => {
    const out = collapsePhoneCommands([
      { type: 'whiteboard-sim', sim: 1 },
      { type: 'whiteboard-sim', sim: 2 },
      { type: 'whiteboard-upsert', object: { id: 'lab', params: { run: false } } },
    ])
    assert.equal(out.length, 2)
    assert.equal(out[0]?.type, 'whiteboard-sim')
    assert.equal(out[0]?.sim, 2)
    assert.equal(out[1]?.type, 'whiteboard-upsert')
  })

  it('stores one sim tick and still delivers a later stop', async () => {
    const userId = '22222222-2222-4222-8222-222222222222'
    const created = await createPhoneRemoteSession({
      userId,
      email: 'teacher@example.com',
      snapshot: { topic: 'Lab' },
      index: 0,
    })
    assert.equal('error' in created, false)
    if ('error' in created) return
    await pushPhoneRemoteCommands({ id: created.id, userId, commands: [{ type: 'whiteboard-sim', sim: 1 }] })
    await pushPhoneRemoteCommands({ id: created.id, userId, commands: [{ type: 'whiteboard-sim', sim: 4 }] })
    await pushPhoneRemoteCommands({
      id: created.id,
      userId,
      commands: [{ type: 'whiteboard-upsert', object: { id: 'lab', params: { run: false } } }],
    })
    const pulled = await pullPhoneRemoteCommands({ id: created.id, userId, after: 0 })
    assert.equal(pulled?.length, 2)
    assert.equal(pulled?.[0]?.msg.type, 'whiteboard-sim')
    assert.equal(pulled?.[0]?.msg.sim, 4)
    assert.equal(pulled?.[1]?.msg.type, 'whiteboard-upsert')
  })

  it('stores a login and replays a slide command to the same account', async () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    const created = await createPhoneRemoteSession({
      userId,
      email: 'teacher@example.com',
      snapshot: { topic: 'Vector', slides: [{ title: 'Slide 1' }] },
      index: 0,
    })
    assert.equal('error' in created, false)
    if ('error' in created) return
    const redeemed = await redeemPhoneRemoteLogin(`${created.id}.${created.secret}`)
    assert.equal(redeemed?.userId, userId)
    assert.equal(phoneTeacherReturnPath(redeemed?.snapshot, created.id), `/giao-trinh/giao-vien?phone=${created.id}`)
    assert.equal(
      phoneTeacherReturnPath({ phoneSurface: 'worksheet', worksheetId: 'ws_1' }, created.id),
      `/giao-trinh/giao-vien?phone=${created.id}&worksheetId=ws_1`,
    )
    assert.equal(
      phoneTeacherReturnPath({ phoneSurface: 'exam', examCode: 'de01' }, created.id),
      `/giao-trinh/giao-vien?phone=${created.id}&examCode=DE01`,
    )
    assert.equal(await redeemPhoneRemoteLogin(`${created.id}.wrong-secret-value-here`), null)
    const pushed = await pushPhoneRemoteCommands({
      id: created.id,
      userId,
      commands: [
        { type: 'mouse-pos', relX: 0.2 },
        { type: 'mouse-pos', relX: 0.8 },
        { type: 'slide-go', index: 3 },
      ],
    })
    assert.equal(pushed, 2)
    const pulled = await pullPhoneRemoteCommands({ id: created.id, userId, after: 0 })
    assert.equal(pulled?.length, 2)
    assert.equal(pulled?.[1]?.msg.type, 'slide-go')
    assert.equal(pulled?.[1]?.msg.index, 3)
    const again = await pullPhoneRemoteCommands({ id: created.id, userId, after: pulled?.[1]?.n ?? 0 })
    assert.equal(again?.length, 0)
    const row = await readPhoneRemoteForUser(created.id, userId)
    assert.equal(row?.index, 3)
    const kept = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      snapshot: { topic: 'Vector', slides: [{ title: 'Slide 1' }] },
      seenRevision: row?.revision,
    })
    assert.equal(kept?.index, 3)
    const stale = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      index: 1,
      seenGen: 0,
    })
    assert.equal(stale?.index, 3)
    const moved = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      index: 6,
      seenGen: stale?.indexGen,
    })
    assert.equal(moved?.index, 6)
    const withBoard = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      whiteboard: { objects: [{ id: 'lab' }], camera: { x: 0, y: 0, scale: 1 }, grid: true },
      seenRevision: moved?.revision,
    })
    assert.equal(withBoard?.whiteboardApplied, true)
    const slideOnly = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      snapshot: { topic: 'Vector', slides: [{ title: 'Slide 2' }], whiteboard: { objects: [] } },
      seenRevision: withBoard?.revision,
    })
    assert.equal(slideOnly?.whiteboardApplied, false)
    const afterSlide = await readPhoneRemoteForUser(created.id, userId)
    const keptBoard = afterSlide?.snapshot.whiteboard as { objects?: { id?: string }[] }
    assert.equal(keptBoard?.objects?.[0]?.id, 'lab')
    const paused = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      whiteboard: { objects: [{ id: 'lab', run: false }] },
      seenWhiteboardGen: withBoard?.whiteboardGen,
    })
    assert.equal(paused?.whiteboardApplied, true)
    const pausedRow = await readPhoneRemoteForUser(created.id, userId)
    const pausedBoard = pausedRow?.snapshot.whiteboard as { objects?: { run?: boolean }[] }
    assert.equal(pausedBoard?.objects?.[0]?.run, false)
    const staleBoard = await updatePhoneRemoteFromDesktop({
      id: created.id,
      userId,
      whiteboard: { objects: [{ id: 'gone' }] },
      seenRevision: (afterSlide?.revision ?? 1) - 1,
    })
    assert.equal(staleBoard?.whiteboardApplied, false)
    const still = await readPhoneRemoteForUser(created.id, userId)
    assert.equal((still?.snapshot.whiteboard as { objects?: { id?: string }[] })?.objects?.[0]?.id, 'lab')
  })

  it('wakes a waiting student pull as soon as the phone sends', async () => {
    const userId = '33333333-3333-4333-8333-333333333333'
    const created = await createPhoneRemoteSession({
      userId,
      email: 'teacher@example.com',
      snapshot: { topic: 'Wake' },
      index: 0,
    })
    assert.equal('error' in created, false)
    if ('error' in created) return
    const pending = pullPhoneRemoteCommands({ id: created.id, userId, after: 0, waitMs: 400 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    await pushPhoneRemoteCommands({ id: created.id, userId, commands: [{ type: 'slide-go', index: 2 }] })
    const pulled = await pending
    assert.equal(pulled?.length, 1)
    assert.equal(pulled?.[0]?.msg.type, 'slide-go')
    assert.equal(pulled?.[0]?.msg.index, 2)
  })

  it('closes the desktop QR only after a phone load newer than the open', async () => {
    const userId = '44444444-4444-4444-8444-444444444444'
    const created = await createPhoneRemoteSession({
      userId,
      email: 'teacher@example.com',
      snapshot: { topic: 'QR' },
      index: 0,
    })
    assert.equal('error' in created, false)
    if ('error' in created) return
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, qrWatch: 11 })
    const opened = await readPhoneRemoteForUser(created.id, userId)
    const watchAt = opened?.qrWatchAt || 0
    assert.ok(watchAt > 0)
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, qrWatch: 11 })
    const reopened = await readPhoneRemoteForUser(created.id, userId)
    assert.equal(reopened?.qrWatchAt, watchAt)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, phoneReady: true, phoneBoot: 100 })
    const loaded = await readPhoneRemoteForUser(created.id, userId)
    const readyAt = loaded?.phoneReadyServerAt || 0
    assert.ok(readyAt > watchAt)
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, phoneReady: true, phoneBoot: 100 })
    const retry = await readPhoneRemoteForUser(created.id, userId)
    assert.equal(retry?.phoneReadyServerAt, readyAt)
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, qrWatch: 22 })
    const again = await readPhoneRemoteForUser(created.id, userId)
    assert.ok((again?.qrWatchAt || 0) > readyAt)
    assert.ok((again?.phoneReadyServerAt || 0) <= (again?.qrWatchAt || 0))
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updatePhoneRemoteFromDesktop({ id: created.id, userId, phoneReady: true, phoneBoot: 200 })
    const scanned = await readPhoneRemoteForUser(created.id, userId)
    assert.ok((scanned?.phoneReadyServerAt || 0) > (scanned?.qrWatchAt || 0))
  })
})
