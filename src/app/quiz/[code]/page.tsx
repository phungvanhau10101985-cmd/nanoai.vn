import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import QuizJoinClient from './quiz-join-client'

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  return {
    title: `Trắc nghiệm - ${params.code}`,
    description: 'Làm bài trắc nghiệm tại chỗ',
  }
}

export default async function QuizJoinPage({ params }: { params: { code: string } }) {
  const code = params.code?.toUpperCase()
  if (!code) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <QuizJoinClient code={code} />
      </div>
    </div>
  )
}
