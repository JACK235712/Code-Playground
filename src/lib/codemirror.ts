import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { LangId } from '../data/languages'

/**
 * 语法解析器只允许从这里的引用进入组件：data/languages.ts 首页也会用来显示语言标签，
 * 一旦它 import @codemirror/lang-*，Rollup 就把整份题库归到共享 chunk，首页被迫多下 600KB 编辑器内核。
 */
export const LANG_PARSER: Record<LangId, () => Extension> = { cpp, java, python }

const FONT = '"Cascadia Code", "JetBrains Mono", Consolas, ui-monospace, monospace'

/** 与全站墨蓝烫金一致的深色主题：直接接管背景/光标/行号，不依赖 CodeMirror 内置主题 */
export const cpNeonTheme = EditorView.theme(
  {
    '&': {
      color: '#DCE3F5',
      backgroundColor: '#080C1A',
      fontSize: '13px',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: FONT, lineHeight: '22px', overflow: 'auto' },
    '.cm-content': { caretColor: '#2DE2E6', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#2DE2E6', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#232C52',
    },
    '.cm-activeLine': { backgroundColor: '#111731' },
    '.cm-gutters': {
      backgroundColor: '#080C1A',
      color: '#3A4468',
      border: 'none',
      minWidth: '2.75rem',
    },
    '.cm-activeLineGutter': { backgroundColor: '#111731', color: '#2DE2E6' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 14px' },
    '.cm-line': { padding: '0 14px 0 4px' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: '#2DE2E626',
      color: '#2DE2E6',
      outline: 'none',
    },
  },
  { dark: true },
)

export const cpNeonHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#4B5571', fontStyle: 'italic' },
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword],
    color: '#9B5CFF',
  },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#A6FF57' },
  { tag: t.number, color: '#FFC94D' },
  { tag: [t.bool, t.null, t.atom], color: '#FF9D5C' },
  { tag: [t.function(t.variableName), t.className, t.self], color: '#2DE2E6' },
  { tag: t.definition(t.variableName), color: '#7FD8FF' },
  { tag: t.propertyName, color: '#B8C4E8' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: '#6B77A0' },
  { tag: t.variableName, color: '#DCE3F5' },
])

/** 传给 <CodeMirror extensions={...} />；主题走 theme={cpNeonTheme} 属性，缩进跟着语言走 */
export const editorExtensions = [syntaxHighlighting(cpNeonHighlight), EditorView.lineWrapping]
