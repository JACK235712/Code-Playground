import { useMemo } from 'react'
import { EyeOff, Radio, Terminal } from 'lucide-react'
import { ghostCascadeRowSeconds } from '../../data/ghost'
import { LANGUAGES } from '../../data/languages'
import type { LangId } from '../../data/languages'
import { withAlpha } from '../../data/ranks'
import { cn } from '../../lib/cn'

/** 代码雨用的字符池：半角片假名 + 数字，黑客帝国那味儿，纯氛围所以整层 aria-hidden */
const GLYPHS = 'アカサタナハマヤラワンヲ0123456789<>/{}[]()=+*#$@%&'

const RAIN_COLS = 12

/**
 * 一屏宽铺 12 列雨帘，每列一串随机字、各自的速度和延迟。
 * 模块级生成一次：放进组件里就会每次渲染换一批字，看起来像闪烁而不是下雨。
 */
const RAIN = Array.from({ length: RAIN_COLS }, (_, i) => ({
  glyphs: Array.from({ length: 44 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('\n'),
  left: `${(i * 100) / RAIN_COLS}%`,
  duration: `${(5.5 + ((i * 7) % 5) * 1.4).toFixed(1)}s`,
  delay: `${(-((i * 1.7) % 6)).toFixed(1)}s`,
}))

/** 脱敏行不够这么多条就不值得滚：不够就整篇重复，够长了才看得出「瀑布」 */
const MIN_STRIP = 16

/**
 * 把脱敏行铺成一条能无缝循环的雨帘：整篇重复到至少 MIN_STRIP 行，再原样接一份。
 * 配合 translateY(-50%) 的 keyframes，滚完第一份正好接上第二份的开头，没有跳帧。
 * 用「整篇」而不是「目前打到的部分」当内容，行序和条数就在一局里固定，滚动不会中途抽动。
 */
function stripOf(masked: string[]) {
  if (!masked.length) return []
  const reps = Math.max(1, Math.ceil(MIN_STRIP / masked.length))
  const one = Array.from({ length: reps }, () => masked).flat()
  return [...one, ...one]
}

/**
 * 对手终端：一台独立的「黑底绿码」机器，左边你写，右边它写。
 *
 * 防抄袭是这扇窗的第一原则：递进来的每一行都已经过 maskGhostScript 打码，
 * 字母、数字、下划线、汉字全糊成 X▚*#%，只剩缩进和括号的形状。
 * 玩家能看清它写了几行、打到第几成、手速多快，就是抄不走任何一个能用的字符。
 * 整列按段位速度往上滚（黑客帝国那种瀑布），段位越高滚得越凶。
 */
export function GhostWindow({
  name,
  rankName,
  rankColor,
  level,
  speedLabel,
  charMs,
  lang,
  masked,
  written,
  linesDone,
  pct,
  totalLines,
  started,
  done,
}: {
  name: string
  rankName: string
  /** 段位主题色：和名片、排行榜同一套，视窗里不用另一套颜色 */
  rankColor: string
  level: number
  /** 「极快 / 适中 / 极慢」那枚牌子，直接解释它为什么滚得这么快 */
  speedLabel: string
  charMs: number
  lang: LangId
  /** 整篇脱敏后的行：长度稳定，滚动循环才不会每打一行就抽一下 */
  masked: string[]
  /** 已经吐出来的行数（含空行）：比这个靠后的行还悬在半空，先压暗 */
  written: number
  /** 其中有内容的是几行，报给玩家看 */
  linesDone: number
  /** 打字进度，0–100 */
  pct: number
  totalLines: number
  started: boolean
  done: boolean
}) {
  const strip = useMemo(() => stripOf(masked), [masked])
  const cycle = strip.length / 2
  /** 循环一圈的秒数 = 一圈多少行 × 每行滚过去多久，每行多久由段位手速决定 */
  const seconds = Math.max(2.4, cycle * ghostCascadeRowSeconds(charMs))

  return (
    <section className="neon-frame h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-neon-lime/25 bg-[#01070b] shadow-[inset_0_0_70px_rgba(0,255,153,0.07)]">
        {/* 代码雨：一层竖排随机字从顶扫到底，交卷后压暗，别让雨抢了正片 */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700',
            done ? 'opacity-[0.10]' : started ? 'opacity-[0.30]' : 'opacity-[0.14]',
          )}
        >
          {RAIN.map((column) => (
            <span
              key={column.left}
              className="absolute top-0 whitespace-pre font-mono text-[11px] leading-[1.5] text-neon-lime [text-shadow:0_0_8px_rgba(0,255,153,0.65)]"
              style={{
                left: column.left,
                animation: `code-rain ${column.duration} linear ${column.delay} infinite`,
              }}
            >
              {column.glyphs}
            </span>
          ))}
        </div>
        {/* 扫描线：一层静态栅格 + 一条往下扫的光带 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,255,153,0.07) 0px, rgba(0,255,153,0.07) 1px, transparent 1px, transparent 3px)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-[14%] bg-gradient-to-b from-transparent via-neon-lime/15 to-transparent"
          style={{ animation: 'ghost-scan 2.8s linear infinite' }}
        />

        <header className="relative flex shrink-0 flex-wrap items-center gap-2 border-b border-neon-lime/25 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-neon-lime">
            <Terminal className="h-4 w-4" />
            <span className="max-w-[8rem] truncate">{name}</span>
          </span>
          {/* 段位牌用那一档的主题色，和名片、排行榜同一个来源 */}
          <span
            className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ring-1"
            style={{
              color: rankColor,
              backgroundColor: withAlpha(rankColor, '14'),
              borderColor: withAlpha(rankColor, '59'),
              textShadow: `0 0 10px ${withAlpha(rankColor, '66')}`,
            }}
          >
            {rankName} · Lv.{level}
          </span>
          {/* 手速是这扇窗最该看清的一个数：段位决定它，它决定对战难度 */}
          <span className="rounded-md bg-neon-amber/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-neon-amber ring-1 ring-neon-amber/30">
            {speedLabel} · 每字 {charMs}ms
          </span>
          {started && !done && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-neon-cyan">
              <Radio className="h-3 w-3 animate-pulse" />
              输出 {pct}% · {linesDone}/{totalLines} 行
            </span>
          )}
          {done && <span className="font-mono text-[10px] font-bold text-neon-cyan">已交卷 · {totalLines} 行</span>}
          <span className="ml-auto flex gap-1" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-neon-pink/70" />
            <span className="h-2 w-2 rounded-full bg-neon-amber/70" />
            <span className={cn('h-2 w-2 rounded-full', started ? 'bg-neon-lime' : 'bg-slate-600')} />
          </span>
        </header>

        {/* 钉死的一行命令头：告诉学生这扇窗在放什么，以及为什么读不懂 */}
        <div className="relative shrink-0 px-3 pb-1 pt-2">
          <p className="font-mono text-[11px] text-neon-lime/70">
            $ live --tty {LANGUAGES[lang].fileName} --rank {rankName} --speed {charMs}ms --mask on
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
            <EyeOff className="h-3 w-3 shrink-0 text-neon-pink" />
            源码已脱敏 · 只报行数与进度，抄不到一个可用字符
          </p>
        </div>

        <div aria-hidden="true" className="relative min-h-0 flex-1 overflow-hidden">
          {started ? (
            <div
              className="absolute inset-x-0 top-0 will-change-transform"
              style={{
                animation: `ghost-cascade ${seconds.toFixed(2)}s linear infinite`,
                // 交卷就停笔：雨帘定住，比继续滚更诚实
                animationPlayState: done ? 'paused' : 'running',
              }}
            >
              {strip.map((line, i) => {
                /**
                 * 取模用「原篇行数」而不是「半条雨帘的行数」：雨帘是把整篇重复了好几份接起来的，
                 * 按原篇取模，每一份的同一行亮不亮才一致——不然只有头一份会跟着进度变亮，
                 * 后面几份永远压着暗，滚起来像一截亮带子飘过去。
                 */
                const row = i % masked.length
                // 还没落笔的那几行压暗；写完就整体定住，不再区分
                const pending = !done && row + 1 > written
                return (
                  <div key={i} className="flex gap-2.5 px-3 font-mono text-xs leading-[22px]">
                    <span className="w-5 shrink-0 select-none text-right text-neon-lime/30">
                      {String(row + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 whitespace-pre tracking-wide text-neon-lime transition-opacity duration-500 [text-shadow:0_0_6px_rgba(0,255,153,0.45)]',
                        pending ? 'opacity-25' : done ? 'opacity-70' : 'opacity-90',
                      )}
                    >
                      {line === '' ? ' ' : line}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="flex h-full items-center justify-center gap-2 font-mono text-xs text-neon-lime/60">
              {name} 登录中
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-lime"
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                ))}
              </span>
            </p>
          )}
          {/* 上下各压一道渐隐，滚动内容像从屏幕外进来、又出去 */}
          <span className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#01070b] to-transparent" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#01070b] to-transparent" />
        </div>

        {/* 逐字内容对读屏是噪音，而且本来就是马赛克，这里只给一句结论 */}
        <p className="sr-only">
          {done
            ? `对手 ${name} 已交卷，共 ${totalLines} 行，源码已脱敏。`
            : started
              ? `对手 ${name} 正在写代码，已完成 ${pct}%，源码已脱敏。`
              : `对手 ${name} 正在就位，还没开始写。`}
        </p>
      </div>
    </section>
  )
}
