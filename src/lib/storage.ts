/**
 * LocalStorage 可能被整个禁用（无痕模式、企业策略），也可能塞进坏数据，
 * 所以每一次读写都要兜底——这几个函数是账号层和数据层唯一的存储入口。
 * 业务代码用 readJson/writeJson；readRaw 只给调试日志看原文。
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 原样读一个键，不解 JSON：排查「里面到底存了什么」时用 */
export function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* 存储不可用时没什么可清的 */
  }
}
