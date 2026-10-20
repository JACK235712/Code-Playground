import type { Problem, Signal } from './problems'

export type LangId = 'cpp' | 'java' | 'python'

/** 剥掉注释后的源码里，某种结构是否存在 */
export type SignalProbe = (code: string) => boolean

const re = (pattern: RegExp): SignalProbe => (code) => pattern.test(code)
const reAtLeast = (pattern: RegExp, times: number): SignalProbe => (code) => {
  const hits = code.match(new RegExp(pattern.source, 'g'))
  return hits !== null && hits.length >= times
}

const ACCUMULATE = /(^|[^\w)])\w+\s*(\+=|-=|\*=)|\w+\s*=\s*\w+\s*\+\s*\w+/
const INDEX = /\w+\s*\[\s*\w*\s*\]/

export type LanguageSpec = {
  id: LangId
  label: string
  fileName: string
  lineComment: string
  indent: string
  stripComments: (source: string) => string
  template: (problem: Problem) => string
  has: Record<Signal, SignalProbe>
}

function commentLines(problem: Problem, token: string, pad: string): string {
  const lines = [`${token} 请在下方编写代码`]
  problem.goals.forEach((goal, i) => lines.push(`${token} 目标 ${i + 1}：${goal}`))
  return lines.map((line) => pad + line).join('\n')
}

const stripLineAndBlockComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '')

const stripHashComments = (source: string) => source.replace(/#[^\n]*/g, '')

export const LANGUAGES: Record<LangId, LanguageSpec> = {
  cpp: {
    id: 'cpp',
    label: 'C++',
    fileName: 'main.cpp',
    lineComment: '//',
    indent: '    ',
    stripComments: stripLineAndBlockComments,
    template: (problem) =>
      `#include <iostream>\nusing namespace std;\n\nint main() {\n${commentLines(problem, '//', '    ')}\n\n    return 0;\n}\n`,
    has: {
      print: re(/\bcout\s*</),
      loop: re(/\bfor\s*\(/),
      nestedLoop: reAtLeast(/\bfor\s*\(/, 2),
      condition: re(/\bif\s*\(/),
      accumulate: re(ACCUMULATE),
      array: re(INDEX),
      function: re(/\b\w[\w:<>*&\s]*\b\w+\s*\([^;{]*\)\s*(const\s*)?\{/),
    },
  },
  java: {
    id: 'java',
    label: 'Java',
    fileName: 'Main.java',
    lineComment: '//',
    indent: '    ',
    stripComments: stripLineAndBlockComments,
    template: (problem) =>
      `public class Main {\n    public static void main(String[] args) {\n${commentLines(problem, '//', '        ')}\n    }\n}\n`,
    has: {
      print: re(/System\s*\.\s*out\s*\.\s*print/),
      loop: re(/\bfor\s*\(/),
      nestedLoop: reAtLeast(/\bfor\s*\(/, 2),
      condition: re(/\bif\s*\(/),
      accumulate: re(ACCUMULATE),
      array: re(INDEX),
      function: re(/\b(static|public|private)\b[^;{()]*\([^;{()]*\)\s*\{/),
    },
  },
  python: {
    id: 'python',
    label: 'Python',
    fileName: 'main.py',
    lineComment: '#',
    indent: '    ',
    stripComments: stripHashComments,
    template: (problem) => `${commentLines(problem, '#', '')}\n`,
    has: {
      print: re(/\bprint\s*\(/),
      loop: re(/\bfor\b[^\n]*\bin\b/),
      nestedLoop: reAtLeast(/\bfor\b[^\n]*\bin\b/, 2),
      condition: re(/\bif\b[^\n]*:/),
      accumulate: re(ACCUMULATE),
      array: re(INDEX),
      function: re(/\bdef\s+\w+\s*\(/),
    },
  },
}

export const LANG_ORDER: LangId[] = ['cpp', 'java', 'python']

export function initialCode(langId: LangId, problem: Problem): string {
  return LANGUAGES[langId].template(problem)
}

/** 无限循环的写法：演示 2 秒看门狗用 */
export const INFINITE_PATTERNS: Record<LangId, RegExp> = {
  cpp: /while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;/,
  java: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;/,
  python: /while\s+(True|1)\s*:/,
}

export function isCommentOnly(langId: LangId, source: string): boolean {
  const bare = LANGUAGES[langId].stripComments(source)
  return bare.trim().length === 0
}
