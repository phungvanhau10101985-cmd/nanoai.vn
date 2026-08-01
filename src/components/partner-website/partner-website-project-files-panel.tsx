'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, FileCode2, Folder } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import { formatDiffForDisplay, type FileDiff } from '@/lib/partner-website/partner-website-line-diff'

type FileTreeNode = {
  name: string
  path?: string
  children: FileTreeNode[]
}

function insertPath(root: FileTreeNode, path: string) {
  const parts = path.split('/').filter(Boolean)
  let node = root
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    const isFile = i === parts.length - 1
    let child = node.children.find((c) => c.name === part)
    if (!child) {
      child = { name: part, path: isFile ? path : undefined, children: [] }
      node.children.push(child)
    }
    node = child
  }
}

function buildFileTree(paths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: 'project', children: [] }
  for (const path of [...paths].sort()) insertPath(root, path)
  return root
}

function TreeRows({
  node,
  depth,
  selectedPath,
  changedPaths,
  onSelect,
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string
  changedPaths: Set<string>
  onSelect: (path: string) => void
}) {
  if (node.name === 'project') {
    return (
      <>
        {node.children.map((child) => (
          <TreeRows
            key={child.path ?? child.name}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            changedPaths={changedPaths}
            onSelect={onSelect}
          />
        ))}
      </>
    )
  }

  const isFile = Boolean(node.path)
  const isSelected = node.path === selectedPath
  const isChanged = node.path ? changedPaths.has(node.path) : false

  return (
    <>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
          isSelected && 'bg-muted font-medium'
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={() => {
          if (node.path) onSelect(node.path)
        }}
      >
        {isFile ? (
          <FileCode2
            className={cn('h-4 w-4 shrink-0', isChanged ? 'text-emerald-600' : 'text-muted-foreground')}
            aria-hidden
          />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="truncate">{node.name}</span>
        {isChanged ? (
          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
            Δ
          </Badge>
        ) : null}
        {!isFile ? <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" aria-hidden /> : null}
      </button>
      {node.children.map((child) => (
        <TreeRows
          key={child.path ?? `${node.name}/${child.name}`}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          changedPaths={changedPaths}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

function DiffView({ diff }: { diff: FileDiff }) {
  return (
    <pre className="overflow-auto rounded-md border bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
      {diff.lines.map((line, idx) => (
        <div
          key={`${line.type}-${idx}`}
          className={cn(
            line.type === 'add' && 'bg-emerald-950/80 text-emerald-200',
            line.type === 'remove' && 'bg-red-950/80 text-red-200'
          )}
        >
          {formatDiffForDisplay({ ...diff, lines: [line] })}
        </div>
      ))}
    </pre>
  )
}

export function PartnerWebsiteProjectFilesPanel({
  locale,
  website,
  selectedFile,
  onSelectFile,
  fileDiffs = [],
  layout = 'bottom',
}: {
  locale: WebLocale
  website: PartnerWebsiteRow | null
  selectedFile: string
  onSelectFile: (path: string) => void
  fileDiffs?: FileDiff[]
  layout?: 'bottom' | 'sidebar'
}) {
  const t = getPartnerWebsiteCopy(locale)
  const [expanded, setExpanded] = useState(true)
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code')

  const filePaths = useMemo(() => website?.project.files.map((f) => f.path) ?? [], [website])
  const tree = useMemo(() => buildFileTree(filePaths), [filePaths])
  const changedPaths = useMemo(() => new Set(fileDiffs.map((d) => d.path)), [fileDiffs])

  const selectedContent = useMemo(() => {
    if (!website) return ''
    const file = website.project.files.find((f) => f.path === selectedFile)
    return file?.content ?? ''
  }, [website, selectedFile])

  const selectedDiff = useMemo(
    () => fileDiffs.find((d) => d.path === selectedFile) ?? null,
    [fileDiffs, selectedFile]
  )

  const isBottom = layout === 'bottom'

  if (!website || filePaths.length === 0) {
    return (
      <Card className="shrink-0">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t.fileTreeTitle}</CardTitle>
          <CardDescription className="text-xs">{t.fileTreeEmpty}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shrink-0">
      <CardHeader className="space-y-1 py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div>
            <CardTitle className="text-sm">{t.fileTreeTitle}</CardTitle>
            <CardDescription className="text-xs">
              {t.fileTreeHint} · {t.filesGenerated}: {filePaths.length}
              {fileDiffs.length > 0 ? ` · ${fileDiffs.length} ${t.fileChanged}` : ''}
            </CardDescription>
          </div>
          <ChevronRight
            className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-90')}
            aria-hidden
          />
        </button>
      </CardHeader>
      {expanded ? (
        <CardContent className={cn('pb-4 pt-0', isBottom && 'grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]')}>
          <div
            className={cn(
              'overflow-auto rounded-md border bg-muted/10 p-1',
              isBottom ? 'max-h-[220px] lg:max-h-[280px]' : 'max-h-[160px]'
            )}
          >
            <TreeRows
              node={tree}
              depth={0}
              selectedPath={selectedFile}
              changedPaths={changedPaths}
              onSelect={(path) => {
                onSelectFile(path)
                if (changedPaths.has(path)) setViewMode('diff')
              }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted-foreground">{selectedFile}</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'code' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewMode('code')}
                >
                  {t.viewCode}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'diff' ? 'default' : 'outline'}
                  className="h-7 px-2 text-xs"
                  disabled={!selectedDiff}
                  onClick={() => setViewMode('diff')}
                >
                  {t.viewDiff}
                  {selectedDiff ? ` +${selectedDiff.added}/-${selectedDiff.removed}` : ''}
                </Button>
              </div>
            </div>
            {viewMode === 'diff' && selectedDiff ? (
              <div
                className={cn(isBottom ? 'max-h-[220px] lg:max-h-[280px]' : 'max-h-[140px]')}
              >
                <p className="mb-1 text-[11px] text-muted-foreground">{t.diffTitle}</p>
                <DiffView diff={selectedDiff} />
              </div>
            ) : selectedContent ? (
              <pre
                className={cn(
                  'overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed',
                  isBottom ? 'max-h-[220px] lg:max-h-[280px]' : 'max-h-[140px]'
                )}
              >
                {selectedContent}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">{t.diffEmpty}</p>
            )}
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
