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

// Full season: practices Wed+Fri Aug 27–Oct 31 2026, games every Sunday Aug 31–Nov 1 2026,
// Picture Day Sep 6, End of Season Party Nov 8.
export const SEASON_SCHEDULE: SeasonEvent[] = [
  { id:'ss-p1',    type:'practice',    starts_at:'2026-08-27T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p2',    type:'practice',    starts_at:'2026-08-29T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g1',    type:'game',        starts_at:'2026-08-31T10:00:00', opponent:'Tiburon FC',      home:true,  duration_min:60 },
  { id:'ss-p3',    type:'practice',    starts_at:'2026-09-03T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p4',    type:'practice',    starts_at:'2026-09-05T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-pic',   type:'picture_day', starts_at:'2026-09-06T09:00:00', location:'Marin Community Fields', title:'Picture Day', duration_min:60 },
  { id:'ss-g2',    type:'game',        starts_at:'2026-09-07T10:00:00', opponent:'Mill Valley SC',   home:false, duration_min:60 },
  { id:'ss-p5',    type:'practice',    starts_at:'2026-09-10T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p6',    type:'practice',    starts_at:'2026-09-12T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g3',    type:'game',        starts_at:'2026-09-14T10:00:00', opponent:'Novato United',    home:true,  duration_min:60 },
  { id:'ss-p7',    type:'practice',    starts_at:'2026-09-17T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p8',    type:'practice',    starts_at:'2026-09-19T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g4',    type:'game',        starts_at:'2026-09-21T10:00:00', opponent:'San Anselmo FC',   home:false, duration_min:60 },
  { id:'ss-p9',    type:'practice',    starts_at:'2026-09-24T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p10',   type:'practice',    starts_at:'2026-09-26T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g5',    type:'game',        starts_at:'2026-09-28T10:00:00', opponent:'Fairfax FC',       home:true,  duration_min:60 },
  { id:'ss-p11',   type:'practice',    starts_at:'2026-10-01T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p12',   type:'practice',    starts_at:'2026-10-03T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g6',    type:'game',        starts_at:'2026-10-05T10:00:00', opponent:'Corte Madera FC',  home:false, duration_min:60 },
  { id:'ss-p13',   type:'practice',    starts_at:'2026-10-08T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p14',   type:'practice',    starts_at:'2026-10-10T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g7',    type:'game',        starts_at:'2026-10-12T10:00:00', opponent:'Larkspur SC',      home:true,  duration_min:60 },
  { id:'ss-p15',   type:'practice',    starts_at:'2026-10-15T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p16',   type:'practice',    starts_at:'2026-10-17T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g8',    type:'game',        starts_at:'2026-10-19T10:00:00', opponent:'Greenbrae United', home:false, duration_min:60 },
  { id:'ss-p17',   type:'practice',    starts_at:'2026-10-22T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p18',   type:'practice',    starts_at:'2026-10-24T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g9',    type:'game',        starts_at:'2026-10-26T10:00:00', opponent:'Tiburon FC',       home:true,  duration_min:60 },
  { id:'ss-p19',   type:'practice',    starts_at:'2026-10-29T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-p20',   type:'practice',    starts_at:'2026-10-31T16:00:00', location:'Marin Community Fields', duration_min:60 },
  { id:'ss-g10',   type:'game',        starts_at:'2026-11-02T10:00:00', opponent:'Mill Valley SC',   home:false, duration_min:60 },
  { id:'ss-party', type:'party',       starts_at:'2026-11-08T11:00:00', location:'Dominican University Field', title:'End of Season Party', duration_min:120 },
]

/** Next upcoming event from the static schedule, or last game if season has ended. */
export function getScheduleEvents(): SeasonEvent[] {
  const now = new Date()
  const upcoming = SEASON_SCHEDULE.filter(e => new Date(e.starts_at) >= now)
  if (upcoming.length > 0) return upcoming
  // Season over — return just the last game so hero card is never empty
  const games = SEASON_SCHEDULE.filter(e => e.type === 'game')
  return games.slice(-1)
}
