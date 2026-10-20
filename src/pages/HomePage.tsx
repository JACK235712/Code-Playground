import { AchievementFeed } from '../components/home/AchievementFeed'
import { DailyChallengeCard } from '../components/home/DailyChallengeCard'
import { DailyPlanCard } from '../components/home/DailyPlanCard'
import { GreetingBar } from '../components/home/GreetingBar'
import { MentorCard } from '../components/home/MentorCard'

export default function HomePage() {
  return (
    <div className="space-y-5 py-2">
      <GreetingBar />
      <DailyPlanCard />
      <DailyChallengeCard />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <MentorCard />
        </div>
        <div className="lg:col-span-3">
          <AchievementFeed />
        </div>
      </div>
    </div>
  )
}
