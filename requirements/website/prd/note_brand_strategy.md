---
title: "BrewSite Brand Strategy & Voice Guide"
doc_type: note
status: approved
owner: Toolkit Product
last_updated: 2026-03-21
change_history:
  - date: 2026-03-21
    author: "Toolkit PM"
    summary: "Created brand strategy document."
  - date: 2026-03-21
    author: "Toolkit PM"
    summary: "Complete rewrite. Shifted from cerebral feature-marketing to visceral emotional experience. New color temperature arc replaces flat cyan-on-black. Minimal copy philosophy — the 3D is the message. Informed by Awwwards SOTY analysis (Igloo Inc, Lando Norris), Stripe gradient study, and Apple product page breakdown."
---

# BrewSite Brand Strategy & Voice Guide

## Brand Essence

**BrewSite makes ideas feel alive.**

Not "explains" them. Not "presents" them. Makes them *feel* alive — dimensional, moving, breathing. The website must create this feeling instantly, viscerally, before a single word is read.

### The Test

> A visitor should feel something in their chest within 3 seconds of arriving. If they need to read text to understand why the site is special, we've failed.

---

## The Experience, Not The Explanation

The previous brand strategy was cerebral: "You think in systems. Your tools think in rectangles." That's a *thought*. Thoughts don't make people share websites with their friends.

The new strategy is visceral: **Show something beautiful. Let them sit in it. Then reveal it was 14 lines of code.**

The emotional journey is:

```
Wonder → Desire → Surprise → Confidence → Action
```

Not:

```
Problem → Solution → Features → Trust → CTA
```

We are not solving a pain point. We are creating desire for a new medium.

---

## Color as Narrative

The single biggest change: **color temperature tells the story.** The site starts cold and mysterious, then WARMS as you scroll deeper — like watching a sunrise, or walking from a dark theater into golden light.

### The Arc

| Scene | Temperature | Palette | Feeling |
|---|---|---|---|
| Hero | Cold | Deep void `#0F0E17` + cyan `#00f5ff` | Mystery, "what is this?" |
| Transformation | Cool→Warm | Violet `#7B61FF` entering, pink `#FF61AB` hints | Awakening, shift |
| Showcase | Warm | Violet + rose `#FF61AB` + coral `#F25F4C` | Energy, possibility |
| Code Reveal | Golden | Amber `#FFB84D` + warm white | Intimacy, discovery |
| Ecosystem | Aurora | Violet `#7B61FF` + green `#00D4AA` + gold `#FFB84D` | Completeness, life |
| CTA | Warm glow | Cyan returns but warmer, amber underneath | Invitation, belonging |

### New Design Tokens

The palette extends beyond the existing neon-cyan foundation:

```css
/* ─── Aurora palette (evolving per scene via 3D lighting) ─── */
--aurora-violet:    #7B61FF;    /* Electric violet — the new secondary brand color */
--aurora-pink:      #FF61AB;    /* Nebula pink — energy, surprise */
--aurora-coral:     #F25F4C;    /* Coral flame — warmth */
--aurora-gold:      #FFB84D;    /* Sunset gold — intimacy, discovery */
--aurora-green:     #00D4AA;    /* Aurora green — life, ecosystem */

/* ─── Warm text (never pure white on warm scenes) ─── */
--text-warm:        #F0E6D3;    /* Cream — for warm-lit scenes */
--text-warm-muted:  #9A8E7A;    /* Warm grey — supporting text on warm scenes */
```

The cyan stays as the hero brand color. But as you scroll, the lighting shifts the whole world warm. This isn't CSS — it happens in the 3D lighting and background colors of each scene.

### Why This Works

Research finding: *"The emotional gap between 'nice' and 'exceptional' is almost always about pacing — how things enter and exit, not just what they look like."*

And: *"Color temperature as emotional arc: Start cool/mysterious for intrigue, transition through warm for energy, resolve in clean whites/teals for trust. The color journey creates an emotional arc without a single word."*

Apple, Stripe, and every Awwwards SOTY winner use color change as narrative. A site that looks the same from top to bottom has no story.

---

## Copy Philosophy: Subtitles, Not Paragraphs

### The Old Way (wrong)
```
[Eyebrow] THE PROBLEM
[Headline] You think in systems. Your tools think in rectangles.
[Body] Architecture diagrams. Flattened to screenshots.
       Product flows. Pasted into slide decks.
       Complex ideas. Compressed to bullet points.
       Your thinking has depth, layers, and motion.
       Your medium doesn't.
```

That's 42 words. It takes 15 seconds to read. The 3D sits behind it doing nothing.

### The New Way

The 3D IS the communication. Text appears only to:
1. **Name what you're looking at** — 3-5 words max
2. **Deliver a punchline** — the reveal that creates surprise
3. **Enable action** — the CTA

```
Scene 1: [no text during transformation] then: "Same data. New dimension."
Scene 2: "Models. Charts. Screens. All React."
Scene 3: "That was JSX." [then the code]
Scene 4: [package names are the node labels — no overlay text needed]
Scene 5: "npm create brewsite"
```

Total words across 5 scenes (excluding hero): ~25.

### Voice When Text Does Appear

- **Sentence fragments.** Not full sentences. Fragments land harder.
- **Present tense.** "That was JSX." Not "This is written in JSX."
- **No eyebrow labels.** "THE PROBLEM" / "THE SHIFT" / "THE ENGINE" are conference-talk section headers. This is a website, not a keynote. Kill them all.
- **No explanatory body text.** If the 3D needs a paragraph to explain it, the 3D isn't good enough.

---

## Positioning (Unchanged — the strategy was right, the execution was wrong)

**For technical product managers, developers, and marketing teams** who need to communicate complex ideas with impact, **BrewSite is the open-source React toolkit** that turns presentations into immersive 3D experiences — **written as JSX, rendered like film.**

The hero tagline stays: **"Scenes as React. Rendered like film."**

---

## Anti-Patterns

Everything from the original strategy still holds, plus:

1. **Never use more than 10 words of overlay text per scene.** If you need more, the scene isn't doing its job.
2. **Never label scenes with eyebrow text** ("THE PROBLEM", "THE ENGINE"). It turns an experience into a PowerPoint deck — the very thing we're transcending.
3. **Never use the same lighting color across consecutive scenes.** If two scenes look the same, one of them shouldn't exist.
4. **Never explain what the 3D is doing.** "Same diagram, but now your frontend floats above your API" — that's narrating a visual. Trust the visual.
5. **Never use `#8b949e` grey text on a warm-lit scene.** Match text warmth to lighting warmth.
