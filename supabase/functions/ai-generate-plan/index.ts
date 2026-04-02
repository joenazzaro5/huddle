import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, systemPrompt } = await req.json()

    if (!prompt || !systemPrompt) {
      throw new Error('Missing prompt or systemPrompt')
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      console.error('Anthropic error:', errText)
      throw new Error(`Anthropic API failed: ${anthropicResponse.status}`)
    }

    const anthropicData = await anthropicResponse.json()
    const rawText = anthropicData.content[0]?.text ?? ''

    console.log('Claude response:', rawText.substring(0, 100))

    let plan
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      plan = JSON.parse(cleaned)
    } catch {
      throw new Error('Invalid JSON from Claude: ' + rawText.substring(0, 100))
    }

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
