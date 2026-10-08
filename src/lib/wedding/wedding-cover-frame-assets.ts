/** Sinh bởi scripts/build-wedding-cover-frames.mjs — đừng sửa tay. */
export type WeddingCoverFrameAsset = {
  src: string
  hole: { x: number; y: number; w: number; h: number }
  panel: string
  ink: 'dark' | 'light'
}

export const WEDDING_COVER_FRAME_ASSETS: Record<string, WeddingCoverFrameAsset> = {
  "classic_red": {
    "src": "/wedding/covers/classic-red.webp",
    "hole": {
      "x": 16.67,
      "y": 17.5,
      "w": 66.67,
      "h": 58.33
    },
    "panel": "#fff8f0",
    "ink": "dark"
  },
  "blush_floral": {
    "src": "/wedding/covers/blush-floral.webp",
    "hole": {
      "x": 14.44,
      "y": 12.5,
      "w": 71.11,
      "h": 63.33
    },
    "panel": "#fff5f7",
    "ink": "dark"
  },
  "sage_garden": {
    "src": "/wedding/covers/sage-garden.webp",
    "hole": {
      "x": 14.44,
      "y": 12.5,
      "w": 71.11,
      "h": 63.33
    },
    "panel": "#f4faf6",
    "ink": "dark"
  },
  "gold_luxury": {
    "src": "/wedding/covers/gold-luxury.webp",
    "hole": {
      "x": 15.56,
      "y": 13.33,
      "w": 68.89,
      "h": 61.67
    },
    "panel": "#fffaf2",
    "ink": "dark"
  },
  "night_modern": {
    "src": "/wedding/covers/night-modern.webp",
    "hole": {
      "x": 13.33,
      "y": 11.67,
      "w": 73.33,
      "h": 63.33
    },
    "panel": "#0f172a",
    "ink": "light"
  },
  "lotus_viet": {
    "src": "/wedding/covers/lotus-viet.webp",
    "hole": {
      "x": 16.67,
      "y": 16.67,
      "w": 66.67,
      "h": 58.33
    },
    "panel": "#fff6ea",
    "ink": "dark"
  },
  "envelope_wax": {
    "src": "/wedding/covers/envelope-wax.webp",
    "hole": {
      "x": 23.33,
      "y": 35.83,
      "w": 53.33,
      "h": 38.33
    },
    "panel": "#f3ead7",
    "ink": "dark"
  },
  "polaroid": {
    "src": "/wedding/covers/polaroid.webp",
    "hole": {
      "x": 8.67,
      "y": 5.83,
      "w": 82.67,
      "h": 75
    },
    "panel": "#ffffff",
    "ink": "dark"
  },
  "phoenix_pair": {
    "src": "/wedding/covers/phoenix-pair.webp",
    "hole": {
      "x": 18.89,
      "y": 15,
      "w": 62.22,
      "h": 60
    },
    "panel": "#fff7f4",
    "ink": "dark"
  },
  "calla": {
    "src": "/wedding/covers/calla.webp",
    "hole": {
      "x": 10,
      "y": 13.33,
      "w": 57.78,
      "h": 63.33
    },
    "panel": "#f7f7f5",
    "ink": "dark"
  },
  "dried_flowers": {
    "src": "/wedding/covers/dried-flowers.webp",
    "hole": {
      "x": 14.44,
      "y": 12.5,
      "w": 71.11,
      "h": 63.33
    },
    "panel": "#f6efe6",
    "ink": "dark"
  },
  "crest_seal": {
    "src": "/wedding/covers/crest-seal.webp",
    "hole": {
      "x": 17.78,
      "y": 19.17,
      "w": 64.44,
      "h": 56.67
    },
    "panel": "#fffaf3",
    "ink": "dark"
  }
}
