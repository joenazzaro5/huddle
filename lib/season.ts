export type SeasonEvent = {
  id: string
  type: 'practice' | 'game' | 'picture_day' | 'party'
  starts_at: string
  location?: string
  opponent?: string
  home?: boolean
  title?: string
  duration_min: number
  focus?: string
}

// Full season: practices Wed+Fri Apr 22–Jun 5 2026, games every Sunday Apr 26–Jun 7 2026.
// End of Season Party Jun 14.
export const SEASON_SCHEDULE: SeasonEvent[] = [
  { id:'ss-p1',    type:'practice', starts_at:'2026-04-22T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p2',    type:'practice', starts_at:'2026-04-24T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g1',    type:'game',     starts_at:'2026-04-26T10:00:00', opponent:'Tiburon FC',      home:true,  duration_min:60 },
  { id:'ss-p3',    type:'practice', starts_at:'2026-04-29T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p4',    type:'practice', starts_at:'2026-05-01T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g2',    type:'game',     starts_at:'2026-05-03T10:00:00', opponent:'Mill Valley SC',   home:false, duration_min:60 },
  { id:'ss-p5',    type:'practice', starts_at:'2026-05-06T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p6',    type:'practice', starts_at:'2026-05-08T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g3',    type:'game',     starts_at:'2026-05-10T10:00:00', opponent:'Novato United',    home:true,  duration_min:60 },
  { id:'ss-p7',    type:'practice', starts_at:'2026-05-13T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p8',    type:'practice', starts_at:'2026-05-15T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g4',    type:'game',     starts_at:'2026-05-17T10:00:00', opponent:'San Anselmo FC',   home:false, duration_min:60 },
  { id:'ss-p9',    type:'practice', starts_at:'2026-05-20T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p10',   type:'practice', starts_at:'2026-05-22T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g5',    type:'game',     starts_at:'2026-05-24T10:00:00', opponent:'Fairfax FC',       home:true,  duration_min:60 },
  { id:'ss-p11',   type:'practice', starts_at:'2026-05-27T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p12',   type:'practice', starts_at:'2026-05-29T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g6',    type:'game',     starts_at:'2026-05-31T10:00:00', opponent:'Corte Madera FC',  home:false, duration_min:60 },
  { id:'ss-p13',   type:'practice', starts_at:'2026-06-03T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p14',   type:'practice', starts_at:'2026-06-05T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g7',    type:'game',     starts_at:'2026-06-07T10:00:00', opponent:'Larkspur SC',      home:true,  duration_min:60 },
  { id:'ss-party', type:'party',    starts_at:'2026-06-14T11:00:00', location:'Marin Community Fields', title:'End of Season Party', duration_min:120 },
]

/** Next upcoming event from the static schedule, or first event if season hasn't started / has ended. */
export function getScheduleEvents(): SeasonEvent[] {
  const now = new Date()
  const upcoming = SEASON_SCHEDULE.filter(e => new Date(e.starts_at) >= now)
  if (upcoming.length > 0) return upcoming
  // Season over — return the first event of the season so hero card is never empty
  return SEASON_SCHEDULE.slice(0, 1)
}
