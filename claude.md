# Project Information for Claude

## Package Manager

This project uses **pnpm** (not npm or yarn).

## Commands

- Install dependencies: `pnpm install`
- Run dev server: `pnpm start` or `pnpm run start`
- Install playwright: `pnpm add -D playwright`

## Development Setup

The project uses a simple Node.js server (start-server.js) that finds an available port starting from 8000.

## Tech Stack

- D3.js v7 (for map visualization)
- TopoJSON (for map data processing)
- Vanilla JavaScript (ES6+)
- Natural Earth geographic data
- OKLCH color space for perceptually uniform colors

## Color Scheme

The default color scheme is **Time Blocks (4-Hour, High Saturation)** which groups timezones by their current local time:
- 0-3am: Dark blue
- 4-7am: Brown
- 8-11am: Red/pink
- 12-3pm: Orange
- 4-7pm: Yellow
- 8-11pm: Green

## Design Documentation

See `COLOR_SCHEME_DESIGN.md` for detailed notes on color scheme exploration and design decisions.
