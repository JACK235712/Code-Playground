import type { LangId } from './languages'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type { LangId }

/** 模拟运行时要在学生源码里探测到的结构信号 */
export type Signal =
  | 'print'
  | 'loop'
  | 'nestedLoop'
  | 'condition'
  | 'accumulate'
  | 'array'
  | 'function'

/** 一条模拟规则：信号齐了 && 源码含这些字面量，就产出对应的输出行 */
export type SimRule = { need?: Signal[]; text?: string[]; out: string[] }

export type Problem = {
  id: string
  chapter: string
  title: string
  difficulty: Difficulty
  stars: number
  minutes: number
  players: string
  tags: string[]
  description: string
  goals: string[]
  hint: string
  hintExtra: string
  rewardCoins: number
  rewardXp: number
  /** 运行结果里必须出现这些片段才算通关 */
  expectIncludes: string[]
  /**
   * 标准答案的预期输出，一行一条（换行分隔）。
   * 判题引擎拿它逐行比对模拟输出：少一行就是没通关，多打印几行不算错。
   * 它同时也是「通过时控制台里该出现的东西」，所以每一行都必须能由下面某条 sim 规则产出。
   */
  expectedOutput: string
  /**
   * 禁用错词：输出可能碰巧对、但逻辑一定错的写法。
   * 比对前会把源码剥掉注释再抹掉所有空白，所以这里一律写成不带空格的形式，
   * 例如 'fact=0'、'i<n'、'if(n%3==0&&n%5==0)'，学生写成 'fact = 0' 也一样命中。
   * 登记前先用单测 (.scratch-battle/judge.test.ts) 验两件事：
   * 这门语言的起手模板不该命中，本题的 solutionCode 三个语言都不该命中。
   */
  forbiddenKeywords: string[]
  sim: SimRule[]
  /** 这道题更适合哪门语言（选中它时编辑器自动切过去） */
  suggestLang?: LangId
  /**
   * 只有中等题要看这一位：true = 「高难度中等」（滑动窗口、双指针、简单 DP 这一档）。
   * 抽题规则 C 要求每批 2 道中等里至少 1 道来自它，所以新题请务必标对：
   * 纯语法组合、单层循环 + 数组的是 false（不写也一样），要玩家真的想一步算法的才写 true。
   */
  advanced?: boolean
  /**
   * 备用题：正常抽题永远不碰它，也不计入题池的「还剩几道」。
   * 只有某个难度把排除记录重置之后仍然凑不满名额时，它才会顶上那一个空位。
   */
  backup?: boolean
  /**
   * 标准答案，竞技场幽灵替身逐字打的就是它。
   * 只登记了部分题目：对战抽题会先过滤掉缺语言的题，所以没写答案的题永远不会进对战舱。
   * 写新答案时记住两件事——它得是真能跑对的代码，而且要让 simulateRun 的信号探测
   * 命中 expectIncludes（模拟判题看的是结构 + 源码字面量，不是真的执行）。
   */
  solutionCode?: Partial<Record<LangId, string>>
}

/** 三语答案齐全，才够格进对战舱当幽灵的脚本 */
export function hasFullSolution(problem: Problem): boolean {
  return Boolean(problem.solutionCode?.cpp && problem.solutionCode.java && problem.solutionCode.python)
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export const DIFFICULTY_ACCENT: Record<Difficulty, string> = {
  easy: 'text-neon-lime',
  medium: 'text-neon-amber',
  hard: 'text-neon-pink',
}

/**
 * 题库约定（新增题目请照做）：
 * 1. description 的篇幅跟难度挂钩：简单题一句话说清，中等题给背景 + 输入输出 + 边界，困难题给完整业务场景 + 约束 + 性能要求。
 * 2. expectIncludes 里的每个片段，必须能被下面某条 sim 规则的 out 产出，否则这道题永远过不了。
 * 3. sim 规则按「先易后难」排列：第一条只要基本结构就给输出，后面的规则奖励更完整的解法。
 * 4. expectedOutput 取「覆盖到最后一个 expectIncludes 片段」的那几条规则的 out，
 *    后面的进度回执行不算通关条件；判题引擎（src/lib/ruleJudge.ts）拿它逐行核对模拟输出。
 * 5. sim 只看结构信号 + 源码字面量，不真的执行，所以「逻辑写错、输出碰巧对」它一定放行。
 *    这种题只能靠 forbiddenKeywords 兜网：把该题典型的错误写法登记进去，引擎先剥注释再抹空白比对。
 * 6. 禁用词写完必须过单测 .scratch-battle/judge.test.ts：三门语言的起手模板、以及 solutionCode
 *    的每一种语言都不能命中，否则就是误杀。
 * 7. 题库规模目标见下面的 POOL_TARGET（75 道 = 25 简单 + 25 中等 + 25 困难，其中中等再拆成
 *    10 道普通 + 15 道高难度 advanced: true）。星级用来在同一难度里排序，也直接画在题池卡片上：
 *    简单 1~2 星、普通中等 3 星、高难度中等 4 星、困难 5 星。
 * 8. 新题只要 difficulty / advanced / backup 填对，抽题算法（src/data/drawLog.ts）就会自动把它
 *    算进对应池子，不需要再改任何别的地方；expectedOutput + forbiddenKeywords 填上，
 *    判题引擎（src/lib/ruleJudge.ts）也直接生效。
 */
export const PROBLEMS: Problem[] = [
  {
    id: 'p1',
    chapter: '第一章 · 语法丛林',
    title: '新手试炼：生成你的第一段代码',
    difficulty: 'easy',
    stars: 1,
    minutes: 8,
    players: '3.4k',
    tags: ['输出', '循环'],
    description: '打印 "Hello, Code Playground!"，再用循环算出 1 到 100 的和。',
    goals: [
      '让运行结果出现 Hello, Code Playground!',
      '让运行结果出现 5050（1 到 100 的和）',
    ],
    hint: '循环条件可以从 1 开始哦。',
    hintExtra: '第二个目标：先准备一个装着结果的盒子，每次把新的数放进去就好。',
    rewardCoins: 80,
    rewardXp: 40,
    expectIncludes: ['Hello, Code Playground!', '5050'],
    expectedOutput: 'Hello, Code Playground!\n1 到 100 的和 = 5050',
    forbiddenKeywords: ['i<100', 'i<=99', 'range(1,100)', 'range(100)', '=5050'],
    sim: [
      { need: ['print'], text: ['Hello, Code Playground!'], out: ['Hello, Code Playground!'] },
      {
        need: ['print', 'loop', 'accumulate'],
        text: ['100'],
        out: ['1 到 100 的和 = 5050'],
      },
    ],
  },
  {
    id: 'p2',
    chapter: '第一章 · 语法丛林',
    title: '偶数传送带',
    difficulty: 'easy',
    stars: 1,
    minutes: 6,
    players: '2.1k',
    tags: ['循环', '取余'],
    description: '把 1 到 10 的偶数打印在同一行：2 4 6 8 10。',
    goals: ['让运行结果出现 2 4 6 8 10'],
    hint: '能不能只挑出「除以 2 余 0」的那些数？',
    hintExtra: '或者干脆让计数器一次跳两格，从 2 开始。',
    rewardCoins: 60,
    rewardXp: 30,
    expectIncludes: ['2 4 6 8 10'],
    expectedOutput: '2 4 6 8 10',
    forbiddenKeywords: ['i<10', 'i<=9', 'range(2,10)', 'range(2,9)', '"246810"'],
    sim: [{ need: ['print', 'loop'], text: ['10'], out: ['2 4 6 8 10'] }],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    // 计数器一次跳两格，末尾补换行
    for (int i = 2; i <= 10; i += 2) {
        cout << i << (i == 10 ? "\\n" : " ");
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        // 先拼成一行，再一次打印
        StringBuilder line = new StringBuilder();
        for (int i = 2; i <= 10; i += 2) line.append(i).append(' ');
        System.out.println(line.toString().trim());
    }
}
`,
      python: `# 上限写成 10，别写成 11 少打一个数
N = 10
evens = [str(i) for i in range(2, N + 1, 2)]
print(" ".join(evens))
`,
    },
  },
  {
    id: 'p10',
    chapter: '第一章 · 语法丛林',
    title: '火箭发射倒计时',
    difficulty: 'easy',
    stars: 1,
    minutes: 6,
    players: '2.9k',
    tags: ['循环', '输出'],
    description: '用循环从 3 倒数到 1，再打印一句「发射！」。',
    goals: ['让运行结果出现 3 2 1', '让运行结果出现 发射！'],
    hint: '倒数也是循环——只是每圈让计数器变小一点。',
    hintExtra: '倒数和「发射！」分成两句打印，别硬塞进循环里。',
    rewardCoins: 60,
    rewardXp: 30,
    expectIncludes: ['3 2 1', '发射！'],
    expectedOutput: '3 2 1\n发射！ 🚀',
    forbiddenKeywords: ['i>=3', 'i>1', 'i++', 'range(3,1,-1)', '"321"'],
    sim: [
      { need: ['print', 'loop'], text: ['3'], out: ['3 2 1'] },
      { need: ['print'], text: ['发射'], out: ['发射！ 🚀'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    // 倒数也是循环，只是每圈变小
    for (int i = 3; i >= 1; i -= 1) {
        cout << i << " ";
    }
    cout << endl << "发射！ 🚀" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        for (int i = 3; i >= 1; i -= 1) {
            System.out.print(i + " ");
        }
        System.out.println();
        System.out.println("发射！ 🚀");
    }
}
`,
      python: `# step 给 -1 就是倒数
for i in range(3, 0, -1):
    print(i, end=" ")
print()
print("发射！ 🚀")
`,
    },
  },
  {
    id: 'p3',
    chapter: '第一章 · 语法丛林',
    title: '成绩及格线',
    difficulty: 'easy',
    stars: 2,
    minutes: 7,
    players: '1.8k',
    tags: ['条件'],
    description: 'score = 72，及格打印「72 分：及格」，否则打印「72 分：再练练」。',
    goals: ['让运行结果出现 72 分：及格'],
    hint: '边界设在 60 分，想想它是「够到就算」还是「要超过才算」。',
    hintExtra: '先别管 else，把 if 里那一行写出来跑一次。',
    rewardCoins: 70,
    rewardXp: 35,
    expectIncludes: ['72 分：及格'],
    expectedOutput: '72 分：及格',
    forbiddenKeywords: ['score>60', 'score==60', 'score>72'],
    sim: [{ need: ['print', 'condition'], text: ['72'], out: ['72 分：及格'] }],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int score = 72;
    // 60 分本身算及格，所以是 >=
    if (score >= 60) {
        cout << "72 分：及格" << endl;
    } else {
        cout << "72 分：再练练" << endl;
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int score = 72;
        if (score >= 60) {
            System.out.println("72 分：及格");
        } else {
            System.out.println("72 分：再练练");
        }
    }
}
`,
      python: `score = 72
if score >= 60:
    print("72 分：及格")
else:
    print("72 分：再练练")
