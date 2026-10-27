import { useId } from 'react'

export default function PlaybookBackground() {
  const id = useId().replace(/:/g, '')
  const inkId = `playbook-ink-${id}`
  const patternId = `playbook-paper-${id}`

  return <div className="playbook-background" aria-hidden="true">
    <svg width="100%" height="100%" focusable="false">
      <defs>
        <g id={inkId}>
          {/* A jogada maior atravessa o canto da folha. */}
          <g transform="translate(27 28) rotate(-8 133 104)">
            <path d="m15 21 15 19m-17-1 20-20m99 3 18 17m-18 0 18-20m111 137 15 18m-17-1 20-18" />
            <path d="M43 113c-13-4-23 5-21 17 2 15 24 20 30 5 5-11-1-21-9-22Zm151-44c-13-3-22 8-18 19 5 14 24 13 28 1 3-10-2-17-10-20Z" />
            <path d="M52 115c27-26 65-38 109-32m-13-8 15 8-14 8M146 47c9 14 15 20 23 24m-4-12 6 14-14-2" />
            <path d="M206 93c28 11 42 28 49 48m-11-8 12 10 2-15" />
            <path d="M31 56c-12 13-12 29-3 45m-10-6 12 8 1-15" strokeDasharray="4 6.5" />
            <path d="M60 140c44 20 92 27 143 16m-14-4 16 3-9 11" strokeDasharray="1 6" />
            <path d="M5 181c71 13 179 20 268-1m-267 4c88 11 186 17 267-1" opacity=".55" />
            <path d="m109 168-5 20m12-18-5 21m12-20-5 19m-19-10 29 3" />
          </g>

          {/* Linhas retomadas e um percurso com duas opções. */}
          <g transform="translate(355 20) rotate(6 99 73)">
            <path d="M23 19c-13-1-22 11-17 22 5 12 22 14 28 2 6-12 0-23-11-24Zm-2 3c-13-2-19 10-13 21 7 11 23 6 25-6" opacity=".9" />
            <path d="M47 35c41 0 62 15 79 35m-11-6 13 8-1-14M126 71c12-13 22-29 32-47m-12 8 13-10-2 16" />
            <path d="M135 78c17 17 36 20 51 20m-11-7 14 7-13 7" strokeDasharray="5 5" />
            <path d="m164 8 14 15m-17-1 18-16m18 92 15 17m-17 0 19-18" />
            <path d="M68 105c8-7 20-6 22 1 4 11-12 20-16 8-2-5 4-10 8-6 5 5-3 9-7 7" />
            <path d="m48 133 54-2m-50 6 44-2" opacity=".6" />
          </g>

          <g transform="translate(643 31) rotate(9 70 99)">
            <path d="M15 11c12-4 28-4 42-1l-1 20c-14 2-28 1-42 0l1-19Zm5-4 33 2" />
            <path d="m27 16 3 10 14-15" />
            <path d="M41 49c-10 14-12 28-4 46m-11-9 12 11 1-17" strokeDasharray="1 5" />
            <path d="M37 111c-14-3-24 6-22 20 2 12 21 18 30 7 8-11 3-25-8-27Z" />
            <path d="m83 62 16 16m-18 1 20-20m18 92 14 17m-17-1 18-17" />
            <path d="M53 123c30-1 55 7 66 20m-13-5 15 7-3-15M92 88c-2 13 0 21 5 27" />
            <path d="M9 174c23 4 47 5 77-1m-75 4 70-1" opacity=".65" />
            <path d="m91 194 6-13 5 14 14 1-10 8 2 13-12-8-12 6 4-13-10-8 13 0Z" strokeWidth="1.1" />
          </g>

          <g transform="translate(408 186) rotate(-13 74 45)">
            <path d="M7 28c31-28 81-34 122-11 29 17 16 51-17 57-41 7-99-3-105-29-4-16 8-25 20-30" opacity=".8" />
            <path d="m35 30 15 17m-17-2 19-17m46 13 13 15m-16 0 18-17" />
            <path d="M56 46c12-8 23-8 34-3m-9-6 11 7-11 5" />
            <path d="M130 76c8 5 18 9 31 8m-10-5 12 5-8 7" strokeDasharray="2 5" />
          </g>

          {/* Percursos de teste e marcações fora do campo. */}
          <g transform="translate(178 276) rotate(5 123 90)">
            <path d="M20 21c-12-4-23 6-21 18 3 15 24 17 30 5 5-10 0-20-9-23Zm128 91c-12-4-24 6-21 18 3 14 21 18 29 7 7-10 3-23-8-25Z" />
            <path d="m94 3 17 17M92 19l21-18m119 109 16 17m-18-1 20-18m-149 61 14 17m-16-1 18-18" />
            <path d="M39 35c35-6 58 1 77 18s18 30 23 45m-9-9 11 11 3-15" />
            <path d="M111 28c31 4 52 18 66 42s34 33 52 35m-10-8 12 9-15 3" strokeDasharray="5 7" />
            <path d="M130 143c-13 6-24 12-31 24m0-13-2 15 14-7" />
            <path d="M53 81c-12 6-18 14-20 27m-5-11 5 13 8-10" strokeDasharray="1 5.5" />
            <path d="M41 117c-14-2-21 7-16 17 5 11 22 9 25-2 2-9-3-14-9-15Z" />
            <path d="M166 155c11 5 22 6 35 2m-8-3 10 2-6 8" />
            <path d="m173 183 45-3m-41 6 34-3" opacity=".65" />
          </g>

          <g transform="translate(24 348) rotate(-7 54 94)">
            <path d="m8 2 15 17M5 19 26 0m62 74 14 17m-17 0 19-19" />
            <path d="M28 32c18 23 29 31 53 38m-11-8 13 9-14 3" />
            <path d="M22 32c-9 43-4 75 19 98m-13-5 15 7-2-15" strokeDasharray="4 7" />
            <path d="M54 138c-13-3-22 7-19 18 4 14 25 16 30 2 3-10-3-17-11-20Z" />
            <path d="M10 183c22-11 57-14 82-4m-82 7c25-11 56-13 80-4" opacity=".65" />
            <path d="m28 200 8 18m0-20 8 18m0-20 8 18m0-20 8 18m-36-5 39-11" />
          </g>

          <g transform="translate(575 327) rotate(-5 99 98)">
            <path d="M42 24c-12-4-24 6-22 18 3 15 24 19 31 5 5-10 0-20-9-23Zm131 122c-13-4-24 6-22 19 2 14 25 18 31 4 4-11 0-20-9-23Z" />
            <path d="m132 8 16 18m-18-1 20-19m-131 110 14 16m-17 0 20-19m150-43 15 18m-17-1 19-18" />
            <path d="M58 44c23 6 49 22 65 49m-12-7 13 10 0-16M145 37c10 26 16 42 31 51m-13-2 15 4-6-14" />
            <path d="M40 65c-7 22-10 37-8 50m-7-9 7 12 6-12" strokeDasharray="1 6" />
            <path d="M47 126c39-16 72-13 105 13m-8-13 10 15-17-4" strokeDasharray="6 7" />
            <path d="M62 168c-17-5-36-5-47 4-14 12-2 26 16 21 19-6 9-24-2-16-9 7 1 14 6 8" />
            <path d="M81 202c32 6 74 7 114-2m-112 5c39 5 73 5 109-3" opacity=".7" />
          </g>

          {/* Marcas soltas: croquis, rasuras e pequenos lembretes. */}
          <g opacity=".75">
            <path d="m302 241 8-16 10 18-18-2Zm283-64 7-13 8 14-15-1ZM463 559l9-17 11 19-20-2Z" />
            <path d="M544 291c11-5 22-5 31-2m-24 8 18-11m-20 4 21 8m-21-2 19-6m-15-4 11 15m-23-7 34-1" />
            <path d="M269 500c12-5 29-4 40-1m-35 8 31-13m-35 5 34 6m-31-1 36-5m-34-4 24 14m-18-17 15 16" />
            <path d="M749 283c-8-6-11-15-6-21 7-9 21-1 15 8-5 9-14 0-8-4 5-3 10 5 6 11-3 5-10 6-17 2" />
            <path d="m365 526 2 18m6-20 1 19m7-20 1 18m6-20 0 20m-28-4 37-13" />
            <path d="m119 266 9 10m-10 1 12-13m426 276 10 11m-12 1 14-14m222 45 8 10m-10 1 13-13" />
            <path d="M327 190c11-6 23-7 35-3m-8-7 11 7-10 5M512 496c-14-5-29-3-42 5m7-11-9 13 16-3" strokeDasharray="2 5" />
            <path d="m615 260 16 2m-8-10-2 18m-426-51 11 2m-5-8-1 13m276 135 11-1m-6-6 1 13" />
            <path d="M476 319c4-2 8-2 12 0m4 0 3 1m-2 190 4 1m7 1 4-1m-354 40 3 1m5-2 5 0" strokeDasharray="1 4" />
          </g>
          <g fill="currentColor" stroke="none" opacity=".72" fontFamily="Caveat, 'Segoe Print', cursive" fontSize="18">
            <text x="517" y="169" transform="rotate(-9 517 169)">troca</text>
            <text x="244" y="551" transform="rotate(5 244 551)">plano B</text>
            <text x="715" y="310" transform="rotate(8 715 310)">testar?</text>
          </g>
        </g>
        <pattern id={patternId} width="820" height="600" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <use href={`#${inkId}`} transform="translate(.9 .65)" strokeWidth="1" opacity=".28" />
            <use href={`#${inkId}`} strokeWidth="1.35" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  </div>
}
