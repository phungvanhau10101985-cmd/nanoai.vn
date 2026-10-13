import assert from 'node:assert/strict'
import test from 'node:test'
import { attachHomeworkTags } from '@/lib/homework-help/homework-help-tags'
import type { HomeworkProblem } from '@/lib/homework-help/homework-help-guide'

const SAVED = [
  { topicKey: 'dinh-ly-pytago', title: 'Định lý Pytago' },
  { topicKey: 'pythagorean-theorem', title: 'Định lý Pytago' },
]

function problem(partial: Partial<HomeworkProblem> & Pick<HomeworkProblem, 'statement'>): HomeworkProblem {
  return {
    knowledge: [],
    thinking: [],
    hints: [],
    answer: '',
    tags: [],
    ...partial,
  }
}

test('a homework tag reuses the saved tutor topic', () => {
  const tags = attachHomeworkTags(
    problem({
      statement: 'Tính cạnh huyền',
      tags: [{ key: 'pythagorean-theorem', title: 'Định lý Pytago' }],
    }),
    SAVED
  )
  assert.deepEqual(tags, [{ key: 'dinh-ly-pytago', title: 'Định lý Pytago' }])
})

test('knowledge lines become tags when the model sent none', () => {
  const tags = attachHomeworkTags(
    problem({
      statement: 'Giải 2x + 3 = 7',
      knowledge: ['Phương trình bậc nhất'],
    }),
    []
  )
  assert.deepEqual(tags, [{ key: 'phuong-trinh-bac-nhat', title: 'Phương trình bậc nhất' }])
})

test('a saved title wins over a knowledge line with the same name', () => {
  const tags = attachHomeworkTags(
    problem({
      statement: 'Tính cạnh huyền',
      knowledge: ['Định lý Pytago'],
    }),
    SAVED
  )
  assert.equal(tags[0]?.key, 'dinh-ly-pytago')
})