`,
    },
  },
  {
    id: 'p4',
    chapter: '第二章 · 变量之城',
    title: '自我介绍卡',
    difficulty: 'easy',
    stars: 2,
    minutes: 5,
    players: '2.6k',
    tags: ['变量', '输出'],
    description: '用两个变量存名字和年龄，打印成「我是 …」和「今年 … 岁」两行。',
    goals: ['让运行结果出现「我是」开头的一行', '让运行结果出现「岁」结尾的一行'],
    hint: '名字和年龄要不要各用一个变量，而不是写死在输出里？',
    hintExtra: '两行输出就是两句打印语句，别急着合并。',
    rewardCoins: 50,
    rewardXp: 25,
    expectIncludes: ['我是', '岁'],
    expectedOutput: '我是 未来的代码大师\n今年 18 岁',
    forbiddenKeywords: ['"我是未来的代码大师"', '"今年18岁"'],
    sim: [
      { need: ['print'], text: ['我是'], out: ['我是 未来的代码大师'] },
      { need: ['print'], text: ['岁'], out: ['今年 18 岁'] },
    ],
  },
  {
    id: 'p11',
    chapter: '第三章 · 循环竞技场',
    title: '找出最大那个数',
    difficulty: 'easy',
    stars: 2,
    minutes: 7,
    players: '2.2k',
    tags: ['数组', '循环'],
    description: '遍历 [4, 9, 6, 2]，打印出「最大值 = 9」。',
    goals: ['让运行结果出现 最大值 = 9'],
    hint: '先假设第一个数最大，再从第二个开始逐个比较。',
    hintExtra: '比较一次就更新一次盒子——别等到最后再回头看。',
    rewardCoins: 70,
    rewardXp: 35,
    expectIncludes: ['最大值 = 9'],
    expectedOutput: '最大值 = 9',
    forbiddenKeywords: ['best=9', 'max=9', '"最大值=9"', 'i<=4', 'range(1,5)'],
    sim: [
      { need: ['print', 'array', 'loop'], out: ['最大值 = 9'] },
      { need: ['print', 'array', 'loop', 'condition'], out: ['（比了 3 次，换掉 1 次）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int nums[4] = {4, 9, 6, 2};
    // 先假设第一个最大，再逐个挑战它
    int best = nums[0];
    for (int i = 1; i < 4; i += 1) {
        if (nums[i] > best) {
            best = nums[i];
        }
    }
    cout << "最大值 = " << best << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] nums = {4, 9, 6, 2};
        int best = nums[0];
        for (int i = 1; i < nums.length; i += 1) {
            if (nums[i] > best) best = nums[i];
        }
        System.out.println("最大值 = " + best);
    }
}
`,
      python: `nums = [4, 9, 6, 2]
best = nums[0]
for x in nums:
    if x > best:
        best = x
print("最大值 =", best)
`,
    },
  },
  {
    id: 'p12',
    chapter: '第五章 · 数据集市',
    title: '及格线统计员',
    difficulty: 'medium',
    stars: 3,
    minutes: 14,
    players: '1.3k',
    tags: ['数组', '循环', '条件'],
    description:
      '背景：班主任只给你一行成绩，你要在班会前口头汇报两个数。\n' +
      '输入：数组 [52, 76, 88, 44, 95, 65]，及格线 60 分（含 60）。\n' +
      '输出：先打印及格人数，格式「及格 4 人 · 不及格 2 人」；再打印平均分，格式「平均 70 分」。\n' +
      '边界：平均分只算整数部分，不做四舍五入；60 分本身算及格，别用 > 号。',
    goals: [
      '让运行结果出现 及格 4 人',
      '让运行结果出现 平均 70 分',
      '数组长度不要写死在循环里',
    ],
    hint: '人数和总分是两件事，能不能各用一个变量在同一个循环里攒着？',
    hintExtra: '先只算及格人数，跑通了再补总分——两个变量互不打扰。',
    rewardCoins: 160,
    rewardXp: 75,
    expectIncludes: ['及格 4 人', '平均 70 分'],
    expectedOutput: '及格 4 人 · 不及格 2 人\n平均 70 分（总分 420 ÷ 6 人）',
    forbiddenKeywords: [
      'score>60',
      's>60',
      'i<=6',
      'i<7',
      'count=4',
      'total=420',
      'avg=70',
      'average=70',
    ],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['60'],
        out: ['及格 4 人 · 不及格 2 人'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'accumulate'],
        out: ['平均 70 分（总分 420 ÷ 6 人）'],
      },
    ],
  },
  {
    id: 'p13',
    chapter: '第一章 · 语法丛林',
    title: '猜数字的小裁判',
    difficulty: 'medium',
    stars: 3,
    minutes: 13,
    players: '1.6k',
    tags: ['条件', '循环'],
    description:
      '背景：你要当裁判，替朋友判断他猜的数字离答案有多远。\n' +
      '输入：答案写死为 42，依次判断 25、58、42 这三个猜测。\n' +
      '输出：每个猜测各打印一行，格式「25 → 太小了」「58 → 太大了」「42 → 恭喜猜中！」。\n' +
      '边界：猜中和偏大偏小是互斥的三件事，所以「恭喜猜中」那一行必须在猜中时独占，不能跟着别的话一起出现。',
    goals: ['让运行结果出现 太小了', '让运行结果出现 太大了', '让运行结果出现 恭喜猜中'],
    hint: '三个猜测其实是同一套判断重复三次——循环是不是更省事？',
    hintExtra: '先把一个猜解说对，再想怎么让代码把这个判断复用三次。',
    rewardCoins: 150,
    rewardXp: 70,
    expectIncludes: ['太小了', '太大了', '恭喜猜中'],
    expectedOutput: '25 → 太小了\n58 → 太大了\n42 → 恭喜猜中！',
    forbiddenKeywords: [
      'answer=25',
      'answer=58',
      '"25→太小了"',
      '"58→太大了"',
      '"42→恭喜猜中',
      'guess==25||guess==58',
    ],
    sim: [
      {
        need: ['print', 'condition'],
        text: ['42'],
        out: ['25 → 太小了', '58 → 太大了', '42 → 恭喜猜中！'],
      },
      { need: ['print', 'condition', 'loop'], out: ['（第 3 次猜中，结束）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int answer = 42;
    int guesses[3] = {25, 58, 42};
    // 三个猜测是同一套判断，交给循环
    for (int i = 0; i < 3; i += 1) {
        int guess = guesses[i];
        if (guess < answer) {
            cout << guess << " → 太小了" << endl;
        } else if (guess > answer) {
            cout << guess << " → 太大了" << endl;
        } else {
            cout << guess << " → 恭喜猜中！" << endl;
        }
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int answer = 42;
        int[] guesses = {25, 58, 42};
        for (int guess : guesses) {
            if (guess < answer) {
                System.out.println(guess + " → 太小了");
            } else if (guess > answer) {
                System.out.println(guess + " → 太大了");
            } else {
                System.out.println(guess + " → 恭喜猜中！");
            }
        }
    }
}
`,
      python: `answer = 42
for guess in [25, 58, 42]:
    if guess < answer:
        print(f"{guess} → 太小了")
    elif guess > answer:
        print(f"{guess} → 太大了")
    else:
        print(f"{guess} → 恭喜猜中！")
`,
    },
  },
  {
    id: 'p5',
    chapter: '第二章 · 变量之城',
    title: '1 到 N 的阶乘',
    difficulty: 'medium',
    stars: 3,
    minutes: 12,
    players: '1.5k',
    tags: ['循环', '累乘'],
    description:
      '背景：递推是后面所有动态规划题的地基，先把它练熟。\n' +
      '输入：N = 5。\n' +
      '输出：打印「5! = 120」，即 1×2×3×4×5 的结果。\n' +
      '边界：N = 0 或 1 时结果是 1，所以存放结果的变量必须从 1 起步；从 0 起步会让整条乘链永远是 0。',
    goals: ['让运行结果出现 120', '结果的初始值不能是 0'],
    hint: '累乘的起始值要是 1，不是 0——猜猜为什么。',
    hintExtra: '循环里只做一件事：把盒子乘以当前这个数。',
    rewardCoins: 120,
    rewardXp: 60,
    expectIncludes: ['120'],
    expectedOutput: '5! = 120',
    forbiddenKeywords: ['fact=0', 'result=0', 'i<n', 'range(1,n)', 'range(1,5)', '=120'],
    sim: [{ need: ['print', 'loop', 'accumulate'], text: ['5'], out: ['5! = 120'] }],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int n = 5;
    // 累乘的盒子必须从 1 起步，从 0 起步整条链永远是 0
    long fact = 1;
    for (int i = 1; i <= n; i += 1) {
        fact *= i;
    }
    cout << n << "! = " << fact << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int n = 5;
        long fact = 1;
        for (int i = 1; i <= n; i += 1) {
            fact *= i;
        }
        System.out.println(n + "! = " + fact);
    }
}
`,
      python: `n = 5
fact = 1
for i in range(1, n + 1):
    fact *= i
print(f"{n}! = {fact}")
`,
    },
  },
  {
    id: 'p6',
    chapter: '第三章 · 循环竞技场',
    title: '九九乘法表 · 前 3 行',
    difficulty: 'medium',
    stars: 3,
    minutes: 15,
    players: '1.1k',
    tags: ['嵌套循环'],
    description:
      '背景：嵌套循环的第一道正式练习，重点是把「行」和「列」分开想。\n' +
      '输入：行号从 1 到 3；第 i 行里有 i 个算式，列号 j 从 1 走到 i。\n' +
      '输出：每行一行文本，算式之间空一格，例如「3×1=3 3×2=6 3×3=9」；最后一行必须以 3×3=9 收尾。\n' +
      '边界：只打印前 3 行，第 4 行开始不要输出；行内换行必须在外层循环结束时发生，而不是每算一句换一行。',
    goals: ['让运行结果出现 3×3=9', '用两层循环，不要手写三行字符串'],
    hint: '外层负责「第几行」，内层负责「这一行里有几列」。',
    hintExtra: '先只写外层，把每行该出现什么想清楚，再往里塞第二层。',
    rewardCoins: 150,
    rewardXp: 70,
    expectIncludes: ['3×3=9'],
    expectedOutput: '1×1=1\n2×1=2 2×2=4\n3×1=3 3×2=6 3×3=9',
    forbiddenKeywords: ['i<=1', 'i<=2', 'i<3', 'j<=1', 'range(1,3)', '"3×3=9"'],
    sim: [
      {
        need: ['print', 'nestedLoop'],
        out: ['1×1=1', '2×1=2 2×2=4', '3×1=3 3×2=6 3×3=9'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    // 外层管「第几行」，内层管「这一行几列」
    for (int i = 1; i <= 3; i += 1) {
        for (int j = 1; j <= i; j += 1) {
            cout << i << "×" << j << "=" << i * j << " ";
        }
        cout << endl;
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i += 1) {
            StringBuilder row = new StringBuilder();
            for (int j = 1; j <= i; j += 1) {
                row.append(i).append("×").append(j).append("=").append(i * j).append(" ");
            }
            System.out.println(row.toString().trim());
        }
    }
}
`,
      python: `for i in range(1, 4):
    row = []
    for j in range(1, i + 1):
        row.append(f"{i}×{j}={i * j}")
    print(" ".join(row))
`,
    },
  },
  {
    id: 'p14',
    chapter: '第二章 · 变量之城',
    title: '存钱罐的第十周',
    difficulty: 'medium',
    stars: 4,
    minutes: 16,
    players: '870',
    tags: ['循环', '累加', '条件'],
    description:
      '背景：从第 1 周开始存钱，第 1 周存 10 元，之后每一周比前一周多存 2 元。\n' +
      '输入：循环 10 次，第 n 周存 10 + (n-1)×2 元。\n' +
      '输出：打印两行——「第 10 周存 28 元」；以及「10 周共存了 190 元」。\n' +
      '边界：单周金额要在累加之前算出来，否则总数会把上一周的值重复计入；第 10 周必须正好是 28 元，多存或少存都说明递推的起点偏移了。',
    goals: ['让运行结果出现 第 10 周存 28 元', '让运行结果出现 190 元'],
    hint: '每周多存 2 元，这个「2」写在哪里才不会跟着周数一起乱跑？',
    hintExtra: '把「本周存多少」和「一共存了多少」当成两个变量，一个更新另一个累加。',
    rewardCoins: 170,
    rewardXp: 80,
    expectIncludes: ['第 10 周存 28 元', '190 元'],
    expectedOutput: '10 周共存了 190 元\n第 10 周存 28 元',
    forbiddenKeywords: ['week=28', '=190', '"10周共存了190元"', '10+i*2', 'week+=28'],
    sim: [
      {
        need: ['print', 'loop', 'accumulate'],
        text: ['10'],
        out: ['10 周共存了 190 元'],
      },
      {
        need: ['print', 'loop', 'accumulate', 'condition'],
        out: ['第 10 周存 28 元'],
      },
    ],
  },
  {
    id: 'p7',
    chapter: '第三章 · 循环竞技场',
    title: '数组去重擂台',
    difficulty: 'medium',
    stars: 4,
    minutes: 18,
    players: '980',
    tags: ['数组', '条件'],
    description:
      '背景：后台推来的埋点日志有重复，交上去之前要先清一遍。\n' +
      '输入：数组 [1, 2, 2, 3, 4, 4, 4, 5]。\n' +
      '输出：按原顺序打印去重结果「1 2 3 4 5」，再补一行「去掉 3 个重复」。\n' +
      '边界：顺序不能变（不能排序后去重）；重复 3 次只算去掉 2 次，所以计数要用「原长度 - 去重后长度」。',
    goals: ['让运行结果出现 1 2 3 4 5', '让运行结果出现「去掉 3 个重复」'],
    hint: '「前面有没有出现过」这个问题，能不能拿当前元素和它之前的每个元素比一次？',
    hintExtra: '先想怎么判断重复，再想怎么打印——两件事分开写。',
    rewardCoins: 180,
    rewardXp: 80,
    expectIncludes: ['1 2 3 4 5', '去掉 3 个重复'],
    expectedOutput: '1 2 3 4 5\n去掉 3 个重复',
    forbiddenKeywords: ['[1,2,3,4,5]', 'removed=3', 'sorted(', '.sort(', '"去掉3个重复"'],
    sim: [
      { need: ['print', 'loop', 'array'], out: ['1 2 3 4 5'] },
      { need: ['print', 'loop', 'array', 'condition'], out: ['去掉 3 个重复'] },
    ],
  },
  {
    id: 'p8',
    suggestLang: 'python',
    chapter: '第四章 · 图形工坊',
    title: '用代码画一个哆啦A梦',
    difficulty: 'hard',
    stars: 4,
    minutes: 25,
    players: '1.2k',
    tags: ['循环', '函数', '图形'],
    description:
      '背景：图形后端还没接上，这一关先考「把重复的东西抽成函数」的思维方式——绘制指令会被记录成运行回执。\n' +
      '输入：圆脸 1 个、铃铛 1 个、胡须 6 根（左右各 3 根，同一套几何参数镜像）。\n' +
      '输出：打印绘制回执，最后必须出现「🐱 哆啦A梦 绘制完成」。\n' +
      '算法约束：脸部轮廓和铃铛各自封成一个函数，胡须只允许一条循环指令，把 6 写进循环边界而不是重复调用 6 次；函数体内不得出现 print 之外的副作用。\n' +
      '性能要求：整份代码不超过 40 行；重复绘制的指令数即圆 + 铃铛 + 胡须 = 8 条，超过说明你没复用。\n' +
      '边界：胡须根数改成偶数也要能跑，所以别在循环里写死 3。',
    goals: ['写出至少一个自定义函数', '用循环画 6 根胡须', '让运行结果出现 绘制完成'],
    hint: '一根胡须和六根胡须，代码行数应该是一样的——这说明你该用循环。',
    hintExtra: '先把「画一个圆」封成函数，剩下的都是调用它。',
    rewardCoins: 300,
    rewardXp: 120,
    expectIncludes: ['哆啦A梦 绘制完成'],
    expectedOutput:
      '▶ 6 根胡须：重复绘制指令已提交\n▶ 圆脸 + 铃铛：函数化绘制已提交\n🐱 哆啦A梦 绘制完成',
    forbiddenKeywords: ['range(3)', 'range(1,4)', 'range(0,3)', 'i<3', 'i<=3'],
    sim: [
      { need: ['print', 'loop'], out: ['▶ 6 根胡须：重复绘制指令已提交'] },
      { need: ['print', 'loop', 'function'], out: ['▶ 圆脸 + 铃铛：函数化绘制已提交'] },
      {
        need: ['print', 'loop', 'function'],
        text: ['哆啦A梦'],
        out: ['🐱 哆啦A梦 绘制完成'],
      },
    ],
  },
  {
    id: 'p16',
    chapter: '第五章 · 数据集市',
    title: '优惠券结算台',
    difficulty: 'hard',
    stars: 4,
    minutes: 26,
    players: '640',
    tags: ['条件', '累加', '函数'],
    description:
      '背景：双十一零点，你的购物车结算服务要在大促流量里给出最终应付金额，规则由运营配置且随时可能改。\n' +
      '输入：三件商品价格 89、199、45；满减规则「满 300 减 30」；全场 9 折；运费规则「应付满 150 免运费，否则 +10 元」。\n' +
      '输出：依次打印「原价 333 元（89 + 199 + 45）」「满减后 303 元」「全场 9 折 → 272.7 元」「实付 273 元（已满 150，免运费）」。\n' +
      '算法约束：计价必须封成一个函数，输入是价格数组和规则参数，输出是最终金额；优惠顺序固定为「满减 → 折扣 → 运费」，顺序换了我们就要多付钱；判断满减用的是折前金额，不是最终金额。\n' +
      '性能要求：价格数组长度可变，函数只能在一次遍历里完成（O(n)），不允许嵌套循环；小数一律向上取整到整元（272.7 → 273）。\n' +
      '边界：总价正好 300 时满减要生效（含等号）；空购物车直接返回 0 元，不能报负数或崩溃。',
    goals: ['让运行结果出现 原价 333 元', '让运行结果出现 实付 273 元', '把计价写成一个函数'],
    hint: '三条规则是三段独立的 if，还是一个函数里的三次传递？',
    hintExtra: '先只算原价那一行，跑对了再把满减接上去——一次只动一条规则。',
    rewardCoins: 340,
    rewardXp: 170,
    expectIncludes: ['原价 333 元', '实付 273 元'],
    expectedOutput:
      '原价 333 元（89 + 199 + 45）\n满减后 303 元\n全场 9 折 → 272.7 元\n实付 273 元（已满 150，免运费）',
    forbiddenKeywords: ['=333', '=303', '=273', '=272.7', '>300', '>150'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'accumulate'],
        out: ['原价 333 元（89 + 199 + 45）'],
      },
      {
        need: ['print', 'array', 'loop', 'accumulate', 'condition'],
        text: ['300'],
        out: ['满减后 303 元'],
      },
      {
        need: ['print', 'function', 'condition'],
        out: ['全场 9 折 → 272.7 元', '实付 273 元（已满 150，免运费）'],
      },
    ],
  },
  {
    id: 'p9',
    chapter: '第四章 · 图形工坊',
    title: 'FizzBuzz 关卡门',
    difficulty: 'hard',
    stars: 5,
    minutes: 20,
    players: '760',
    tags: ['循环', '条件', '取余'],
    description:
      '背景：面试题库里出现频率最高的一道热身题，用来检查你的分支优先级。\n' +
      '输入：n 从 1 遍历到 15。\n' +
      '输出：3 的倍数说 Fizz，5 的倍数说 Buzz，同时是 3 和 5 的倍数说 FizzBuzz，其余说数字本身；运行结果里 Fizz、Buzz、FizzBuzz 三种都要出现。\n' +
      '算法约束：只允许一层循环，禁止为 Fizz 和 Buzz 各写一遍遍历；判断只能用取余，不许用字符串包含来蒙。\n' +
      '性能要求：15 个数只跑 15 次迭代，一次输出行数是 15。\n' +
      '边界：15 同时命中两个条件，若把「是 3 的倍数」放在最前面用 if 而不是 if-else，就会输出成 Fizz Buzz 两个词——那是这一关的失分点。',
    goals: ['让运行结果出现 Fizz', '让运行结果出现 Buzz', '让运行结果出现 FizzBuzz'],
    hint: '15 那个数会同时命中两个条件——你的分支顺序能处理它吗？',
    hintExtra: '先把最严格的那个条件放最前面，剩下的分支就不会互相抢话。',
    rewardCoins: 320,
    rewardXp: 150,
    expectIncludes: ['Fizz', 'Buzz', 'FizzBuzz'],
    expectedOutput: '1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz',
    forbiddenKeywords: ['n<=14', 'n<15', 'range(1,15)', 'n==15', '"12Fizz4Buzz"'],
    sim: [
      {
        need: ['print', 'loop', 'condition'],
        text: ['15'],
        out: ['1 2 Fizz 4 Buzz Fizz 7 8 Fizz Buzz 11 Fizz 13 14 FizzBuzz'],
      },
      { need: ['print', 'loop', 'condition', 'accumulate'], out: ['（共 15 行已输出）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int printed = 0;
    // 最严的条件放最前面，15 才不会被打成 Fizz Buzz 两个词
    for (int n = 1; n <= 15; n += 1) {
        if (n % 15 == 0) {
            cout << "FizzBuzz" << endl;
        } else if (n % 3 == 0) {
            cout << "Fizz" << endl;
        } else if (n % 5 == 0) {
            cout << "Buzz" << endl;
        } else {
            cout << n << endl;
        }
        printed += 1;
    }
    cout << "共 " << printed << " 行" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int printed = 0;
        for (int n = 1; n <= 15; n += 1) {
            if (n % 15 == 0) {
                System.out.println("FizzBuzz");
            } else if (n % 3 == 0) {
                System.out.println("Fizz");
            } else if (n % 5 == 0) {
                System.out.println("Buzz");
            } else {
                System.out.println(n);
            }
            printed += 1;
        }
        System.out.println("共 " + printed + " 行");
    }
}
`,
      python: `printed = 0
for n in range(1, 15 + 1):
    if n % 15 == 0:
        print("FizzBuzz")
    elif n % 3 == 0:
        print("Fizz")
    elif n % 5 == 0:
        print("Buzz")
    else:
        print(n)
    printed += 1
print(f"共 {printed} 行")
`,
    },
  },
  {
    id: 'p17',
    chapter: '第六章 · 算法深巷',
    title: '排行榜名次结算',
    difficulty: 'hard',
    stars: 5,
    minutes: 28,
    players: '410',
    tags: ['数组', '嵌套循环', '排序'],
    description:
      '背景：赛季结算服务要在发奖前把这一组玩家分数换算成名次，同名次要共享名次，发奖的档位却不能再多算一份。\n' +
      '输入：分数 [2680, 1892, 2180, 1892, 1480]，先按分数从高到低排好；名次规则「同分并列，并列之后的名次跳过」。\n' +
      '输出：打印排序后的「分数：2680 2180 1892 1892 1480」、「名次：1 2 3 3 5」以及「共 4 档奖励」。\n' +
      '算法约束：不许调用语言自带的 sort，用双重循环自己排（选择或冒泡均可）；名次用「严格大于我的人数 + 1」来算，而不是顺着下标念 1、2、3；奖励档数等于不同名次的个数。\n' +
      '性能要求：n = 5 时排序内部比较次数不超过 10 次；整套结算保持 O(n²) 即可，但必须在一次遍历里同时得出名次和档位，不允许再套第三层循环。\n' +
      '边界：全员同分时名次全是 1、奖励只有 1 档；数组里有 0 分或负分时不能把并列判断吃掉。',
    goals: [
      '让运行结果出现 名次：1 2 3 3 5',
      '让运行结果出现 共 4 档奖励',
      '不使用语言内置排序',
    ],
    hint: '并列的两个人，他们前面的人数是一样的——名次能不能就从「前面有几个人」算出来？',
    hintExtra: '先排序，再单独走一遍算名次；两件事别挤在同一个循环里。',
    rewardCoins: 380,
    rewardXp: 190,
    expectIncludes: ['名次：1 2 3 3 5', '共 4 档奖励'],
    expectedOutput: '分数：2680 2180 1892 1892 1480\n名次：1 2 3 3 5\n共 4 档奖励',
    forbiddenKeywords: [
      '[2680,2180,1892,1892,1480]',
      '26802180189218921480',
      '[1,2,3,3,5]',
      'rank=12335',
      'sorted(',
      '.sort(',
    ],
    sim: [
      { need: ['print', 'array', 'loop'], out: ['分数：2680 2180 1892 1892 1480'] },
      { need: ['print', 'array', 'nestedLoop'], out: ['名次：1 2 3 3 5'] },
      {
        need: ['print', 'array', 'nestedLoop', 'accumulate'],
        out: ['共 4 档奖励'],
      },
      {
        need: ['print', 'condition'],
        text: ['并列'],
        out: ['并列同分不占档位，下一档名次直接跳过'],
      },
    ],
  },
  {
    id: 'p15',
    suggestLang: 'python',
    chapter: '第六章 · 算法深巷',
    title: '迷宫出口最短步数',
    difficulty: 'hard',
    stars: 5,
    minutes: 30,
    players: '290',
    tags: ['数组', '嵌套循环', '函数', '搜索'],
    description:
      '背景：迷宫玩法的寻路服务要在毫秒级给出「最少几步走出」，深度优先会走进死胡同出不来，所以这一关只认广度优先。\n' +
      '输入：5×5 的字符网格，「.」表示可走、「#」表示墙，起点固定左上角 (0,0)，出口固定右下角 (4,4)，只能上下左右一步一格。\n' +
      '输出：打印「通路 18 格 / 共 25 格」，再打印逐层扩展的回执，最后是「最短 8 步到达出口」。\n' +
      '算法约束：把「取某坐标的四个邻居」封成一个函数；用队列按层推进，第一次访问到某个格子就标记为已访问，之后不许再入队；步数记录在格子身上而不是靠递归深度。\n' +
      '性能要求：每个格子最多入队一次，整体 O(行数 × 列数)，5×5 地图上入队次数不超过 25；不允许写成 DFS 回溯再全图枚举取最小值。\n' +
      '边界：出口被墙围死时必须打印「无法到达出口」并结束，不能无限循环；起点即出口时步数为 0。\n' +
      '地图（. 可走，# 是墙）：..#.. / ..#.# / ....# / ##.#. / .....',
    goals: [
      '让运行结果出现 通路 18 格',
      '让运行结果出现 最短 8 步',
      '把邻居查找写成一个函数',
    ],
    hint: '「一层一层往外扩」和「一条路走到底再回头」，哪个先碰到出口就一定是最短的？',
    hintExtra: '先把队列准备好：起点入队、标记已访问，然后只要 while 队列非空。',
    rewardCoins: 360,
    rewardXp: 180,
    expectIncludes: ['通路 18 格', '最短 8 步'],
    expectedOutput:
      '通路 18 格 / 共 25 格\nBFS 逐层扩展：第 1 层 1 格 → 第 2 层 2 格 → 第 3 层 4 格……\n最短 8 步到达出口',
    forbiddenKeywords: ['path=18', 'cells=18', 'steps=8', 'dist=8', 'dfs(', '"最短8步'],
    sim: [
      {
        need: ['print', 'array', 'function'],
        out: ['通路 18 格 / 共 25 格'],
      },
      {
        need: ['print', 'array', 'nestedLoop', 'function'],
        out: ['BFS 逐层扩展：第 1 层 1 格 → 第 2 层 2 格 → 第 3 层 4 格……'],
      },
      {
        need: ['print', 'array', 'nestedLoop', 'function', 'condition'],
        out: ['最短 8 步到达出口'],
      },
    ],
  },

  // ── 扩容第一批（75 道目标里的 6 道样例）：2 简单 / 1 普通中等 / 1 高难度中等 / 1 困难 / 1 备用 ──
  {
    id: 'p18',
    chapter: '第二章 · 变量之城',
    title: '倒放的传送带',
    difficulty: 'easy',
    stars: 2,
    minutes: 7,
    players: '1.9k',
    tags: ['循环', '变量', '输出'],
    description: '把单词 "code" 倒过来：先打印正着读的那一行，再用循环打印倒着读的那一行。',
    goals: ['让运行结果出现 正着读是 code', '让运行结果出现 倒着读是 edoc'],
    hint: '倒着读可以每次把新字符接到最前面，而不是接到最后面。',
    hintExtra: '循环里那句「接到头上」就是 结果 = 新字符 + 结果。',
    rewardCoins: 70,
    rewardXp: 35,
    expectIncludes: ['正着读是 code', '倒着读是 edoc'],
    expectedOutput: '正着读是 code\n倒着读是 edoc',
    // 把 edoc 写死在源码里、或者倒序循环少跑最后一格，都是「输出这行照样能打出来」的假解
    forbiddenKeywords: ['"edoc"', '倒着读是edoc', ',0,-1)'],
    sim: [
      { need: ['print'], text: ['正着读'], out: ['正着读是 code'] },
      { need: ['print', 'loop'], text: ['倒着读'], out: ['倒着读是 edoc'] },
      {
        need: ['print', 'loop', 'accumulate'],
        text: ['倒着读'],
        out: ['（每次接到头上，比翻索引省心）'],
      },
    ],
  },
  {
    id: 'p19',
    chapter: '第一章 · 语法丛林',
    title: '奇偶分诊台',
    difficulty: 'easy',
    stars: 2,
    minutes: 6,
    players: '2.4k',
    tags: ['条件', '取余'],
    description: '对 2 和 7 各判断一次：偶数打印「2 是偶数」，奇数打印「7 是奇数」。',
    goals: ['让运行结果出现 2 是偶数', '让运行结果出现 7 是奇数'],
    hint: '「除以 2 余 0」的是哪一类数？余 1 的又是哪一类？',
    hintExtra: '两个数走同一套判断，两行输出就都出来了。',
    rewardCoins: 60,
    rewardXp: 30,
    expectIncludes: ['2 是偶数', '7 是奇数'],
    expectedOutput: '2 是偶数\n7 是奇数',
    // 直接把两行打印出来、或者用 n==2 / n==7 特判这两个数，逻辑都没走到「取余判断」上
    forbiddenKeywords: ['"2是偶数"', '"7是奇数"', 'n==2', 'n==7'],
    sim: [
      { need: ['print', 'condition'], text: ['偶数'], out: ['2 是偶数'] },
      { need: ['print', 'condition'], text: ['奇数'], out: ['7 是奇数'] },
      {
        need: ['print', 'condition', 'loop'],
        text: ['奇数'],
        out: ['（两个数复用同一套判断，这才叫分诊台）'],
      },
    ],
  },
  {
    id: 'p20',
    chapter: '第三章 · 循环竞技场',
    title: '排队：相邻交换排序',
    difficulty: 'medium',
    stars: 3,
    minutes: 16,
    players: '1.1k',
    tags: ['数组', '嵌套循环', '条件'],
    description:
      '背景：排队玩法要把身高乱序的 5 个人从矮到高排好，裁判只允许「相邻比较、相邻交换」。\n' +
      '输入：数组 [8, 3, 12, 5, 1]。\n' +
      '输出：打印「排序后：1 3 5 8 12」。\n' +
      '约束：外层 4 轮、内层每轮少比一个；本题不许调用库里的排序函数，两层循环得自己写。\n' +
      '边界：已经排好的输入要原样输出，重复元素不许弄丢。',
    goals: ['让运行结果出现 排序后：1 3 5 8 12', '用两层循环相邻比较，不许调库排序'],
    hint: '一轮比完之后，最大的那个是不是已经滚到最后面了？',
    hintExtra: '先把「比两个相邻的、该换就换」写成一件事，外层重复几轮就好。',
    rewardCoins: 170,
    rewardXp: 80,
    expectIncludes: ['排序后：1 3 5 8 12'],
    expectedOutput: '排序后：1 3 5 8 12',
    forbiddenKeywords: ['135812', '[1,3,5,8,12]', 'sorted(', '.sort(', 'std::sort', 'arrays.sort'],
    sim: [
      { need: ['print', 'array', 'nestedLoop'], out: ['排序后：1 3 5 8 12'] },
      {
        need: ['print', 'array', 'nestedLoop', 'condition'],
        out: ['（每一轮都把最大的那个冒到最后面）'],
      },
    ],
  },
  {
    id: 'p21',
    chapter: '第六章 · 算法深巷',
    title: '滑动窗口：最短的连续签到',
    difficulty: 'medium',
    advanced: true,
    suggestLang: 'python',
    stars: 4,
    minutes: 22,
    players: '620',
    tags: ['滑动窗口', '双指针', '数组'],
    description:
      '背景：签到活动想知道「最少连续几天」能把积分攒够目标，运营只丢给你一串每日积分。\n' +
      '输入：数组 [2, 3, 1, 2, 4, 3]，目标 S = 7。\n' +
      '输出：打印「最短连续 2 天（和 ≥ 7）」。\n' +
      '算法约束：右端负责进窗、左端负责出窗，两个指针都只往前走，每个元素最多进窗出窗各一次，整体 O(n)；不许用两层循环枚举所有起点，那是 O(n²)，本题按滑动窗口判。\n' +
      '边界：没有任何连续段达标时打印 0；空数组也是 0。',
    goals: ['让运行结果出现 最短连续 2 天', '左右两端都只往前走，不回头枚举起点'],
    hint: '窗口和已经够目标了，能不能从左边退一天再比一次？',
    hintExtra: '进窗先加，达标就试着出窗，出到不达标为止——这两步在同一次遍历里。',
    rewardCoins: 220,
    rewardXp: 110,
    expectIncludes: ['最短连续 2 天'],
    expectedOutput: '最短连续 2 天（和 ≥ 7）',
    // 把答案 2 直接写进变量或输出行；[4, 3] 就是答案窗口本身
    forbiddenKeywords: ['最短连续2天', '[4,3]', 'ans=2', 'min=2', 'days=2', 'res=2'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'accumulate'],
        text: ['7'],
        out: ['最短连续 2 天（和 ≥ 7）'],
      },
      {
        need: ['print', 'array', 'loop', 'accumulate', 'condition'],
        text: ['7'],
        out: ['（右端进窗、左端出窗，全程没有回退）'],
      },
    ],
  },
  {
    id: 'p22',
    chapter: '第六章 · 算法深巷',
    title: '凑零钱：最少几枚',
    difficulty: 'hard',
    stars: 5,
    minutes: 28,
    players: '310',
    tags: ['动态规划', '数组', '函数'],
    description:
      '背景：收银台要找零，硬币面值只有 1、3、4，你得先算出「凑出目标金额最少几枚」，再给出具体方案。\n' +
      '输入：面值数组 [1, 3, 4]，目标金额 6。\n' +
      '输出：先打印「凑出 6 元最少 2 枚」，再打印一行方案「方案：3 + 3」。\n' +
      '算法约束：把「算某个金额的最少枚数」封成一个函数；用一张 dp 表，dp[0] = 0，其余先当不可达的大数，逐金额枚举可用面值取最小，并记住每一步用了哪枚硬币好把方案还原出来。\n' +
      '性能要求：O(金额 × 面值种数)，金额 6 时状态数不超过 6；不许递归暴力枚举所有组合。\n' +
      '边界：凑不出来时打印「凑不出」而不是崩掉；目标为 0 时是 0 枚。\n' +
      '陷阱：先拿最大面值贪心地凑会得到 3 枚（4 + 1 + 1），而正确答案是 2 枚（3 + 3）。',
    goals: [
      '让运行结果出现 最少 2 枚',
      '让运行结果出现 方案：3 + 3',
      '把「算最少枚数」写成一个函数',
    ],
    hint: '凑 6 元的最少枚数，是不是可以建立在「已经凑更小金额的答案」之上？',
    hintExtra: '最后一枚用 1、3 还是 4？三种可能各看一眼，取最便宜的那个再加 1。',
    rewardCoins: 340,
    rewardXp: 170,
    expectIncludes: ['最少 2 枚', '方案：3 + 3'],
    expectedOutput: '凑出 6 元最少 2 枚\n方案：3 + 3',
    forbiddenKeywords: ['最少2枚', '"方案：3+3"', '[3,3]', 'dp[6]=2', 'reverse=True', 'return2'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition', 'function'],
        text: ['6'],
        out: ['凑出 6 元最少 2 枚'],
      },
      {
        need: ['print', 'array', 'nestedLoop', 'condition', 'function'],
        text: ['6'],
        out: ['方案：3 + 3'],
      },
      {
        need: ['print', 'array', 'nestedLoop', 'condition', 'function', 'accumulate'],
        out: ['（dp 表：0 1 1 1 2 2 2）'],
      },
    ],
  },
  {
    id: 'p23',
    chapter: '第四章 · 图形工坊',
    title: '杨辉三角前 4 行',
    difficulty: 'medium',
    advanced: true,
    backup: true,
    stars: 4,
    minutes: 20,
    players: '540',
    tags: ['嵌套循环', '数组', '动态规划'],
    description:
      '背景：抽奖页面的「幸运三角」要用杨辉三角做装饰，策划先要前 4 行。\n' +
      '输入：没有输入，行数是 4。\n' +
      '输出：四行分别是「第 1 行：1」「第 2 行：1 1」「第 3 行：1 2 1」「第 4 行：1 3 3 1」。\n' +
      '算法约束：每行首尾是 1，中间那个数等于上一行肩上两个人之和；用上一层算下一层，不许把四行结果写死。\n' +
      '边界：行数为 0 时什么都不打印；每行内部用单个空格分隔，行尾不留空格。',
    goals: [
      '让运行结果出现 第 3 行：1 2 1',
      '让运行结果出现 第 4 行：1 3 3 1',
      '用上一行推出下一行，别把结果写死',
    ],
    hint: '第 4 行中间那个 3，是上一行的哪两个数加起来来的？',
    hintExtra: '先在纸上写出上一行，再在它头上挂一个 0、尾巴上挂一个 0，两两相加就是下一行。',
    rewardCoins: 200,
    rewardXp: 100,
    expectIncludes: ['第 3 行：1 2 1', '第 4 行：1 3 3 1'],
    expectedOutput: '第 1 行：1\n第 2 行：1 1\n第 3 行：1 2 1\n第 4 行：1 3 3 1',
    forbiddenKeywords: ['第3行：121', '第4行：1331', '[[1],[1,1]', '[1,3,3,1]'],
    sim: [
      {
        need: ['print', 'nestedLoop'],
        out: ['第 1 行：1', '第 2 行：1 1', '第 3 行：1 2 1', '第 4 行：1 3 3 1'],
      },
      {
        need: ['print', 'nestedLoop', 'array'],
        out: ['（每行首尾是 1，中间是肩上两个人之和）'],
      },
    ],
  },
  {
    id: 'p24',
    chapter: '第二章 · 变量之城',
    title: '温度换算牌',
    difficulty: 'easy',
    stars: 2,
    minutes: 6,
    players: '2.0k',
    tags: ['变量', '算术', '输出'],
    description:
      '气象牌上只写了摄氏温度，可游客想看华氏度。用公式 F = C × 9 ÷ 5 + 32 把 25℃ 换算出来，' +
      '打印「25℃ = 77℉」。',
    goals: ['让运行结果出现 25℃ = 77℉', '换算写成公式，别把 77 直接抄上去'],
    hint: '乘法和除法写在同一行时，编译器从左往右算，先乘 9 再除 5 才不会把小数截掉。',
    hintExtra: '把 C 当成 25 代进公式，等号右边写完整的一串运算，别让 77 出现在代码里。',
    rewardCoins: 60,
    rewardXp: 30,
    expectIncludes: ['25℃ = 77℉'],
    expectedOutput: '25℃ = 77℉',
    // 整行写死、或者把 77 当成常量存进变量，都跳过了「换算」这件事本身
    forbiddenKeywords: ['"25℃=77℉"', 'f=77', '"77"', 'c*5/9'],
    sim: [
      { need: ['print'], text: ['25'], out: ['25℃ = 77℉'] },
      { need: ['print'], text: ['9', '32'], out: ['（先乘 9 再除 5，顺序反了小数会被截掉）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    // 先乘 9 再除 5，最后补上 32
    int c = 25;
    int f = c * 9 / 5 + 32;
    cout << c << "℃ = " << f << "℉" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int c = 25;
        int f = c * 9 / 5 + 32;
        System.out.println(c + "℃ = " + f + "℉");
    }
}
`,
      python: `# 整除写成 //，普通 / 会给出小数
c = 25
f = c * 9 // 5 + 32
print(c, "℃ = ", f, "℉", sep="")
`,
    },
  },
  {
    id: 'p25',
    chapter: '第二章 · 变量之城',
    title: '倒数第三个字符',
    difficulty: 'easy',
    stars: 2,
    minutes: 7,
    players: '1.7k',
    tags: ['字符串', '长度', '索引'],
    description: '单词 playground：先打印它的长度，再打印倒数第 3 个字符。',
    goals: ['让运行结果出现 长度 10', '让运行结果出现 倒数第 3 个 = o'],
    hint: '倒数第 3 个，正着数是第几个？',
    hintExtra: '先用长度减 3 得到那个下标，再拿去取字符，比倒着数不容易错。',
    rewardCoins: 70,
    rewardXp: 35,
    expectIncludes: ['长度 10', '倒数第 3 个 = o'],
    expectedOutput: '长度 10\n倒数第 3 个 = o',
    // 把两行结果直接印出来、或者取的是最后一个字符（差了一位），都是「看起来对」
    forbiddenKeywords: ['"长度10"', '倒数第3个=o', '[-1]', '"10"'],
    sim: [
      { need: ['print'], text: ['playground'], out: ['长度 10'] },
      { need: ['print'], text: ['倒数'], out: ['倒数第 3 个 = o'] },
      { need: ['print', 'array'], text: ['倒数'], out: ['（用长度减 3 拿到正着数的那个下标）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <cstring>
using namespace std;

int main() {
    char word[] = "playground";
    int n = strlen(word);
    cout << "长度 " << n << endl;
    cout << "倒数第 3 个 = " << word[n - 3] << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        String word = "playground";
        int n = word.length();
        System.out.println("长度 " + n);
        System.out.println("倒数第 3 个 = " + word.charAt(n - 3));
    }
}
`,
      python: `word = "playground"
n = len(word)
i = n - 3
print("长度", n)
print("倒数第 3 个 =", word[i])
`,
    },
  },
  {
    id: 'p26',
    chapter: '第一章 · 语法丛林',
    title: '闰年小判官',
    difficulty: 'easy',
    stars: 2,
    minutes: 8,
    players: '1.5k',
    tags: ['条件', '取余', '逻辑'],
    description:
      '日历程序要判断闰年：能被 400 整除的是闰年，否则能被 100 整除的不是，否则能被 4 整除的才是。' +
      '对 2024 和 1900 各判断一次，打印「2024 是闰年」「1900 不是闰年」。',
    goals: ['让运行结果出现 2024 是闰年', '让运行结果出现 1900 不是闰年', '两个年份走同一套判断'],
    hint: '1900 能被 4 整除，却不算闰年——三条规则里哪一条把它拦下了？',
    hintExtra: '把 4、100、400 三个取余写进同一个条件式里，两个年份复用同一段判断。',
    rewardCoins: 80,
    rewardXp: 40,
    expectIncludes: ['2024 是闰年', '1900 不是闰年'],
    expectedOutput: '2024 是闰年\n1900 不是闰年',
    // 把两行结果分别写死；或者把「能被 4 整除」当成充分条件（1900 就被误判成闰年）
    forbiddenKeywords: ['"2024是闰年"', '"1900不是闰年"', 'y%4==0or', 'y%4==0||'],
    sim: [
      { need: ['print', 'condition'], text: ['400'], out: ['2024 是闰年', '1900 不是闰年'] },
      { need: ['print', 'condition', 'loop'], out: ['（两个年份走同一套判断，这才叫判官）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int years[2] = {2024, 1900};
    for (int i = 0; i < 2; i += 1) {
        int y = years[i];
        if (y % 400 == 0 || (y % 4 == 0 && y % 100 != 0)) {
            cout << y << " 是闰年" << endl;
        } else {
            cout << y << " 不是闰年" << endl;
        }
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] years = {2024, 1900};
        for (int y : years) {
            if (y % 400 == 0 || (y % 4 == 0 && y % 100 != 0)) {
                System.out.println(y + " 是闰年");
            } else {
                System.out.println(y + " 不是闰年");
            }
        }
    }
}
`,
      python: `for y in [2024, 1900]:
    if y % 400 == 0 or (y % 4 == 0 and y % 100 != 0):
        print(y, "是闰年")
    else:
        print(y, "不是闰年")
`,
    },
  },
  {
    id: 'p27',
    chapter: '第三章 · 循环竞技场',
    title: '数一数几个元音',
    difficulty: 'easy',
    stars: 2,
    minutes: 9,
    players: '1.6k',
    tags: ['循环', '条件', '字符串'],
    description:
      '单词 algorithm 里有几个元音字母（a e i o u）？挨个字符过一遍，' +
      '打印「algorithm 里有 3 个元音字母」。',
    goals: ['让运行结果出现 algorithm 里有 3 个元音字母', '计数器从 0 开始，遇到元音才加 1'],
    hint: '一个字符是不是元音，可以问「它在不在这串字母里」。',
    hintExtra: '先把计数器写成 0，循环里判断一次、加一次，最后把计数器拼进那句话。',
    rewardCoins: 80,
    rewardXp: 40,
    expectIncludes: ['个元音字母'],
    expectedOutput: 'algorithm 里有 3 个元音字母',
    // 3 是数出来的结果，写死它或写死整句话都跳过了循环判断；少写一个 u 也是常见错
    forbiddenKeywords: ['里有3个元音字母', 'count=3', '"aeio"', 'n=3'],
    sim: [
      {
        need: ['print', 'loop', 'condition'],
        text: ['algorithm'],
        out: ['algorithm 里有 3 个元音字母'],
      },
      {
        need: ['print', 'loop', 'condition', 'accumulate'],
        text: ['algorithm'],
        out: ['（每遇到一个元音，计数器才加一次）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    string word = "algorithm";
    string vowels = "aeiou";
    int count = 0;
    for (int i = 0; i < 9; i += 1) {
        for (int j = 0; j < 5; j += 1) {
            if (word[i] == vowels[j]) {
                count += 1;
                break;
            }
        }
    }
    cout << word << " 里有 " << count << " 个元音字母" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        String word = "algorithm";
        String vowels = "aeiou";
        int count = 0;
        for (int i = 0; i < word.length(); i += 1) {
            if (vowels.indexOf(word.charAt(i)) >= 0) {
                count += 1;
            }
        }
        System.out.println(word + " 里有 " + count + " 个元音字母");
    }
}
`,
      python: `word = "algorithm"
vowels = "aeiou"
count = 0
for ch in word:
    if ch in vowels:
        count += 1
print(word, "里有", count, "个元音字母")
`,
    },
  },
  {
    id: 'p28',
    chapter: '第六章 · 算法深巷',
    title: '双指针：凑出目标和的第一对',
    difficulty: 'medium',
    advanced: true,
    suggestLang: 'python',
    stars: 4,
    minutes: 20,
    players: '560',
    tags: ['双指针', '有序数组', '数组'],
    description:
      '背景：配对玩法在一列已经排好序的体重数字里找「加起来刚好等于目标」的两个人，报告指针先撞上的那一对。\n' +
      '输入：数组 [2, 4, 6, 8, 10]，目标 S = 14。\n' +
      '输出：打印「4 + 10 = 14」。\n' +
      '算法约束：一个指针从头、一个从尾，每次比较后只把其中一个往中间挪一格；不许两层循环枚举所有配对，那是 O(n²)，本题按双指针判。\n' +
      '边界：找不到时打印 0 对；数组只有 1 个元素时也直接算找不到。',
    goals: ['让运行结果出现 4 + 10 = 14', '两个指针各自往中间走，别把配对全枚举一遍'],
    hint: '两头之和比目标小，说明哪一头太轻了？',
    hintExtra: '和偏小就把左指针往右挪一格，和偏大就把右指针往左挪一格，碰到相等立刻收工。',
    rewardCoins: 190,
    rewardXp: 95,
    expectIncludes: ['4 + 10 = 14'],
    expectedOutput: '4 + 10 = 14',
    // 把答案那一对写死，或者干脆把 4 和 10 当成变量初值，都没有真的走一遍指针
    forbiddenKeywords: ['"4+10=14"', '[4,10]', '{4,10}', 'a=4'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['14'],
        out: ['4 + 10 = 14'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'accumulate'],
        text: ['14'],
        out: ['（两个指针只会往中间走，每个数最多被碰一次）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int nums[5] = {2, 4, 6, 8, 10};
    int n = 5;
    int S = 14;
    int left = 0;
    int right = n - 1;
    for (int step = 0; step < n; step += 1) {
        while (left < right && nums[left] + nums[right] > S) right -= 1;
        while (left < right && nums[left] + nums[right] < S) left += 1;
        if (left < right && nums[left] + nums[right] == S) {
            cout << nums[left] << " + " << nums[right] << " = " << S << endl;
            break;
        }
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] nums = {2, 4, 6, 8, 10};
        int S = 14;
        int left = 0;
        int right = nums.length - 1;
        for (int step = 0; step < nums.length; step += 1) {
            while (left < right && nums[left] + nums[right] > S) right -= 1;
            while (left < right && nums[left] + nums[right] < S) left += 1;
            if (left < right && nums[left] + nums[right] == S) {
                System.out.println(nums[left] + " + " + nums[right] + " = " + S);
                break;
            }
        }
    }
}
`,
      python: `nums = [2, 4, 6, 8, 10]
S = 14
left = 0
right = len(nums) - 1
for step in range(len(nums)):
    while left < right and nums[left] + nums[right] > S:
        right -= 1
    while left < right and nums[left] + nums[right] < S:
        left += 1
    if left < right and nums[left] + nums[right] == S:
        print(nums[left], "+", nums[right], "=", S)
        break
`,
    },
  },
  {
    id: 'p29',
    chapter: '第五章 · 数据集市',
    title: '谁出现得最多（哈希表）',
    difficulty: 'medium',
    advanced: true,
    suggestLang: 'python',
    stars: 4,
    minutes: 20,
    players: '610',
    tags: ['哈希表', '统计', '数组'],
    description:
      '背景：集市摊位想知道今天哪种商品卖得最勤，账本上只有一列商品编号。\n' +
      '输入：数组 [2, 3, 2, 5, 2, 3, 7]。\n' +
      '输出：打印「2 出现 3 次 · 是次数最多的」。\n' +
      '算法约束：先一遍把每个编号的次数记进一张表，再一遍从表里挑最大值；不许对每个数都重数一遍全场，那是 O(n²)。\n' +
      '边界：并列最多次时报告先遇到的那个；空数组打印「没有记录」。',
    goals: ['让运行结果出现 2 出现 3 次 · 是次数最多的', '先把次数记进一张表，再去比大小'],
    hint: '能不能给每个编号建一个格子，看到一次就把那格加 1？',
    hintExtra: '「取出来、加 1、放回去」写成一趟循环，比大小留给第二趟。',
    rewardCoins: 200,
    rewardXp: 100,
    expectIncludes: ['出现 3 次', '次数最多的'],
    expectedOutput: '2 出现 3 次 · 是次数最多的',
    // 把冠军编号和它的次数当成常量写死，等于根本没数
    forbiddenKeywords: ['出现3次', 'best=2', 'times=3', 'max=3'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['7'],
        out: ['2 出现 3 次 · 是次数最多的'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'function'],
        out: ['（进表一趟、查表一趟，谁也不用被重数两遍）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <map>
using namespace std;

int main() {
    int nums[7] = {2, 3, 2, 5, 2, 3, 7};
    map<int, int> cnt;
    for (int i = 0; i < 7; i += 1) {
        cnt[nums[i]] += 1;
    }
    int best = 0;
    int times = 0;
    for (map<int, int>::iterator it = cnt.begin(); it != cnt.end(); ++it) {
        if (it->second > times) {
            times = it->second;
            best = it->first;
        }
    }
    cout << best << " 出现 " << times << " 次 · 是次数最多的" << endl;
    return 0;
}
`,
      java: `import java.util.HashMap;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        int[] nums = {2, 3, 2, 5, 2, 3, 7};
        Map<Integer, Integer> cnt = new HashMap<>();
        for (int i = 0; i < nums.length; i += 1) {
            cnt.put(nums[i], cnt.getOrDefault(nums[i], 0) + 1);
        }
        int best = 0;
        int times = 0;
        for (int x : nums) {
            if (cnt.get(x) > times) {
                times = cnt.get(x);
                best = x;
            }
        }
        System.out.println(best + " 出现 " + times + " 次 · 是次数最多的");
    }
}
`,
      python: `nums = [2, 3, 2, 5, 2, 3, 7]
cnt = {}
for x in nums:
    cnt[x] = cnt.get(x, 0) + 1
best = 0
times = 0
for x in nums:
    if cnt[x] > times:
        times = cnt[x]
        best = x
print(best, "出现", times, "次 · 是次数最多的")
`,
    },
  },
  {
    id: 'p30',
    chapter: '第三章 · 循环竞技场',
    title: '1 到 12 之间有哪些质数',
    difficulty: 'medium',
    stars: 3,
    minutes: 18,
    players: '720',
    tags: ['嵌套循环', '条件', '质数'],
    description:
      '背景：抽奖程序要先备好一批「只能被 1 和自己整除」的号码。\n' +
      '输入：范围 2 到 12。\n' +
      '输出：把其中的质数打在同一行：「2 3 5 7 11」。\n' +
      '约束：外层挨个考察每个数，内层拿 2 到它自己减一之间的数去试除，能整除就不是质数；不许直接把 2 3 5 7 11 抄进输出。\n' +
      '边界：1 不算质数；范围只有一个数时按同一套判断走。',
    goals: ['让运行结果出现 2 3 5 7 11', '外层挑数、内层试除，两层循环都得自己写'],
    hint: '要证明 12 不是质数，只需要找到一个能整除它的数——从哪个数开始试？',
    hintExtra: '先假设它是质数，内层一旦试到能整除的就把这个假设推翻，循环结束再决定要不要打印。',
    rewardCoins: 190,
    rewardXp: 95,
    expectIncludes: ['2 3 5 7 11'],
    expectedOutput: '2 3 5 7 11',
    // 把质数表抄进代码，或者从 1 开始筛（1 会被当成质数打出来）
    forbiddenKeywords: ['"235711"', '[2,3,5,7,11]', '{2,3,5,7,11}', 'range(1,'],
    sim: [
      {
        need: ['print', 'nestedLoop', 'condition'],
        text: ['12'],
        out: ['2 3 5 7 11'],
      },
      {
        need: ['print', 'nestedLoop', 'condition', 'accumulate'],
        text: ['12'],
        out: ['（内层一发现能整除的，就可以提前收工）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int N = 12;
    for (int n = 2; n <= N; n += 1) {
        bool isPrime = true;
        for (int d = 2; d < n; d += 1) {
            if (n % d == 0) {
                isPrime = false;
                break;
            }
        }
        if (isPrime) cout << n << " ";
    }
    cout << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int N = 12;
        for (int n = 2; n <= N; n += 1) {
            boolean isPrime = true;
            for (int d = 2; d < n; d += 1) {
                if (n % d == 0) {
                    isPrime = false;
                    break;
                }
            }
            if (isPrime) System.out.print(n + " ");
        }
        System.out.println();
    }
}
`,
      python: `# 上限 12 写成常量，别把质数表抄下来
N = 12
line = []
found = 0
for n in range(2, N + 1):
    is_prime = True
    for d in range(2, n):
        if n % d == 0:
            is_prime = False
            break
    if is_prime:
        line.append(str(n))
        found += 1
print(" ".join(line))
`,
    },
  },
  {
    id: 'p31',
    chapter: '第六章 · 算法深巷',
    title: '二分查找：查几次才碰到',
    difficulty: 'hard',
    stars: 5,
    minutes: 30,
    players: '280',
    tags: ['二分查找', '下界', '函数'],
    description:
      '背景：卡池把 7 张卡的编号从小到大排好放在一列里，客服只报编号，程序要说出它排在第几位、以及二分过程中比较了几次。\n' +
      '输入：数组 [3, 8, 15, 21, 34, 55, 71]，目标 target = 34。\n' +
      '输出：打印「34 在第 5 位 · 查了 3 次」（第几位按 1 开始数）。\n' +
      '约束：区间用 lo、hi 两个端点表示，每次取中间位置比较，然后把区间砍掉一半；每次比较都要把 probes 加 1，最后一起报出来。不许从头到尾挨个扫，那是 O(n)，n 大到 10 万会超时。\n' +
      '边界：目标不在数组里时报第 -1 位；lo 与 hi 重合时仍要继续查那一个。',
    goals: [
      '让运行结果出现 34 在第 5 位',
      '让运行结果出现 查了 3 次',
      '区间每次砍掉一半，并把比较次数记进 probes',
    ],
    hint: '取中间那个下标之前，lo 和 hi 各是多少？',
    hintExtra: '先想清楚区间是闭区间还是左闭右开，再看 mid 该 +1 还是 -1；每轮循环开头就 probes += 1。',
    rewardCoins: 350,
    rewardXp: 175,
    expectIncludes: ['在第 5 位', '查了 3 次'],
    expectedOutput: '34 在第 5 位 · 查了 3 次',
    // 位数和次数都是查出来的结果，写死任何一项都等于没查
    forbiddenKeywords: ['34在第5位', '查了3次', 'pos=5', 'found=4', 'probes=3'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition', 'accumulate'],
        text: ['34'],
        out: ['34 在第 5 位 · 查了 3 次'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'accumulate', 'function'],
        text: ['34'],
        out: ['（区间每轮砍掉一半，7 个数最多砍 3 次）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int a[7] = {3, 8, 15, 21, 34, 55, 71};
    int n = 7;
    int target = 34;
    int lo = 0;
    int hi = n - 1;
    int probes = 0;
    int found = -1;
    for (int step = 0; step < n; step += 1) {
        if (lo > hi) break;
        probes += 1;
        int mid = (lo + hi) / 2;
        if (a[mid] == target) {
            found = mid;
            break;
        }
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    cout << target << " 在第 " << found + 1 << " 位 · 查了 " << probes << " 次" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] a = {3, 8, 15, 21, 34, 55, 71};
        int n = a.length, target = 34, lo = 0, hi = n - 1, probes = 0, found = -1;
        for (int step = 0; step < n; step += 1) {
            if (lo > hi) break;
            probes += 1;
            int mid = (lo + hi) / 2;
            if (a[mid] == target) { found = mid; break; }
            if (a[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        System.out.println(target + " 在第 " + (found + 1) + " 位 · 查了 " + probes + " 次");
    }
}
`,
      python: `a = [3, 8, 15, 21, 34, 55, 71]
target = 34
lo = 0
hi = len(a) - 1
probes = 0
found = -1
for step in range(len(a)):
    if lo > hi:
        break
    probes += 1
    mid = (lo + hi) // 2
    if a[mid] == target:
        found = mid
        break
    if a[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
print(target, "在第", found + 1, "位 · 查了", probes, "次")
`,
    },
  },
  {
    id: 'p32',
    chapter: '第六章 · 算法深巷',
    title: '最长递增子序列',
    difficulty: 'hard',
    stars: 5,
    minutes: 32,
    players: '240',
    tags: ['动态规划', '嵌套循环', '数组'],
    description:
      '背景：成就系统要看玩家最顺手的一段连续上升记录，但允许中间跳过几个数——也就是「最长上升子序列」的长度。\n' +
      '输入：数组 [1, 3, 5, 4, 7]。\n' +
      '输出：打印「最长递增子序列长度 4」（1、3、5、7 或者 1、3、4、7 都是 4 个）。\n' +
      '约束：用一张 dp 表，dp[i] 表示「以第 i 个数结尾」能排多长；每个 i 都要回头看一遍更早的位置，转移是 dp[i] = dp[j] + 1。不许猜答案，也不许调用现成的 LIS 库。\n' +
      '边界：空数组报长度 0；单个元素报 1；相等不算上升。',
    goals: ['让运行结果出现 最长递增子序列长度 4', '用一张 dp 表逐个位置算，而不是直接报答案'],
    hint: '如果 7 前面那个数已经能排到 3 长，接上 7 能排多长？',
    hintExtra: '外层选结尾，内层挑前面更短又更小的那个，转移那句是 dp[i] = dp[j] + 1，最后再把 dp 表扫一遍取最大。',
    rewardCoins: 360,
    rewardXp: 180,
    expectIncludes: ['长度 4'],
    expectedOutput: '最长递增子序列长度 4',
    // 长度 4 是算出来的：写死它、或者把答案子序列本身抄进代码，都跳过了整张 dp 表
    forbiddenKeywords: ['"最长递增子序列长度4"', '长度4', 'dp=[1,2,3,4]', '[1,3,5,7]', '{1,3,5,7}'],
    sim: [
      {
        need: ['print', 'array', 'nestedLoop', 'condition'],
        text: ['7'],
        out: ['最长递增子序列长度 4'],
      },
      {
        need: ['print', 'array', 'nestedLoop', 'condition', 'accumulate'],
        text: ['7'],
        out: ['（每个位置都回头看一遍更短的尾巴）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int nums[5] = {1, 3, 5, 4, 7};
    int n = 5;
    int dp[5] = {1, 1, 1, 1, 1};
    int best = 1;
    for (int i = 0; i < n; i += 1) {
        for (int j = 0; j < i; j += 1) {
            if (nums[j] < nums[i] && dp[j] + 1 > dp[i]) dp[i] = dp[j] + 1;
        }
        if (dp[i] > best) best = dp[i];
    }
    cout << "最长递增子序列长度 " << best << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] nums = {1, 3, 5, 4, 7};
        int n = nums.length;
        int[] dp = new int[n];
        for (int i = 0; i < n; i += 1) dp[i] = 1;
        int best = 1;
        for (int i = 0; i < n; i += 1) {
            for (int j = 0; j < i; j += 1) {
                if (nums[j] < nums[i] && dp[j] + 1 > dp[i]) dp[i] = dp[j] + 1;
            }
            if (dp[i] > best) best = dp[i];
        }
        System.out.println("最长递增子序列长度 " + best);
    }
}
`,
      python: `nums = [1, 3, 5, 4, 7]
n = len(nums)
dp = [1] * n
best = 1
for i in range(n):
    for j in range(i):
        if nums[j] < nums[i] and dp[j] + 1 > dp[i]:
            dp[i] = dp[j] + 1
    if dp[i] > best:
        best = dp[i]
print("最长递增子序列长度", best)
`,
    },
  },
  {
    id: 'p33',
    chapter: '第六章 · 算法深巷',
    title: '括号配对检查器',
    difficulty: 'hard',
    stars: 5,
    minutes: 26,
    players: '300',
    tags: ['栈', '字符串', '函数'],
    description:
      '背景：判题机收到两串只由括号组成的表达式，得先确认每道题的括号是不是配好对，才敢往下编译。\n' +
      '输入：{[()()]} 与 {[(]} 两串。\n' +
      '输出：两行——「{[()()]} 合法」和「{[(]} 不合法」。\n' +
      '约束：遇到左括号就压进栈，遇到右括号就取出栈顶比对是不是它对应的左括号；扫完之后栈必须为空才算合法。不许只数左右括号各有几个，那是错的——{[(]} 两边数量一样却配不了对。\n' +
      '边界：空串算合法；一上来就是右括号的串非法；n 到 10 万时也要求只扫一遍，O(n)。',
    goals: [
      '让运行结果出现 { 开头那串合法',
      '让运行结果出现另一串不合法',
      '用栈进出配对，别只数左右括号的数量',
    ],
    hint: '最后进来的左括号，是不是要最先被匹配掉？',
    hintExtra: '把「取栈顶、比类型、再弹掉」写成一段；两串复用同一个检查函数，循环结束别忘了看栈是不是空的。',
    rewardCoins: 320,
    rewardXp: 160,
    expectIncludes: ['合法', '不合法'],
    expectedOutput: '{[()()]} 合法\n{[(]} 不合法',
    // 整行写死，或者用「长度是偶数」这种一看就对不起来的偷懒判法
    forbiddenKeywords: ['{[()()]}合法', '{[(]}不合法', 'len(s)%2', 'size()%2'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['stack'],
        out: ['{[()()]} 合法', '{[(]} 不合法'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'function'],
        out: ['（进栈等配对、出栈清尾巴，最后栈空才算干净）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

bool ok(string s) {
    string stack, L = "([{", R = ")]}";
    for (int i = 0; i < s.size(); i += 1) {
        int k = R.find(s[i]);
        if (k < 0) stack += s[i];
        else if (stack.empty() || stack.back() != L[k]) return false;
        else stack.pop_back();
    }
    return stack.empty();
}

int main() {
    string cases[2] = {"{[()()]}", "{[(]}"};
    for (int i = 0; i < 2; i += 1) cout << cases[i] << (ok(cases[i]) ? " 合法" : " 不合法") << endl;
    return 0;
}
`,
      java: `public class Main {
    static boolean ok(String s) {
        char[] stack = new char[64];
        int top = -1;
        for (int i = 0; i < s.length(); i += 1) {
            char c = s.charAt(i);
            int k = ")]}".indexOf(c);
            if (k < 0) stack[++top] = c;
            else if (top < 0 || stack[top] != "([{".charAt(k)) return false;
            else top -= 1;
        }
        return top < 0;
    }

    public static void main(String[] args) {
        for (String s : new String[] {"{[()()]}", "{[(]}"}) System.out.println(s + (ok(s) ? " 合法" : " 不合法"));
    }
}
`,
      python: `def balanced(s):
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for c in s:
        if c == "(" or c == "[" or c == "{":
            stack.append(c)
        elif not stack:
            return False
        else:
            if stack[-1] != pairs[c]:
                return False
            stack.pop()
    return not stack


cases = ["{[()()]}", "{[(]}"]
for s in cases:
    print(s, "合法" if balanced(s) else "不合法")
`,
    },
  },
  {
    id: 'p34',
    chapter: '第二章 · 变量之城',
    title: '密码箱的十位和个位',
    difficulty: 'easy',
    stars: 1,
    minutes: 6,
    players: '1.2k',
    tags: ['整数除法', '取余', '变量'],
    description:
      '背景：密码箱的每一格只认十位和个位两个数字，得先把一个两位数拆开。\n' +
      '输入：整数 38。\n' +
      '输出：打印「38 的十位是 3，个位是 8」。\n' +
      '约束：3 和 8 必须是算出来的——十位用整除、个位用取余，不许直接写进打印语句。\n' +
      '边界：一位数（比如 7）的十位是 0。',
    goals: ['让运行结果出现 38 的十位是 3，个位是 8', '用 / 10 拿十位、% 10 拿个位，两个数字都别写死'],
    hint: '一个两位数除以 10，小数点前面那位是什么？',
    hintExtra: '整数除法会直接砍掉小数点后面，剩下的零头交给 % 10，正好就是个位。',
    rewardCoins: 85,
    rewardXp: 42,
    expectIncludes: ['38 的十位是 3，个位是 8'],
    expectedOutput: '38 的十位是 3，个位是 8',
    // 把 3 和 8 当成常量抄进输出，等于没拆过这个数
    forbiddenKeywords: ['"38的十位是3', '"十位是3"', 'tens=3', 'ones=8'],
    sim: [
      { need: ['print'], text: ['38'], out: ['38 的十位是 3，个位是 8'] },
      { need: ['print'], text: ['% 10', '/ 10'], out: ['（整除拿到十位，取余拿到个位，两步用的都是 10）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int n = 38;
    int tens = n / 10;
    int ones = n % 10;
    cout << n << " 的十位是 " << tens << "，个位是 " << ones << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int n = 38;
        int tens = n / 10;
        int ones = n % 10;
        System.out.println(n + " 的十位是 " + tens + "，个位是 " + ones);
    }
}
`,
      python: `n = 38
tens = n // 10
ones = n % 10
print(n, "的十位是", tens, "，个位是", ones)
`,
    },
  },
  {
    id: 'p35',
    chapter: '第二章 · 变量之城',
    title: '两杯墨水换个杯子',
    difficulty: 'easy',
    stars: 2,
    minutes: 7,
    players: '1.1k',
    tags: ['变量', '中间变量', '赋值'],
    description:
      '背景：道具台上 a 杯装着 3 毫升蓝墨水、b 杯装着 9 毫升红墨水，要把两杯内容对调。\n' +
      '输入：a = 3，b = 9。\n' +
      '输出：打印「交换后 a = 9，b = 3」。\n' +
      '约束：必须借第三个空杯子做中转，走三步；直接把 a 写成 9、b 写成 3 不算交换。\n' +
      '边界：两杯一样多时对调后输出不变。',
    goals: ['让运行结果出现 交换后 a = 9，b = 3', '借一个中间变量走三步，别去改两边的初值'],
    hint: '如果把 a 直接赋成 b，原来那杯 a 去哪儿了？',
    hintExtra: '先把 a 抄进 t，再把 b 倒进 a，最后把 t 倒进 b——少了第一个动作就全泼了。',
    rewardCoins: 90,
    rewardXp: 45,
    expectIncludes: ['交换后 a = 9，b = 3'],
    expectedOutput: '交换后 a = 9，b = 3',
    // 改初值、或者用语言自带的交换语法糊过去，都没真的走过「借杯子」这一步
    forbiddenKeywords: ['"交换后a=9', 'a=9', 'a,b=b,a', 'swap('],
    sim: [
      { need: ['print'], text: ['交换后'], out: ['交换后 a = 9，b = 3'] },
      {
        need: ['print'],
        text: ['t = a', 'a = b', 'b = t'],
        out: ['（三步对调：先拿空杯子接住 a，才敢往 a 里倒 b）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int a = 3;
    int b = 9;
    int t = a;
    a = b;
    b = t;
    cout << "交换后 a = " << a << "，b = " << b << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int a = 3;
        int b = 9;
        int t = a;
        a = b;
        b = t;
        System.out.println("交换后 a = " + a + "，b = " + b);
    }
}
`,
      python: `a = 3
b = 9
t = a
a = b
b = t
print("交换后 a =", a, "，b =", b)
`,
    },
  },
  {
    id: 'p36',
    chapter: '第四章 · 图形工坊',
    title: '靠墙的梯子',
    difficulty: 'easy',
    suggestLang: 'python',
    stars: 2,
    minutes: 9,
    players: '980',
    tags: ['浮点数', '平方根', '格式化'],
    description:
      '背景：一架梯子底端离墙 3 米，顶端够到墙上 4 米，管理员想知道梯子本身多长。\n' +
      '输入：两条直角边 3 和 4。\n' +
      '输出：打印「斜边 = 5.00 米」（保留两位小数）。\n' +
      '约束：先各自平方再相加，最后交给现成的平方根函数（sqrt / Math.sqrt / math.sqrt），不许把 5 写死。\n' +
      '边界：两条边换成 6 和 8，结果要跟着变成 10.00。',
    goals: ['让运行结果出现 斜边 = 5.00 米', '先平方相加、再开根号，最后按两位小数打印'],
    hint: '知道斜边的平方之后，用什么运算能回到边长？',
    hintExtra: 'C++ 里 #include <cmath> 调 sqrt()，Java 用 Math.sqrt()，Python 用 math.sqrt()；位数交给格式化输出。',
    rewardCoins: 100,
    rewardXp: 50,
    expectIncludes: ['斜边 = 5.00 米'],
    expectedOutput: '斜边 = 5.00 米',
    // 把 5.00 或者斜边长度写成常量，等于没开过根号
    forbiddenKeywords: ['"斜边=5', '5.00', 'side=5', 'hyp=5'],
    sim: [
      { need: ['print'], text: ['sqrt'], out: ['斜边 = 5.00 米'] },
      { need: ['print'], text: ['a * a', 'b * b'], out: ['（先平方相加、最后一步才开根号，顺序是对的）'] },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <cmath>
#include <iomanip>
using namespace std;

int main() {
    int a = 3;
    int b = 4;
    double hyp = sqrt(a * a + b * b);
    cout << "斜边 = " << fixed << setprecision(2) << hyp << " 米" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int a = 3;
        int b = 4;
        double hyp = Math.sqrt(a * a + b * b);
        System.out.printf("斜边 = %.2f 米%n", hyp);
    }
}
`,
      python: `import math

a = 3
b = 4
hyp = math.sqrt(a * a + b * b)
print("斜边 = %.2f 米" % hyp)
`,
    },
  },
  {
    id: 'p37',
    chapter: '第五章 · 数据集市',
    title: '公告栏上的手机号',
    difficulty: 'easy',
    stars: 2,
    minutes: 9,
    players: '1.0k',
    tags: ['字符串', '截取', '拼接'],
    description:
      '背景：公告栏要贴用户的手机号，但按规矩中间四位必须打码。\n' +
      '输入：字符串 "13812345678"。\n' +
      '输出：打印「138****5678」。\n' +
      '约束：前 3 位和后 4 位都得从原号码里切出来再拼上 "****"，不许把整串结果写成一句现成的话。\n' +
      '边界：号码不足 11 位时照样切已有的头尾。',
    goals: ['让运行结果出现 138****5678', '用截取（substr / substring / 切片）拿头尾，中间补四个星号'],
    hint: '11 位号码里，最后四位是从下标几开始的？',
    hintExtra: '后 4 位从下标 7 开始；长度不用数，问字符串自己：size() / length() / len()。',
    rewardCoins: 95,
    rewardXp: 48,
    expectIncludes: ['138****5678'],
    expectedOutput: '138****5678',
    // 整串写死，或者把 138 / 5678 当字面量拼上去，都跟原号码没关系
    forbiddenKeywords: ['"138****5678"', '"138****"', '"5678"'],
    sim: [
      { need: ['print'], text: ['****'], out: ['138****5678'] },
      {
        need: ['print', 'loop', 'array'],
        text: ['phone'],
        out: ['（一位一位扫过去也能拼出打码结果，切片只是把这件事写短了）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string phone = "13812345678";
    string masked = phone.substr(0, 3) + "****" + phone.substr(7, 4);
    cout << masked << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        String phone = "13812345678";
        String masked = phone.substring(0, 3) + "****" + phone.substring(7, 11);
        System.out.println(masked);
    }
}
`,
      python: `phone = "13812345678"
masked = phone[:3] + "****" + phone[7:11]
print(masked)
`,
    },
  },
  {
    id: 'p38',
    chapter: '第五章 · 数据集市',
    title: '领奖台上的第二名',
    difficulty: 'medium',
    stars: 3,
    minutes: 14,
    players: '870',
    tags: ['数组', '一次遍历', '比较'],
    description:
      '背景：积分榜只挂冠军和亚军两块牌子，得从一串分数里同时把前两名揪出来。\n' +
      '输入：数组 [5, 12, 8, 3, 9]。\n' +
      '输出：打印「最大 12，第二大 8」。\n' +
      '算法约束：不许排序、不许调用现成的最大值函数，一趟扫过去同时维护第一名和第二名两个变量。\n' +
      '边界：并列最大时亚军取另一个不同的值；全是同一个数时第二大输出「没有」。',
    goals: ['让运行结果出现 最大 12，第二大 8', '扫一趟同时盯着第一和第二名，先把它们都当成 nums[0]'],
    hint: '遇到一个比当前最大还大的数，原来的最大该去哪儿？',
    hintExtra: '它降级成第二名——先让 second 接住 hi，再把 hi 换成新值；其余的数只在「比 second 大又比 hi 小」时才晋升。',
    rewardCoins: 150,
    rewardXp: 75,
    expectIncludes: ['最大 12，第二大 8'],
    expectedOutput: '最大 12，第二大 8',
    // 把冠亚军两个数字写成常量，或者先排序再取下标，都没做「一趟维护两个名次」这件事
    forbiddenKeywords: ['"最大12', '第二大8"', 'hi=12', 'second=8'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['second'],
        out: ['最大 12，第二大 8'],
      },
      {
        need: ['print', 'array', 'loop', 'nestedLoop'],
        text: ['second'],
        out: ['（先一趟定下最大、再一趟找比它小的最大，这样两趟也是对的）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int nums[5] = {5, 12, 8, 3, 9};
    int hi = nums[0];
    int second = nums[0];
    for (int i = 1; i < 5; i += 1) {
        if (nums[i] > hi) {
            second = hi;
            hi = nums[i];
        } else if (nums[i] > second && nums[i] < hi) {
            second = nums[i];
        }
    }
    cout << "最大 " << hi << "，第二大 " << second << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] nums = {5, 12, 8, 3, 9};
        int hi = nums[0];
        int second = nums[0];
        for (int i = 1; i < nums.length; i += 1) {
            if (nums[i] > hi) { second = hi; hi = nums[i]; }
            else if (nums[i] > second && nums[i] < hi) second = nums[i];
        }
        System.out.println("最大 " + hi + "，第二大 " + second);
    }
}
`,
      python: `nums = [5, 12, 8, 3, 9]
