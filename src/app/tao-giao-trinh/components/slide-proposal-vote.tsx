'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { voteOnSlideProposal, deleteSlideProposal } from '../actions'

interface Proposal {
  id: string
  segment_type?: string
  proposed_text: string
  proposed_header?: string | null
  original_text?: string | null
  status: string
  agree_count: number
  disagree_count: number
  proposed_by?: string | null
  myVote?: 'agree' | 'disagree'
}

interface SlideProposalVoteProps {
  proposal: Proposal
  currentUserId?: string | null
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  onVoted?: () => void
  onDeleted?: () => void
}

export function SlideProposalVote({ proposal, currentUserId, tr, onVoted, onDeleted }: SlideProposalVoteProps) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const handleVote = async (vote: 'agree' | 'disagree') => {
    const res = await voteOnSlideProposal(proposal.id, vote)
    if (!res?.error) onVoted?.()
  }

  const handleDelete = async () => {
    if (!confirm(tr('Xóa đề xuất này?', 'Delete this proposal?', '删除此建议？', 'この提案を削除しますか？', '이 제안을 삭제하시겠습니까?'))) return
    setDeleting(true)
    const res = await deleteSlideProposal(proposal.id)
    setDeleting(false)
    if (res?.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
    } else {
      onDeleted?.()
    }
  }

  const isPending = proposal.status === 'pending'
  const totalVotes = (proposal.agree_count ?? 0) + (proposal.disagree_count ?? 0)
  const isCreator = proposal.proposed_by && proposal.proposed_by === currentUserId
  const canDelete = isPending && totalVotes === 0 && isCreator
  const canVote = isPending && !isCreator
  const hasAgreed = proposal.myVote === 'agree'
  const hasDisagreed = proposal.myVote === 'disagree'

  const isAdd = proposal.segment_type === 'add'
  const label = isPending
    ? (isAdd ? tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안') : tr('Đề xuất sửa', 'Edit proposal', '编辑建议', '編集提案', '편집 제안'))
    : tr('Đã áp dụng', 'Applied', '已应用', '適用済み', '적용됨')

  const [expanded, setExpanded] = useState(false)
  const contentLong = (proposal.original_text?.length ?? 0) + (proposal.proposed_text?.length ?? 0) > 120
  const showExpand = contentLong

  return (
    <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/20 px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-amber-800 dark:text-amber-200 shrink-0">{label}</p>
        {isPending && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {proposal.agree_count} 👍 / {proposal.disagree_count} 👎
          </span>
        )}
      </div>
      {isAdd && proposal.proposed_header && (
        <p className="mt-0.5 text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80">{proposal.proposed_header}</p>
      )}
      <div className={`mt-1 text-slate-600 dark:text-slate-400 ${!expanded && showExpand ? 'line-clamp-2' : ''}`}>
        {!isAdd && proposal.original_text && (
          <span className="text-muted-foreground line-through">{proposal.original_text}</span>
        )}
        {!isAdd && proposal.original_text && proposal.proposed_text && (
          <span className="text-muted-foreground mx-1">→</span>
        )}
        <span className="text-slate-700 dark:text-slate-300">{proposal.proposed_text}</span>
      </div>
      {showExpand && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 hover:underline"
        >
          {expanded ? tr('Thu gọn', 'Collapse', '收起', '折りたたむ', '접기') : tr('Xem thêm', 'Show more', '查看更多', 'もっと見る', '더 보기')}
        </button>
      )}
      {isPending && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {canVote && (
            <>
              <Button
                variant={hasAgreed ? 'default' : 'outline'}
                size="sm"
                className="h-5 gap-0.5 px-1.5 text-[10px]"
                onClick={() => handleVote('agree')}
              >
                <ThumbsUp className="h-2.5 w-2.5" />
                {tr('Đồng ý', 'Agree', '同意', '賛成', '찬성')}
              </Button>
              <Button
                variant={hasDisagreed ? 'destructive' : 'outline'}
                size="sm"
                className="h-5 gap-0.5 px-1.5 text-[10px]"
                onClick={() => handleVote('disagree')}
              >
                <ThumbsDown className="h-2.5 w-2.5" />
                {tr('Không', 'Disagree', '不同意', '反対', '반대')}
              </Button>
            </>
          )}
          {isCreator && !canVote && (
            <span className="text-[10px] text-muted-foreground italic">{tr('Bạn đã tạo', 'You created', '您创建', 'あなたが作成', '생성함')}</span>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 gap-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-2.5 w-2.5" />
              {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
