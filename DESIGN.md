# Design System: OpenClaw Voice

## 1. Visual Theme & Atmosphere

A dark, cinematic voice AI interface that puts the audio experience at the center. The design draws from ElevenLabs' sophisticated audio-first aesthetic but adapts it for a dark, immersive environment. The interface feels like stepping into a premium recording studio — dark, focused, with the audio waveform as the hero element.

The background is a deep void (`#0a0a0a`) with subtle warm undertones, creating intimacy and focus. The audio waveform visualization dominates the viewport — animated bars, rotating rings, and pulsing energy that responds to voice input. Typography is light and airy, letting the visual audio elements command attention.

**Key Characteristics:**
- Deep void background (`#0a0a0a`) with warm amber accents
- Audio waveform as primary visual element — 24 animated bars
- Rotating ring effects around the waveform center
- Crown icon as the voice agent identity
- Amber/gold gradients for energy states
- Glassmorphic cards with subtle borders
- Inter font family throughout for clean readability

## 2. Color Palette & Roles

### Primary
- **Deep Void** (`#0a0a0a`): Primary page background — absolute dark
- **Elevated Surface** (`#141414`): Card backgrounds, elevated containers
- **Pure White** (`#ffffff`): Primary text on dark surfaces
- **Amber Gold** (`#fbbf24`): Primary accent — active states, waveform bars
- **Orange Energy** (`#f59e0b`): Secondary accent — speaking states, gradients

### Neutrals
- **Light Gray** (`#e5e5e5`): Primary body text
- **Muted Gray** (`#9ca3af`): Secondary text, timestamps
- **Dim Gray** (`#6b7280`): Disabled states, placeholders

### Gradients
- **Waveform Gradient**: `linear-gradient(to top, #fbbf24, #fb923c, #fcd34d)` — amber to orange to gold
- **Glow Effect**: `radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)`

### Shadows & Glows
- **Amber Glow**: `0 0 30px rgba(251,191,36,0.3)` — active button glow
- **Card Shadow**: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.03)`
- **Inner Border**: `1px solid rgba(255,255,255,0.05)`

## 3. Typography Rules

### Font Family
- **Primary**: `Inter` — clean, geometric sans-serif

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Color |
|------|------|--------|-------------|----------------|-------|
| Display Hero | 48px | 300 | 1.08 | -0.96px | White |
| Section Heading | 24px | 500 | 1.17 | 0px | White |
| Body Large | 18px | 400 | 1.35 | 0.2px | Light Gray |
| Body | 16px | 400 | 1.50 | 0.16px | Light Gray |
| Button | 15px | 500 | 1.47 | normal | Black (on amber) |
| Caption | 14px | 400 | 1.43 | 0.14px | Muted Gray |
| Status Label | 12px | 500 | 1.33 | 0.7px uppercase | Amber/Orange |

## 4. Component Stylings

### Audio Visualizer (Hero Component)
- **Container**: 256px × 256px, centered
- **Outer Ring**: 256px diameter, 1px border, rotates 360° over 20s
- **Middle Ring**: 192px diameter, 1px border, rotates -360° over 15s
- **Inner Ring**: 128px diameter, 1px border, rotates 360° over 10s
- **Waveform Bars**: 24 bars, 4px width, 8px gap
  - Colors: gradient from amber (#fbbf24) through orange (#fb923c) to gold (#fcd34d)
  - Animation: height pulses based on audio volume (4px to 120px)
  - Delays: staggered 50ms between bars
- **Center Icon**: Crown, 48px, amber color, pulsing scale

### Buttons

**Primary CTA (Amber Pill)**
- Background: `linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)`
- Text: Black (#000), 15px, weight 500, uppercase
- Padding: 16px 32px
- Radius: 9999px (full pill)
- Shadow: `0 0 30px rgba(251,191,36,0.3), 0 4px 14px rgba(0,0,0,0.4)`
- Hover: Scale 1.05

**Disconnect (Red Pill)**
- Background: `rgba(239,68,68,0.9)`
- Text: White
- Shadow: `0 0 20px rgba(239,68,68,0.3)`

### Message Cards
- User messages: `bg-amber-500/20 text-amber-200`, right-aligned
- Assistant messages: `bg-white/5 text-white`, left-aligned
- System messages: `bg-gray-800/50 text-gray-400 text-xs uppercase`, center
- Border radius: 16px
- Padding: 12px 16px

### Header
- Sticky, height 64px
- Background: `rgba(10,10,10,0.8)` with backdrop-blur 12px
- Border-bottom: 1px solid rgba(255,255,255,0.05)
- Contains: Crown icon + "OpenClaw Voice" title, connection status

## 5. Layout Principles

### Spacing
- Base unit: 8px
- Section padding: 32px
- Card padding: 24px
- Component gaps: 16px

### Structure
- Single-column centered layout
- Max-width: 896px (max-w-5xl)
- Visualizer at top, centered
- Connect button below visualizer
- Message history below button
- Sticky header at very top

## 6. Depth & Elevation

| Level | Treatment |
|-------|-----------|
| Background | Solid #0a0a0a, no elevation |
| Cards | bg-white/5, border white/5, rounded-2xl |
| Visualizer Container | gradient bg, subtle inner glow |
| Buttons | High elevation with colored glow |
| Header | backdrop-blur, sticky |

## 7. Animation Specifications

### Waveform Bars
- Duration: 0.5s per cycle
- Easing: easeInOut
- Height range: 4px (silent) to 120px (loud)
- Stagger delay: 50ms between bars

### Rotating Rings
- Outer: 20s per rotation, clockwise
- Middle: 15s per rotation, counter-clockwise
- Inner: 10s per rotation, clockwise
- Easing: linear

### Crown Pulse
- Scale: 1.0 to 1.1
- Duration: 1s
- Easing: easeInOut
- Repeat: infinite

### Button Hover
- Scale: 1.0 to 1.05
- Duration: 0.2s
- Easing: easeOut

## 8. Agent Prompt Guide

Build a voice AI interface with:
- Dark void background (#0a0a0a)
- Centered audio waveform visualizer with 24 animated bars
- Three rotating rings around the waveform (256px, 192px, 128px diameters)
- Amber/gold gradients for active states
- Crown icon at center of visualizer
- Glassmorphic message cards
- Amber pill button for "Connect to King"
- Connection status indicator in sticky header
- All animations using framer-motion
