import { matchStudioPresetWithScore } from '@/lib/hub-chat/hub-studio-presets'

import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'



const EXPLICIT_FLOW_SWITCH =

  /(?:^|\s)(?:chuyển|chuyen|đổi|doi|bắt đầu|bat dau|tạo dự án|tao du an|làm dự án|lam du an|start|switch|change|new project|新建|切换|変更|新規|새 프로젝트|전환)(?:\s|$)/i



const START_FLOW_REQUEST =

  /^(?:tôi muốn|toi muon|muốn|muon|hãy|hay|tạo|tao|làm|lam|thiết kế|thiet ke|i want|create|make|design)\b/i



/** Short single-line messages that clearly name another Studio flow. */

const MAX_COMPACT_FLOW_INTENT_LEN = 120



/** Minimum intent-token score before a compact message can fork without an explicit verb. */

const MIN_COMPACT_FLOW_MATCH_SCORE = 10

/** Minimum model confidence before proposing a mid-flow switch dialog. */
export const FLOW_SWITCH_AI_MIN_CONFIDENCE = 0.75

const MAX_AI_CLASSIFY_MESSAGE_LEN = 400

/** Skip AI when the message is clearly step content, not a meta switch request. */
export function shouldSkipFlowSwitchAiClassification(
  message: string,
  _session?: HubStudioSession | null
): boolean {
  const trimmed = message.trim()
  if (!trimmed) return true
  if (/[\n\r]/.test(trimmed)) return true
  if (trimmed.length > MAX_AI_CLASSIFY_MESSAGE_LEN) return true
  if (/^MẶT\s*\d/i.test(trimmed)) return true
  if (/Logo\/Thương hiệu:/i.test(trimmed)) return true
  if (/^Mặt này tập trung/i.test(trimmed)) return true
  return false
}

export function isActiveStudioFlow(

  session: HubStudioSession | null | undefined

): boolean {

  return Boolean(session?.presetId && session.processSteps.length)

}

/** All design steps finished — user may pick another feature in a new thread. */
export function isStudioFlowComplete(
  session: HubStudioSession | null | undefined
): boolean {
  if (!session?.presetId || !session.processSteps.length) return false
  return session.processSteps.every((step) => step.status === 'done') && !session.currentStepKey
}



/** Server guard: start_preset on a thread that already has an active flow must fail. */

export function blocksPresetStartOnThread(

  session: HubStudioSession | null | undefined

): boolean {

  return isActiveStudioFlow(session)

}



export type StudioNewFlowStartRequest = {

  action: 'start_preset'

  presetId: string

  forceNewThread: true

  threadId: null

}



/** Client: preset chip while a flow is active requires confirmation before fork. */

export function shouldConfirmPresetChipStart(

  session: HubStudioSession | null | undefined,

  presetId: string

): boolean {

  return Boolean(presetId.trim()) && isActiveStudioFlow(session)

}



/** Client: natural-language switch while active returns the target preset or null. */

export function shouldConfirmMessageFlowSwitch(

  session: HubStudioSession | null | undefined,

  message: string

): string | null {

  if (!isActiveStudioFlow(session)) return null

  return detectStudioFlowSwitch(message, session!.presetId)

}



/** Payload the client sends after the user confirms the new-flow dialog. */

export function buildConfirmedNewFlowStartRequest(

  presetId: string

): StudioNewFlowStartRequest {

  return {

    action: 'start_preset',

    presetId,

    forceNewThread: true,

    threadId: null,

  }

}



function isCompactFlowIntentMessage(message: string): boolean {

  return message.length <= MAX_COMPACT_FLOW_INTENT_LEN && !/[\n\r]/.test(message)

}



/**

 * Detect a request to start another Studio project.

 * The result is a proposal for confirmation and never mutates the active session.

 */

export function detectStudioFlowSwitch(

  message: string,

  currentPresetId: string | null | undefined

): string | null {

  const trimmed = message.trim()

  if (!trimmed || !currentPresetId) return null



  const matched = matchStudioPresetWithScore(trimmed)

  if (!matched || matched.preset.id === currentPresetId) return null



  const hasExplicitSwitch =

    EXPLICIT_FLOW_SWITCH.test(trimmed) || START_FLOW_REQUEST.test(trimmed)

  const isCompactIntent = isCompactFlowIntentMessage(trimmed)



  if (hasExplicitSwitch) return matched.preset.id

  if (isCompactIntent && matched.score >= MIN_COMPACT_FLOW_MATCH_SCORE) {

    return matched.preset.id

  }



  return null

}

