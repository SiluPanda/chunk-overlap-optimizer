# chunk-overlap-optimizer

Analyze text chunk boundaries and recommend optimal overlap size for re-chunking. Scores boundary quality, detects interrupted sentences, and provides token-level overlap recommendations with confidence scores.

## Install

```bash
npm install chunk-overlap-optimizer
```

## Quick Start

```typescript
import { analyze } from 'chunk-overlap-optimizer';

const chunks = [
  'The quick brown fox jumps over the lazy',
  'dog. The dog barked loudly at the',
  'intruder who had entered the yard.',
];

const result = analyze(chunks);
console.log(result.overlapTokens);  // recommended overlap in tokens
console.log(result.confidence);     // 0-1 confidence score
console.log(result.boundaries);     // per-boundary breakdown
```

## API

### `analyze(chunks, options?): OverlapRecommendation`

Analyze chunk boundaries and recommend overlap size.

### `scoreBoundary(chunkA, chunkB): BoundaryScore`

Score a single boundary between two chunks.

## License

MIT
