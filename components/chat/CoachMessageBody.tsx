'use client'

import type { ReactNode } from 'react'

interface CoachMessageBodyProps {
  content: string
  role: 'user' | 'ai'
}

type MessageBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }

function normalizeCoachMessage(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\s*(\*\*[^*\n]+:\*\*)\s*/g, '\n$1\n')
    .replace(/\s\*\s+/g, '\n* ')
    .replace(/(?<!\n)\s(?=\d+\.\s)/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseMessageBlocks(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  const lines = content.split('\n').map((line) => line.trim())

  for (let index = 0; index < lines.length;) {
    const line = lines[index]

    if (!line) {
      index += 1
      continue
    }

    if (line.startsWith('* ') || line.startsWith('- ')) {
      const items: string[] = []
      while (index < lines.length) {
        const current = lines[index].trim()
        if (!current.startsWith('* ') && !current.startsWith('- ')) break
        items.push(current.replace(/^[-*]\s+/, '').trim())
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (index < lines.length) {
        const current = lines[index].trim()
        if (!/^\d+\.\s/.test(current)) break
        items.push(current.replace(/^\d+\.\s+/, '').trim())
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    blocks.push({ type: 'paragraph', content: line })
    index += 1
  }

  return blocks
}

function renderInlineFormatting(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part, index) => {
      const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
      if (boldMatch) {
        return (
          <strong key={`bold-${index}`} className="font-semibold text-current">
            {boldMatch[1]}
          </strong>
        )
      }

      return <span key={`text-${index}`}>{part}</span>
    })
}

function Paragraph({ content }: { content: string }) {
  const headingMatch = content.match(/^\*\*([^*]+)\*\*$/)

  if (headingMatch) {
    return <p className="font-semibold text-current">{headingMatch[1]}</p>
  }

  return <p className="whitespace-pre-wrap break-words">{renderInlineFormatting(content)}</p>
}

export default function CoachMessageBody({ content, role }: CoachMessageBodyProps) {
  if (role === 'user') {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  const blocks = parseMessageBlocks(normalizeCoachMessage(content))

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'unordered-list') {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 marker:text-[#8A8A85]">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-item-${itemIndex}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5 marker:text-[#8A8A85]">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-item-${itemIndex}`}>{renderInlineFormatting(item)}</li>
              ))}
            </ol>
          )
        }

        return <Paragraph key={`p-${index}`} content={block.content} />
      })}
    </div>
  )
}
