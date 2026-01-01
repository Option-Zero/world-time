# Color Scheme Design Notes

## The Core Challenge

We need to color-code **27 timezones** that have a natural **linear order** (UTC-12 through UTC+14).

### Requirements
1. **Show progression**: Visual indication of west → east ordering
2. **Adjacent distinction**: Neighboring timezones must be visually distinguishable
3. **Global uniqueness**: Each timezone should be identifiable across the entire map
4. **Semantic meaning** (optional): Color conveys information beyond just identity

### Constraints
- Single visual channel (color) must encode linear position
- 27 distinct values is a lot for a continuous spectrum
- Adjacent timezones in the spectrum need sufficient perceptual contrast
- Human perception isn't uniform across color space (rainbow isn't perceptually uniform)

## Key Insights

### What Works Well
From analyzing reference timezone maps:

1. **Discrete hue families with lightness variation**
   - Group 27 zones into ~6-8 color families (purple, pink, orange, yellow, green, teal, blue)
   - Within each family, vary lightness (light → dark or vice versa)
   - Enables descriptions like "the lightest yellow one" - semantic + specific
   - Adjacent hue families provide strong contrast
   - Within-family lightness steps provide local distinction

2. **Visual encoding for special cases**
   - Crosshatch/stripe patterns for non-standard timezones (fractional offsets like UTC+5:30)
   - Helps identify unusual timezones at a glance

3. **Perceptually uniform color spaces**
   - OKLCH provides better perceptual uniformity than RGB or HSL
   - Equal steps in OKLCH hue ≈ equal perceptual difference
   - Lightness in OKLCH corresponds to human brightness perception

### What Doesn't Work

1. **Simple rainbow gradient** (d3.interpolateRainbow)
   - Adjacent colors too similar in some regions
   - Not perceptually uniform
   - Hard to distinguish neighbors

2. **Pure categorical colors** (without ordering)
   - Loses the linear progression
   - Can't intuitively tell which timezone is "next"

3. **Time-of-day semantic grouping with subtle variation**
   - Tried grouping by current time (morning/afternoon/evening/night)
   - Within-group variation too subtle for distinction
   - Conflates two different variables (time + identity)

## Design Approaches Explored

### 1. Rainbow Gradient (Current Default)
- **Method**: d3.interpolateRainbow from min to max offset
- **Pros**: Shows clear progression, familiar
- **Cons**: Adjacent zones too similar, not perceptually uniform

### 2. OKLCH Evenly Spaced Hues
- **Method**: Hue steps 360°/27 ≈ 13° per zone, constant L & C
- **Pros**: Better perceptual uniformity than rainbow
- **Cons**: Still lacks local contrast (only hue varies)

### 3. Alternating High Contrast
- **Method**: Adjacent zones from opposite sides of color wheel
- **Pros**: Maximum adjacent distinction
- **Cons**: Loses linear progression, visually chaotic

### 4. Time-of-Day Semantic + Variation
- **Method**: Group by current time, vary hue/lightness/chroma within groups
- **Variations tried**:
  - Hue rotation within groups
  - Lightness shifts within groups
  - Chroma variation within groups
  - Combined hue + lightness
- **Pros**: Conveys real information (what time it is there)
- **Cons**: Within-group distinctions too subtle, groups aren't evenly sized

### 5. Warm/Cool Diverging
- **Method**: Positive offsets = warm, negative = cool, center at UTC+0
- **Pros**: Geographic intuition (east/west)
- **Cons**: Doesn't maximize distinction

### 6. Categorical Bold Colors
- **Method**: 8 maximally distinct colors, repeating
- **Pros**: Very easy to match visually
- **Cons**: Colors repeat, loses uniqueness

### 7. Progressive Hue + Lightness Wave ⭐ (Option 1 - Implemented)
- **Method**:
  - Hue steps evenly through 360° spectrum
  - Lightness oscillates in sine wave (light, dark, light, dark...)
  - Adjacent zones differ in BOTH dimensions
- **Pros**: Maintains progression, adds perceptual distance via 2nd dimension
- **Cons**: May create too much lightness variation, potentially disrupting visual flow

### 8. Discrete Hue Families ⭐⭐ (Option B - Implemented)
- **Method**:
  - 7 color families: purple, pink, orange, yellow, green, teal, blue
  - Each family gets 3-4 timezones
  - Within family: lightness varies from dark to light
  - Slight hue variation (±7.5°) within family for extra distinction
- **Pros**:
  - Closely matches proven reference design
  - Enables semantic descriptions ("the lightest yellow one")
  - Strong inter-family contrast, clear intra-family progression
- **Cons**: More complex to tune family distributions

## Visual Enhancements Implemented

### Crosshatch Pattern for Fractional Offsets ✓
- **Implementation**: SVG pattern overlay on timezones with fractional hour offsets
- **Pattern**: White diagonal crosshatch (8x8px, 50% opacity)
- **Affected timezones**: UTC+3:30, +4:30, +5:30, +5:45, +6:30, +9:30, +10:30, +12:45, -3:30, -9:30, etc.
- **Purpose**: Visual indicator for unusual timezones that don't align to whole hours
- **User benefit**: Immediately distinguishes standard vs. non-standard zones

## Reference Examples

### Standard Timezone Map (provided by user)
- Uses discrete hue families (purple → pink → orange → yellow → green → teal → blue)
- Lightness variation within families
- Crosshatch for fractional-offset timezones
- **User feedback**: "contrast between adjacent zones is actually pretty good"
- **Key insight**: Semantic labeling works well ("the lightest yellow one")

## Next Steps to Explore

1. **Test Progressive Hue + Lightness Wave** (Option 1 - implemented)
   - Evaluate if oscillating lightness provides enough local contrast
   - Adjust wave frequency if needed (currently 6 full waves across 27 zones)

2. **Discrete hue families approach** (like reference map)
   - Manually define 6-8 hue families
   - Algorithmically distribute 27 zones across families
   - Vary lightness within each family

3. **Crosshatch/pattern for fractional offsets**
   - Add visual indicator for timezones like UTC+5:30, +9:30, etc.
   - Could use SVG patterns or CSS backgrounds

4. **Optimize using perceptual metrics**
   - Calculate ΔE (perceptual color difference) between all adjacent pairs
   - Ensure minimum ΔE threshold is met
   - Computationally search for optimal color sequence

5. **User testing**
   - Which scheme makes it easiest to match a timezone polygon to its label?
   - Which scheme best conveys the linear ordering?
   - Which is most aesthetically pleasing?

## Technical Implementation Notes

### OKLCH Color Space
- L: Lightness (0-1, perceptual brightness)
- C: Chroma (0-0.4, saturation/colorfulness)
- H: Hue (0-360°, color angle)

### Conversion to RGB
- OKLCH → OKLab → Linear RGB → sRGB (gamma corrected)
- D3.js v7 doesn't natively parse OKLCH strings
- Custom conversion function implemented in ColorUtils.oklchToRgb()

### Color Scheme Architecture
```javascript
ColorSchemes[schemeName] = {
    name: "Display Name",
    description: "What it does and why",
    generator: (timezones) => {
        // Returns a function: (offset) => colorString
        // Color string can be rgb(), hex, or d3.color object
    }
}
```

## Open Questions

1. Should we prioritize local contrast or global aesthetics?
2. Is the linear progression encoding actually useful, or should we just maximize distinction?
3. Should fractional-offset timezones get special visual treatment?
4. How important is color-blindness accessibility?
5. Does the semantic "time of day" encoding add value, or is it confusing?
