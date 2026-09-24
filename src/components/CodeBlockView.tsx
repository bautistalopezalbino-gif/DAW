import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { CODE_LANGUAGES } from '../lib/codeLanguages'

export default function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const language: string = node.attrs.language || 'plaintext'

  async function copy() {
    await navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <NodeViewWrapper className="code-block not-prose">
      <div className="code-block-bar" contentEditable={false}>
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200 outline-none"
        >
          {CODE_LANGUAGES.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button onClick={copy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre>
        <NodeViewContent<'code'> as="code" className={`hljs language-${language}`} />
      </pre>
    </NodeViewWrapper>
  )
}