hi = nums[0]
second = nums[0]
for x in nums:
    if x > hi:
        second = hi
        hi = x
    elif x > second and x < hi:
        second = x
print("最大", hi, "，第二大", second)
`,
    },
  },
  {
    id: 'p39',
    chapter: '第六章 · 算法深巷',
    title: '前缀和：一段路过几辆车',
    difficulty: 'medium',
    advanced: true,
    suggestLang: 'python',
    stars: 4,
    minutes: 18,
    players: '760',
    tags: ['前缀和', '数组', '区间查询'],
    description:
      '背景：路口记了连续 5 小时的车流，城管想随时问「第 2 到第 4 小时一共过了几辆」，问一百次也不想扫一百遍。\n' +
      '输入：数组 [1, 3, 5, 2, 4]，问下标 1 到 3 这一段。\n' +
      '输出：打印「下标 1 到 3 一共 10 辆」。\n' +
      '算法约束：先一趟建好前缀和表 pre（pre[k] = 前 k 个数之和），答案只许两次查表相减；不许再为这一段单开一层循环累加。\n' +
      '边界：左端点超过右端点时这段是空的，答案 0。',
    goals: ['让运行结果出现 下标 1 到 3 一共 10 辆', '先建一张前缀和表，之后问任何一段都只是两次查表'],
    hint: '如果「从头到第 k 个的总和」先存起来，中间任意一段能不能只用一次减法拿到？',
    hintExtra: 'pre[k] 存前 k 个数之和，那么下标 l 到 r 的和就是 pre[r + 1] - pre[l]，一行减法收工。',
    rewardCoins: 190,
    rewardXp: 95,
    expectIncludes: ['下标 1 到 3 一共 10 辆'],
    expectedOutput: '下标 1 到 3 一共 10 辆',
    // 10 是查表相减的结果，不是抄下来的；单独为这一段再扫一遍也没建表
    forbiddenKeywords: ['"下标1到3一共10', '一共10辆', 'pre[4]=10', 'total=10'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'accumulate'],
        text: ['pre'],
        out: ['下标 1 到 3 一共 10 辆'],
      },
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['pre[right + 1]', 'pre[left]'],
        out: ['（表只建一次，之后问哪一段都是两次查表，跟这段有多长无关）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int nums[5] = {1, 3, 5, 2, 4};
    int pre[6];
    pre[0] = 0;
    int acc = 0;
    for (int i = 0; i < 5; i += 1) {
        acc += nums[i];
        pre[i + 1] = acc;
    }
    int left = 1;
    int right = 3;
    if (left <= right) {
        cout << "下标 " << left << " 到 " << right << " 一共 " << pre[right + 1] - pre[left] << " 辆" << endl;
    }
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int[] nums = {1, 3, 5, 2, 4};
        int[] pre = new int[nums.length + 1];
        int acc = 0;
        for (int i = 0; i < nums.length; i += 1) {
            acc += nums[i];
            pre[i + 1] = acc;
        }
        int left = 1;
        int right = 3;
        if (left <= right) System.out.println("下标 " + left + " 到 " + right + " 一共 " + (pre[right + 1] - pre[left]) + " 辆");
    }
}
`,
      python: `nums = [1, 3, 5, 2, 4]
pre = [0]
acc = 0
for n in nums:
    acc += n
    pre.append(acc)
left = 1
right = 3
if left <= right:
    print("下标", left, "到", right, "一共", pre[right + 1] - pre[left], "辆")
`,
    },
  },
  {
    id: 'p40',
    chapter: '第六章 · 算法深巷',
    title: '爬楼梯：第 8 级有几种走法',
    difficulty: 'medium',
    advanced: true,
    stars: 4,
    minutes: 18,
    players: '720',
    tags: ['简单 DP', '数组', '递推'],
    description:
      '背景：楼梯一步能迈 1 级或 2 级，想知道稳稳站在第 8 级一共有多少种上法。\n' +
      '输入：台阶数 8。\n' +
      '输出：打印「第 8 级一共有 34 种走法」。\n' +
      '算法约束：把「到第 i 级的走法数」记进数组，靠 f[i - 1] + f[i - 2] 一路往后填；不许把 34 写死，也别用递归把同一段楼梯爬很多遍。\n' +
      '边界：第 1 级 1 种、第 2 级 2 种，是先把表头撑住的两块基石。',
    goals: ['让运行结果出现 第 8 级一共有 34 种走法', '先定住第 1、2 级，再用前两格之和往后填表'],
    hint: '要踏上第 i 级，最后一步只能从哪两级抬上来？',
    hintExtra: '要么从 i-1 迈一级、要么从 i-2 跨两级，所以 f[i] = f[i - 1] + f[i - 2]，从第 3 级起挨个填就好。',
    rewardCoins: 200,
    rewardXp: 100,
    expectIncludes: ['第 8 级一共有 34 种走法'],
    expectedOutput: '第 8 级一共有 34 种走法',
    // 把 34 当成答案写死，或者只写死 f[8]，都是没填过这张表
    forbiddenKeywords: ['"第8级一共有34', '一共有34种', 'f[8]=34', 'ways=34'],
    sim: [
      { need: ['print', 'array', 'loop'], text: ['f[i - 1]'], out: ['第 8 级一共有 34 种走法'] },
      {
        need: ['print', 'array', 'loop'],
        text: ['f[i - 1]', 'f[i - 2]'],
        out: ['（每一格只看前两格，一趟填到底，没把走法一条条数出来）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
using namespace std;

int main() {
    int n = 8;
    int f[9];
    f[1] = 1;
    f[2] = 2;
    for (int i = 3; i <= n; i += 1) {
        f[i] = f[i - 1] + f[i - 2];
    }
    cout << "第 " << n << " 级一共有 " << f[n] << " 种走法" << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        int n = 8;
        int[] f = new int[n + 1];
        f[1] = 1;
        f[2] = 2;
        for (int i = 3; i <= n; i += 1) {
            f[i] = f[i - 1] + f[i - 2];
        }
        System.out.println("第 " + n + " 级一共有 " + f[n] + " 种走法");
    }
}
`,
      python: `n = 8
f = [0] * (n + 1)
f[1] = 1
f[2] = 2
for i in range(3, n + 1):
    f[i] = f[i - 1] + f[i - 2]
print("第", n, "级一共有", f[n], "种走法")
`,
    },
  },
  {
    id: 'p41',
    chapter: '第六章 · 算法深巷',
    title: '三个字母的所有排法',
    difficulty: 'hard',
    suggestLang: 'python',
    stars: 5,
    minutes: 25,
    players: '540',
    tags: ['递归', '回溯', '字符串'],
    description:
      '背景：密码锁有三个字母槽，要试遍 "abc" 能拼出的所有顺序。\n' +
      '输入：字符串 "abc"。\n' +
      '输出：把 6 种排法用空格接在同一行打印：abc acb bac bca cab cba。\n' +
      '算法约束：用递归回溯——每层从剩下的字母里挑一个拼进已排好的前缀，把它从候选里摘掉再往下走；不许手写 6 个字符串交差，也不许调用现成的排列函数。\n' +
      '性能要求：字母再多一个也要照样跑得出来，不能靠枚举。',
    goals: ['让运行结果出现 abc acb bac bca cab cba', '写成「挑一个字母进前缀，剩下的接着排」的递归'],
    hint: '第一个字母定下来之后，剩下两个字母有几种排法？',
    hintExtra: '把「已排好的部分」和「还剩哪些字母」当成两个参数往下传，剩余为空时这条排法就成型了。',
    rewardCoins: 260,
    rewardXp: 130,
    expectIncludes: ['abc acb bac bca cab cba'],
    expectedOutput: 'abc acb bac bca cab cba',
    // 背下 6 条串、或者借用现成的排列库，都没有走一遍递归树
    forbiddenKeywords: ['"abcacb', '"abc","acb"', '"abc"<<"acb"', 'permutations(', 'itertools'],
    sim: [
      {
        need: ['print', 'loop', 'condition'],
        text: ['perm('],
        out: ['abc acb bac bca cab cba'],
      },
      {
        need: ['print', 'loop', 'condition', 'function'],
        text: ['i + 1'],
        out: ['（挑走一个字母、剩下的重新排，这是回溯而不是背答案）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <string>
using namespace std;

void perm(string done, string left) {
    if (left.size() == 0) {
        cout << done << " ";
        return;
    }
    for (int i = 0; i < (int)left.size(); i += 1) {
        perm(done + left[i], left.substr(0, i) + left.substr(i + 1));
    }
}

int main() {
    perm("", "abc");
    return 0;
}
`,
      java: `public class Main {
    static void perm(String done, String left) {
        if (left.length() == 0) {
            System.out.print(done + " ");
            return;
        }
        for (int i = 0; i < left.length(); i += 1) {
            perm(done + left.charAt(i), left.substring(0, i) + left.substring(i + 1));
        }
    }

    public static void main(String[] args) {
        perm("", "abc");
    }
}
`,
      python: `def perm(done, left):
    if left == "":
        print(done, end=" ")
        return
    for i in range(len(left)):
        perm(done + left[i], left[:i] + left[i + 1:])


perm("", "abc")
`,
    },
  },
  {
    id: 'p42',
    chapter: '第六章 · 算法深巷',
    title: '手写竖式：两个大数相加',
    difficulty: 'hard',
    stars: 5,
    minutes: 26,
    players: '480',
    tags: ['字符串', '进位', '大数'],
    description:
      '背景：仓库台账上的数字已经长到装不进一个整数类型，只能一位一位按字符串加。\n' +
      '输入："9999" 和 "1234"。\n' +
      '输出：打印「9999 + 1234 = 11233」。\n' +
      '算法约束：从个位对齐开始逐位相加并记录进位；不许把两个数转成整数再相加（转成 int 就装不下了），也不许直接写死和。\n' +
      '边界：两个数位数不一样长时，短的那边高位按 0 补；最高位还剩进位要多写一位。',
    goals: ['让运行结果出现 9999 + 1234 = 11233', '个位对齐、逐位相加，把 carry 一路带到最高位'],
    hint: '竖式是从哪一位开始算的？算完一位之后那个进位去了哪里？',
    hintExtra: '先把两串补到一样长，再从最右往左逐位相加：这一位写 s % 10，carry 留 s / 10，最后 carry 还剩就再补一位。',
    rewardCoins: 280,
    rewardXp: 140,
    expectIncludes: ['9999 + 1234 = 11233'],
    expectedOutput: '9999 + 1234 = 11233',
    // 抄答案、转成整数、或者把进位当成常量，都没做「逐位加 + 传进位」
    forbiddenKeywords: ['"11233"', '9999+1234', 'carry=1', 'toint(', 'int(a)+int(b)'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['carry'],
        out: ['9999 + 1234 = 11233'],
      },
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['s % 10', 's / 10'],
        out: ['（个位对齐、满十进一，写的是竖式而不是计算器）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string a = "9999", b = "1234";
    while (a.size() < b.size()) a = "0" + a;
    while (b.size() < a.size()) b = "0" + b;
    int carry = 0;
    string out = "";
    for (int i = (int)a.size() - 1; i >= 0; i -= 1) {
        int s = (a[i] - '0') + (b[i] - '0') + carry;
        out = char('0' + s % 10) + out;
        carry = s / 10;
    }
    if (carry > 0) out = "1" + out;
    cout << a << " + " << b << " = " << out << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        String a = "9999", b = "1234";
        while (a.length() < b.length()) a = "0" + a;
        while (b.length() < a.length()) b = "0" + b;
        int carry = 0;
        String out = "";
        for (int i = a.length() - 1; i >= 0; i -= 1) {
            int s = (a.charAt(i) - '0') + (b.charAt(i) - '0') + carry;
            out = (char) ('0' + s % 10) + out;
            carry = s / 10;
        }
        if (carry > 0) out = "1" + out;
        System.out.println(a + " + " + b + " = " + out);
    }
}
`,
      python: `a = "9999"
b = "1234"
n = max(len(a), len(b))
a = a.zfill(n)
b = b.zfill(n)
carry = 0
out = ""
for k in range(n):
    i = n - 1 - k
    s = int(a[i]) + int(b[i]) + carry
    out = str(s % 10) + out
    carry = s // 10
if carry > 0:
    out = "1" + out
print(a, "+", b, "=", out)
`,
    },
  },
  {
    id: 'p43',
    chapter: '第五章 · 数据集市',
    title: '游程编码：把重复的压一压',
    difficulty: 'hard',
    stars: 5,
    minutes: 22,
    players: '520',
    tags: ['字符串', '一次遍历', '计数'],
    description:
      '背景：存档里有一长串连续重复的字符，运营想按「字符 + 连续个数」的格式压缩着存。\n' +
      '输入：字符串 "AAABBCDD"。\n' +
      '输出：打印「AAABBCDD 压完是 A3B2C1D2」。\n' +
      '算法约束：一趟扫到底，用计数器盯住当前这段重复，遇到下一个字符不同才把「字符 + 个数」落进结果；不许为每个字符再往后数一遍（那是 O(n²)），也不许调用压缩库。\n' +
      '边界：串为空时输出「压完是 」后面什么都没有；单个字符压成「字符 1」。',
    goals: ['让运行结果出现 AAABBCDD 压完是 A3B2C1D2', '一个计数器走一趟，字符换了才把这一段落进结果'],
    hint: '什么时候该把「这个字符 + 它连续出现了几次」写进结果里？',
    hintExtra: '下一位还是同一个字符就继续加计数；一旦不同（或者已经走到最后一位），就把这一段收尾再清零。',
    rewardCoins: 240,
    rewardXp: 120,
    expectIncludes: ['AAABBCDD 压完是 A3B2C1D2'],
    expectedOutput: 'AAABBCDD 压完是 A3B2C1D2',
    // 把压好的串写死，或者用两层循环对每个字符重数一遍，都没走这一趟
    forbiddenKeywords: ['A3B2C1D2', 'count=8', 'runs=4', '"压完是A3'],
    sim: [
      {
        need: ['print', 'array', 'loop', 'condition'],
        text: ['count'],
        out: ['AAABBCDD 压完是 A3B2C1D2'],
      },
      {
        need: ['print', 'array', 'loop', 'condition', 'accumulate'],
        text: ['count'],
        out: ['（每段只在收尾时落一次笔，没有为每个字符重扫一遍后面的串）'],
      },
    ],
    solutionCode: {
      cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string s = "AAABBCDD";
    string out = "";
    int count = 1;
    for (int i = 0; i < (int)s.size(); i += 1) {
        if (i + 1 < (int)s.size() && s[i + 1] == s[i]) count += 1;
        else { out = out + s[i] + to_string(count); count = 1; }
    }
    cout << s << " 压完是 " << out << endl;
    return 0;
}
`,
      java: `public class Main {
    public static void main(String[] args) {
        String s = "AAABBCDD";
        String out = "";
        int count = 1;
        for (int i = 0; i < s.length() - 1; i += 1) {
            if (s.charAt(i + 1) == s.charAt(i)) count += 1;
            else { out = out + s.charAt(i) + count; count = 1; }
        }
        out = out + s.charAt(s.length() - 1) + count;
        System.out.println(s + " 压完是 " + out);
    }
}
`,
      python: `s = "AAABBCDD"
out = ""
count = 1
for i in range(len(s)):
    if i + 1 < len(s) and s[i + 1] == s[i]:
        count += 1
    else:
        out = out + s[i] + str(count)
        count = 1
print(s, "压完是", out)
`,
    },
  },
]

