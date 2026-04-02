const SUPABASE_URL = 'https://yvspywmhwqdapxemxlug.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3B5d21od3FkYXB4ZW14bHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDIwMjksImV4cCI6MjA5MDY3ODAyOX0.HXsFNltsIhtL0S2tLtzFK55lbQX6GMFQKxw-U3OY6KQ'

export async function generatePracticePlan(prompt: string, teamName: string, ageGroup: string) {
  const systemPrompt = `You are Cue, an AI coaching assistant for youth soccer.
Team: ${teamName} (${ageGroup})
Session duration: 60 minutes
Generate a Play-Practice-Play structured plan.
Respond ONLY with valid JSON, no markdown:
{"title":"session title","plan":[{"phase":"Opening Play","duration":"15 min","drill":"drill name","desc":"description"},{"phase":"Practice Phase","duration":"30 min","drill":"drill name","desc":"description"},{"phase":"Final Play","duration":"15 min","drill":"drill name","desc":"description"}],"coachTip":"one practical tip"}`

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/ai-generate-plan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ prompt, systemPrompt }),
    }
  )

  const responseText = await response.text()
  console.log('Function status:', response.status)
  console.log('Function response:', responseText.substring(0, 300))

  if (!response.ok) {
    throw new Error(`Function error: ${response.status} ${responseText}`)
  }

  return JSON.parse(responseText)
}
