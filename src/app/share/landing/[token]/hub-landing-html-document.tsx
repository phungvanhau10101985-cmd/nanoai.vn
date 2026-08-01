'use client'

export function HubLandingHtmlDocument({
  html,
  allowScripts = false,
}: {
  html: string
  allowScripts?: boolean
}) {
  const sandbox = allowScripts
    ? 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms'
    : 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
  return (
    <iframe
      title="Landing page"
      srcDoc={html}
      sandbox={sandbox}
      className="fixed inset-0 h-full w-full border-0 bg-white"
    />
  )
}
