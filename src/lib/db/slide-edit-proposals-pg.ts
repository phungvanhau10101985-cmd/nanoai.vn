import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type SlideProposalDeleteCheckPg = {
  id: string
  proposed_by: string | null
  agree_count: number
  disagree_count: number
  status: string
}

export async function fetchSlideProposalForDeletePg(proposalId: string): Promise<SlideProposalDeleteCheckPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<SlideProposalDeleteCheckPg>(
      `select id::text as id,
              proposed_by::text as proposed_by,
              agree_count,
              disagree_count,
              status
       from public.slide_edit_proposals
       where id = $1::uuid
       limit 1`,
      [proposalId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] fetchSlideProposalForDeletePg', e)
    return null
  }
}

export async function deleteSlideProposalByIdPg(proposalId: string): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(`delete from public.slide_edit_proposals where id = $1::uuid`, [proposalId])
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function insertSlideEditProposalPg(input: {
  curriculumId: string
  slideIndex: number
  blockIndex: number
  segmentType: 'edit' | 'add'
  originalText: string | null
  proposedText: string
  proposedHeader: string | null
  proposedBy: string | null
}): Promise<{ id: string } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.slide_edit_proposals (
         curriculum_id, slide_index, block_index, segment_type,
         original_text, proposed_text, proposed_header, proposed_by, status
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, 'pending'
       )
       returning id::text as id`,
      [
        input.curriculumId,
        input.slideIndex,
        input.blockIndex,
        input.segmentType,
        input.originalText,
        input.proposedText,
        input.proposedHeader,
        input.proposedBy,
      ]
    )
    if (!row?.id) return { error: 'Insert không trả id.' }
    return { id: row.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function upsertSlideEditVotePg(
  proposalId: string,
  userId: string,
  vote: 'agree' | 'disagree'
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `insert into public.slide_edit_votes (proposal_id, user_id, vote)
       values ($1::uuid, $2::uuid, $3::text)
       on conflict (proposal_id, user_id) do update set vote = excluded.vote`,
      [proposalId, userId, vote]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type SlideProposalVoteSummaryPg = {
  id: string
  disagree_count: number
  status: string
}

export async function fetchSlideProposalVoteSummaryPg(proposalId: string): Promise<SlideProposalVoteSummaryPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<SlideProposalVoteSummaryPg>(
      `select id::text as id, disagree_count, status
       from public.slide_edit_proposals
       where id = $1::uuid
       limit 1`,
      [proposalId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] fetchSlideProposalVoteSummaryPg', e)
    return null
  }
}

export type SlideProposalApplyRowPg = {
  id: string
  curriculum_id: string
  slide_index: number
  block_index: number
  segment_type: string
  original_text: string | null
  proposed_text: string | null
  proposed_header: string | null
  agree_count: number
  status: string
}

export async function fetchSlideProposalForApplyPg(proposalId: string): Promise<SlideProposalApplyRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<SlideProposalApplyRowPg>(
      `select id::text as id,
              curriculum_id::text as curriculum_id,
              slide_index,
              block_index,
              segment_type::text as segment_type,
              original_text,
              proposed_text,
              proposed_header,
              agree_count,
              status::text as status
       from public.slide_edit_proposals
       where id = $1::uuid
       limit 1`,
      [proposalId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] fetchSlideProposalForApplyPg', e)
    return null
  }
}

export type SlideProposalForceRowPg = Omit<SlideProposalApplyRowPg, 'agree_count'> & { agree_count?: number }

export async function fetchSlideProposalForForcePg(proposalId: string): Promise<SlideProposalForceRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<SlideProposalForceRowPg>(
      `select id::text as id,
              curriculum_id::text as curriculum_id,
              slide_index,
              block_index,
              segment_type::text as segment_type,
              original_text,
              proposed_text,
              proposed_header,
              status::text as status
       from public.slide_edit_proposals
       where id = $1::uuid
       limit 1`,
      [proposalId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] fetchSlideProposalForForcePg', e)
    return null
  }
}

export async function updateSlideProposalApprovedPg(
  proposalId: string,
  approvedAtIso: string
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.slide_edit_proposals
       set status = 'approved', approved_at = $2::timestamptz
       where id = $1::uuid`,
      [proposalId, approvedAtIso]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateSlideProposalRejectedPg(proposalId: string): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(`update public.slide_edit_proposals set status = 'rejected' where id = $1::uuid`, [proposalId])
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type SlideProposalListItemPg = {
  id: string
  curriculum_id?: string
  slide_index: number
  block_index: number
  segment_type: string
  original_text: string | null
  proposed_text: string | null
  proposed_header: string | null
  status: string
  agree_count: number
  disagree_count: number
  proposed_by: string | null
  created_at: string
}

export async function listSlideProposalsForCurriculumPg(curriculumId: string): Promise<SlideProposalListItemPg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<SlideProposalListItemPg>(
      `select id::text as id,
              slide_index,
              block_index,
              segment_type::text as segment_type,
              original_text,
              proposed_text,
              proposed_header,
              status::text as status,
              agree_count,
              disagree_count,
              proposed_by::text as proposed_by,
              created_at::timestamptz::text as created_at
       from public.slide_edit_proposals
       where curriculum_id = $1::uuid
         and status in ('pending', 'approved')
       order by created_at desc`,
      [curriculumId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] listSlideProposalsForCurriculumPg', e)
    return []
  }
}

export type SlideEditVoteRowPg = { proposal_id: string; vote: string }

export async function listSlideEditVotesForUserPg(userId: string): Promise<SlideEditVoteRowPg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<SlideEditVoteRowPg>(
      `select proposal_id::text as proposal_id, vote::text as vote
       from public.slide_edit_votes
       where user_id = $1::uuid`,
      [userId]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] listSlideEditVotesForUserPg', e)
    return []
  }
}

const SLIDE_PROPOSAL_ADMIN_LIST_SELECT = `id::text as id,
          curriculum_id::text as curriculum_id,
          slide_index,
          block_index,
          segment_type::text as segment_type,
          original_text,
          proposed_text,
          proposed_header,
          status::text as status,
          agree_count,
          disagree_count,
          proposed_by::text as proposed_by,
          created_at::timestamptz::text as created_at`

export async function listSlideProposalsForAdminPg(opts: {
  status?: string
  limit: number
}): Promise<SlideProposalListItemPg[]> {
  if (!isPgConfigured()) return []
  const lim = Math.min(200, Math.max(1, opts.limit))
  try {
    if (opts.status) {
      return await pgQuery<SlideProposalListItemPg>(
        `select ${SLIDE_PROPOSAL_ADMIN_LIST_SELECT}
         from public.slide_edit_proposals
         where status = $1::text
         order by created_at desc
         limit $2`,
        [opts.status, lim]
      )
    }
    return await pgQuery<SlideProposalListItemPg>(
      `select ${SLIDE_PROPOSAL_ADMIN_LIST_SELECT}
       from public.slide_edit_proposals
       order by created_at desc
       limit $1`,
      [lim]
    )
  } catch (e) {
    console.error('[slide-edit-proposals-pg] listSlideProposalsForAdminPg', e)
    return []
  }
}
