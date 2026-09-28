import React from 'react'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = '' }) => {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let inTable = false
  let tableRows: string[][] = []
  let inList = false
  let listItems: string[] = []

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0]
      const dataRows = tableRows.slice(1).filter((r) => !r.every((c) => c.match(/^[:\-\s]+$/)))
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded border border-line/40">
          <table className="w-full text-left text-body-xs">
            {headerRow && (
              <thead className="border-b border-line/40 bg-sunken/60 text-ink-dim">
                <tr>
                  {headerRow.map((cell, idx) => (
                    <th key={idx} className="px-3 py-2 font-semibold">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-line/30 bg-panel/30">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-raised/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-ink">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      inTable = false
    }
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1.5 pl-4 text-body-sm text-ink-dim list-disc">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      listItems = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Table row detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (inList) flushList()
      inTable = true
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      tableRows.push(cells)
      continue
    } else if (inTable) {
      flushTable()
    }

    // List item detection
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true
      listItems.push(trimmed.slice(2))
      continue
    } else if (trimmed.match(/^\d+\.\s+/)) {
      if (inTable) flushTable()
      if (inList) flushList()
      const text = trimmed.replace(/^\d+\.\s+/, '')
      elements.push(
        <div key={`ol-${i}`} className="my-1.5 flex items-start gap-2 text-body-sm text-ink-dim leading-relaxed">
          <span className="font-mono text-label-micro text-primary font-semibold shrink-0 mt-0.5">
            {trimmed.match(/^\d+\./)?.[0]}
          </span>
          <span className="flex-1">{renderInline(text)}</span>
        </div>
      )
      continue
    } else if (inList) {
      flushList()
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="mt-4 mb-2 font-display text-headline-sm font-semibold tracking-tight text-ink border-b border-line/30 pb-2">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mt-4 mb-2 font-display text-body-lg font-semibold tracking-tight text-ink flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {renderInline(trimmed.slice(3))}
        </h2>
      )
      continue
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="mt-3 mb-1 text-body-base font-semibold text-primary">
          {renderInline(trimmed.slice(4))}
        </h3>
      )
      continue
    }

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className="my-3 border-line/40" />)
      continue
    }

    // Empty lines
    if (!trimmed) {
      continue
    }

    // Paragraph
    elements.push(
      <p key={i} className="my-1.5 text-body-sm leading-relaxed text-ink-dim">
        {renderInline(line)}
      </p>
    )
  }

  if (inTable) flushTable()
  if (inList) flushList()

  return <div className={`space-y-1 select-text ${className}`}>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  // Simple token parser for **bold**, *italic*, and `code`
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    const codeMatch = remaining.match(/`(.+?)`/)
    const italicMatch = remaining.match(/\*(.+?)\*/)

    let earliestIdx = remaining.length
    let matchType: 'bold' | 'code' | 'italic' | null = null
    let matchStr = ''
    let innerStr = ''

    if (boldMatch && boldMatch.index !== undefined && boldMatch.index < earliestIdx) {
      earliestIdx = boldMatch.index
      matchType = 'bold'
      matchStr = boldMatch[0]
      innerStr = boldMatch[1]
    }
    if (codeMatch && codeMatch.index !== undefined && codeMatch.index < earliestIdx) {
      earliestIdx = codeMatch.index
      matchType = 'code'
      matchStr = codeMatch[0]
      innerStr = codeMatch[1]
    }
    if (italicMatch && italicMatch.index !== undefined && italicMatch.index < earliestIdx && matchType !== 'bold') {
      earliestIdx = italicMatch.index
      matchType = 'italic'
      matchStr = italicMatch[0]
      innerStr = italicMatch[1]
    }

    if (matchType && earliestIdx < remaining.length) {
      if (earliestIdx > 0) {
        parts.push(remaining.substring(0, earliestIdx))
      }
      if (matchType === 'bold') {
        parts.push(
          <strong key={keyIdx++} className="font-semibold text-ink">
            {innerStr}
          </strong>
        )
      } else if (matchType === 'code') {
        parts.push(
          <code key={keyIdx++} className="rounded bg-sunken/80 px-1 py-0.5 font-mono text-label-micro text-primary border border-line/30">
            {innerStr}
          </code>
        )
      } else if (matchType === 'italic') {
        parts.push(
          <em key={keyIdx++} className="italic text-ink-faint">
            {innerStr}
          </em>
        )
      }
      remaining = remaining.substring(earliestIdx + matchStr.length)
    } else {
      parts.push(remaining)
      break
    }
  }

  return <>{parts}</>
}