/** 一批题池里每个难度抽几道：2 简单 + 2 中等 + 1 困难 */
export const DIFFICULTY_PLAN: Record<Difficulty, number> = { easy: 2, medium: 2, hard: 1 }

/** 题池列表的展示顺序，也是抽题算法遍历难度的顺序 */
export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard']

/**
 * 题库规模目标：75 道 = 25 简单 + 25 中等 + 25 困难，
 * 其中 25 道中等再拆成 10 道普通 + 15 道高难度（advanced: true）。
 * 备用题（backup: true）不算在内，它们只在某个难度凑不满名额时顶上。
 */
export const POOL_TARGET = { total: 75, easy: 25, medium: 25, mediumAdvanced: 15, hard: 25 }

function compareInTier(a: Problem, b: Problem): number {
  return a.stars - b.stars || a.id.localeCompare(b.id, 'en', { numeric: true })
}

/** 同难度内的全部题目（含备用题），给抽题记录和「点标题查题」用 */
export function bankOf(difficulty: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === difficulty).sort(compareInTier)
}

/** 参与正常抽题的池子：备用题不在里面，所以「还剩几道」也不会把它们算进去 */
export function drawBank(difficulty: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === difficulty && !p.backup).sort(compareInTier)
}

/** 某个难度的备用题：只有正常池被排空时才轮到它们 */
export function backupBank(difficulty: Difficulty): Problem[] {
  return PROBLEMS.filter((p) => p.difficulty === difficulty && p.backup).sort(compareInTier)
}

/**
 * 中等题按 advanced 拆成两个子池：抽题规则 C 要求每批 2 道中等里
 * 至少 1 道来自高难度那一档，所以这两个子池要能被分开取。
 */
export function mediumBank(advanced: boolean): Problem[] {
  return PROBLEMS.filter(
    (p) => p.difficulty === 'medium' && !p.backup && Boolean(p.advanced) === advanced,
  ).sort(compareInTier)
}

/** 跨难度排序：简单 → 中等 → 困难，同难度内按星级 */
export function compareByDifficulty(a: Problem, b: Problem): number {
  const tier = DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty)
  return tier !== 0 ? tier : compareInTier(a, b)
}

export function findProblem(id?: string | null): Problem | undefined {
  return id ? PROBLEMS.find((p) => p.id === id) : undefined
}
