import { BadgeWall } from '../components/profile/BadgeWall'
import { CodeFootprints } from '../components/profile/CodeFootprints'
import { PlayerCard } from '../components/profile/PlayerCard'
import { SkillRadar } from '../components/profile/SkillRadar'
import { StatsPanel } from '../components/profile/StatsPanel'

export default function ProfilePage() {
  return (
    <div className="space-y-5 py-2">
      <PlayerCard />
      <StatsPanel />
      <div className="grid gap-5 lg:grid-cols-5">
        <SkillRadar className="lg:col-span-3" />
        <BadgeWall className="lg:col-span-2" />
      </div>
      <CodeFootprints />
    </div>
  )
}
