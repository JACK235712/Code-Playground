/**
 * 对战舱解说的调度：本地台词先上屏，模型的那句随后覆盖。
 *
 * 顺序是反不得的——大模型有延迟还会失败，所以每一句都由调用处自带一句确定性的兜底，
 * 拿到模型的回话才换掉。换句子靠 nonce 递增，气泡那头的打字机因此重新起播。
 * 同一秒内连着来两条（比如刚交卷就手速落后），旧请求会被 abort，
 * 只有最后那句还在屏上的播报能改写它，不会出现「先喊交卷、后插一句正在飞速输出」。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Opponent } from '../data/arena'
import { CAST, ghostCharMs, ghostSpeedLabel } from '../data/ghost'
import type { Problem } from '../data/problems'
import { casterNeedsModel, requestCasterLine } from '../lib/aiCaster'
import type { CasterEvent } from '../lib/aiCaster'
import { getRankInfo, levelOf } from '../data/ranks'

export type CastLine = {
  text: string
  /** 每次播报递增，组件拿它当 key 让打字机重播 */
  nonce: number
  /** true = 这句是大模型写的，气泡上要标出来 */
  fromModel: boolean
}

export function useCaster(opponent: Opponent, problem: Problem) {
  const [cast, setCast] = useState<CastLine>(() => ({
    text: CAST.intro(problem, opponent.player),
    nonce: 0,
    fromModel: false,
  }))
  const nonce = useRef(0)
  const pending = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      pending.current?.abort('unmount')
      pending.current = null
    },
    [],
  )

  const say = useCallback(
    /** @param fallback 本地那句事实，先在屏上播，模型回来才换 */
    (event: CasterEvent, fallback: string) => {
      nonce.current += 1
      setCast({ text: fallback, nonce: nonce.current, fromModel: false })

      // 空手按运行、2 秒看门狗、开场介绍这类不必让模型开口：本地那句更准，也省 token
      if (!casterNeedsModel(event)) return

      pending.current?.abort('superseded')
      const ctrl = new AbortController()
      pending.current = ctrl

      const rank = getRankInfo(opponent.xp)
      void requestCasterLine(
        {
          event,
          opponent: opponent.player,
          rankName: rank.name,
          level: levelOf(opponent.xp),
          charMs: ghostCharMs(opponent.xp),
          speedLabel: ghostSpeedLabel(opponent.xp),
          problemTitle: problem.title,
          fact: fallback,
        },
        ctrl.signal,
      )
        .then((line) => {
          // 这条播报已经被更新的盖过去了，或者组件已经卸载，就别再改屏
          if (pending.current !== ctrl) return
          pending.current = null
          nonce.current += 1
          setCast({ text: line, nonce: nonce.current, fromModel: true })
        })
        .catch(() => {
          // 失败就让它播本地那句：兜底台词已经在屏上，不需要额外提示
        })
    },
    [opponent, problem],
  )

  return { cast, say }
}
