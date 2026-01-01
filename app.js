// World Time Zone Map Application

class TimeZoneMap {
    constructor() {
        this.svg = d3.select('#world-map');
        this.width = 1200;
        this.height = 700; // Increased for label space
        this.mapCenterY = 350; // Center the map vertically
        this.pinnedTimezones = new Set();
        this.highlightedTz = null;

        this.projection = d3.geoNaturalEarth1()
            .scale(190)
            .translate([this.width / 2, this.mapCenterY]);

        this.path = d3.geoPath().projection(this.projection);

        this.init();
    }

    async init() {
        this.setupSVG();
        await this.loadData();
        this.render();
        this.startTimeClock();
    }

    setupSVG() {
        this.svg
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Add defs for patterns
        const defs = this.svg.append('defs');

        // Crosshatch pattern for fractional offset timezones
        const pattern = defs.append('pattern')
            .attr('id', 'crosshatch')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 8)
            .attr('height', 8);

        // Diagonal lines going one way
        pattern.append('path')
            .attr('d', 'M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('opacity', 0.5);

        // Diagonal lines going the other way
        pattern.append('path')
            .attr('d', 'M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('opacity', 0.5);

        // Add groups for layering
        this.svg.append('g').attr('class', 'countries-group');
        this.svg.append('g').attr('class', 'timezones-group');
        this.svg.append('g').attr('class', 'labels-group');
    }

    async loadData() {
        // Load world map data from Natural Earth
        const worldData = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        this.countries = topojson.feature(worldData, worldData.objects.countries);

        // Load timezone data from GeoJSON file
        const tzData = await d3.json('timezones.geojson');

        // Group timezones by UTC offset to reduce label clutter
        const grouped = new Map();

        tzData.features.forEach(feature => {
            const offset = feature.properties.offset;
            if (!grouped.has(offset)) {
                grouped.set(offset, {
                    offset: offset,
                    offsetString: feature.properties.offsetString || this.formatOffset(offset),
                    names: [],
                    cities: new Set(),
                    geometries: []
                });
            }

            const group = grouped.get(offset);
            group.geometries.push(feature.geometry);
            if (feature.properties.name) group.names.push(feature.properties.name);
            if (feature.properties.cities) {
                feature.properties.cities.forEach(city => group.cities.add(city));
            }
        });

        // Convert grouped data to timezone objects
        this.timezones = Array.from(grouped.values()).map(group => ({
            offset: group.offset,
            offsetString: group.offsetString,
            name: group.names[0] || `UTC${group.offset >= 0 ? '+' : ''}${group.offset}`,
            names: group.names,
            cities: Array.from(group.cities),
            geometry: {
                type: 'GeometryCollection',
                geometries: group.geometries
            }
        })).sort((a, b) => a.offset - b.offset);

        console.log(`Loaded ${this.timezones.length} timezone groups (from ${tzData.features.length} features)`);

        // Create color scale for timezones
        this.colorScale = d3.scaleSequential()
            .domain([d3.min(this.timezones, d => d.offset), d3.max(this.timezones, d => d.offset)])
            .interpolator(d3.interpolateRainbow);
    }


    formatOffset(offset) {
        if (offset === 0) return 'UTC+0';

        // Handle fractional offsets (like India's +5:30)
        if (offset % 1 !== 0) {
            const hours = Math.floor(offset);
            const minutes = Math.abs((offset % 1) * 60);
            const sign = offset > 0 ? '+' : '';
            return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
        }

        const sign = offset > 0 ? '+' : '';
        return `UTC${sign}${offset}`;
    }

    render() {
        this.renderCountries();
        this.renderTimezones();
        this.renderLabels();
    }

    renderCountries() {
        const countriesGroup = this.svg.select('.countries-group');

        countriesGroup.selectAll('path')
            .data(this.countries.features)
            .join('path')
            .attr('class', 'country')
            .attr('d', this.path);
    }

    renderTimezones() {
        const timezonesGroup = this.svg.select('.timezones-group');

        // Render base timezone polygons
        timezonesGroup.selectAll('path.timezone')
            .data(this.timezones)
            .join('path')
            .attr('class', 'timezone')
            .attr('d', d => this.path({ type: 'Feature', geometry: d.geometry }))
            .attr('data-offset', d => d.offset)
            .style('fill', d => {
                const color = d3.color(this.colorScale(d.offset));
                color.opacity = 0.3;
                return color;
            })
            .on('mouseover', (event, d) => this.handleTimezoneHover(d))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', (event, d) => this.handleTimezoneClick(d));

        // Add crosshatch overlay for fractional offset timezones
        const fractionalTzs = this.timezones.filter(tz => tz.offset % 1 !== 0);

        timezonesGroup.selectAll('path.timezone-pattern')
            .data(fractionalTzs)
            .join('path')
            .attr('class', 'timezone-pattern')
            .attr('d', d => this.path({ type: 'Feature', geometry: d.geometry }))
            .attr('data-offset', d => d.offset)
            .style('fill', 'url(#crosshatch)')
            .style('pointer-events', 'none'); // Don't interfere with base timezone events
    }

    renderLabels() {
        const labelsGroup = this.svg.select('.labels-group');
        const margin = 10;
        const topLabelY = 50; // Top row position
        const bottomLabelY = this.height - 50; // Bottom row position

        // Calculate centroid and bounds for each timezone
        const tzWithGeometry = this.timezones.map(tz => {
            const bounds = d3.geoBounds({ type: 'Feature', geometry: tz.geometry });
            const centroid = d3.geoCentroid({ type: 'Feature', geometry: tz.geometry });
            const projected = this.projection(centroid);

            // Find northernmost and southernmost points
            const north = this.projection([centroid[0], bounds[1][1]]);
            const south = this.projection([centroid[0], bounds[0][1]]);

            return {
                ...tz,
                centroid: projected,
                north: north,
                south: south,
                bounds: bounds
            };
        });

        // Sort by longitude (x position) for left-to-right layout
        const sortedTz = [...tzWithGeometry].sort((a, b) => a.centroid[0] - b.centroid[0]);

        // Distribute labels: bottom row first, then top row, then corners
        const bottomRow = [];
        const topRow = [];
        const corners = [];

        const labelsPerRow = Math.ceil(sortedTz.length / 2);

        sortedTz.forEach((tz, i) => {
            if (i < labelsPerRow) {
                bottomRow.push(tz);
            } else if (i < labelsPerRow * 2) {
                topRow.push(tz);
            } else {
                corners.push(tz);
            }
        });

        // Render bottom row
        this.renderLabelRow(labelsGroup, bottomRow, bottomLabelY, 'bottom');

        // Render top row
        this.renderLabelRow(labelsGroup, topRow, topLabelY, 'top');

        // Render corner labels (if any overflow)
        corners.forEach((tz, i) => {
            const x = i % 2 === 0 ? margin + 50 : this.width - margin - 50;
            const y = i < 2 ? topLabelY : bottomLabelY;
            this.renderLabel(labelsGroup, tz, x, y, 'corner');
        });
    }

    renderLabelRow(container, timezones, y, position) {
        const spacing = this.width / (timezones.length + 1);

        timezones.forEach((tz, i) => {
            const x = (i + 1) * spacing;
            this.renderLabel(container, tz, x, y, position);
        });
    }

    renderLabel(container, tz, x, y, position) {
        const color = this.colorScale(tz.offset);

        // Create label group
        const labelGroup = container.append('g')
            .attr('class', 'timezone-label')
            .attr('data-offset', tz.offset)
            .on('mouseover', () => this.handleTimezoneHover(tz))
            .on('mouseout', () => this.handleTimezoneLeave())
            .on('click', () => this.handleTimezoneClick(tz));

        // Draw callout line to timezone
        const targetPoint = position === 'top' ? tz.north : tz.south;
        if (targetPoint && targetPoint[0] >= 0 && targetPoint[0] <= this.width) {
            labelGroup.append('line')
                .attr('class', 'callout-line')
                .attr('x1', x)
                .attr('y1', y)
                .attr('x2', targetPoint[0])
                .attr('y2', targetPoint[1])
                .attr('stroke', color)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2')
                .attr('opacity', 0.6);
        }

        // Background rectangle - narrower
        const bgWidth = 55;
        const bgHeight = 30;
        labelGroup.append('rect')
            .attr('x', x - bgWidth / 2)
            .attr('y', y - bgHeight / 2)
            .attr('width', bgWidth)
            .attr('height', bgHeight)
            .attr('fill', color)
            .attr('opacity', 0.9)
            .attr('rx', 4);

        // Add crosshatch overlay for fractional offset timezones
        if (tz.offset % 1 !== 0) {
            labelGroup.append('rect')
                .attr('x', x - bgWidth / 2)
                .attr('y', y - bgHeight / 2)
                .attr('width', bgWidth)
                .attr('height', bgHeight)
                .attr('fill', 'url(#crosshatch)')
                .attr('rx', 4)
                .style('pointer-events', 'none');
        }

        // Abbreviated offset text (e.g., "+8" instead of "UTC+8")
        const abbreviatedOffset = tz.offsetString.replace('UTC', '');
        labelGroup.append('text')
            .attr('class', 'label-offset')
            .attr('x', x)
            .attr('y', y - 3)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text(abbreviatedOffset);

        // Time text
        labelGroup.append('text')
            .attr('class', 'label-time')
            .attr('x', x)
            .attr('y', y + 8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', '10px')
            .attr('id', `time-label-${tz.offset.toString().replace('.', '_').replace('-', 'neg')}`)
            .text(this.getCurrentTime(tz.offset));
    }

    getCurrentTime(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (3600000 * offset));

        return tzTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    startTimeClock() {
        // Update all times every second
        setInterval(() => {
            this.updateAllTimes();
        }, 1000);
    }

    updateAllTimes() {
        // Update labels on map
        this.timezones.forEach(tz => {
            const labelId = `time-label-${tz.offset.toString().replace('.', '_').replace('-', 'neg')}`;
            const label = this.svg.select(`#${labelId}`);
            if (!label.empty()) {
                label.text(this.getCurrentTime(tz.offset));
            }
        });

        // Update panel times
        d3.selectAll('.time-display').each(function() {
            const offset = parseFloat(this.dataset.offset);
            const time = new Date();
            const utc = time.getTime() + (time.getTimezoneOffset() * 60000);
            const tzTime = new Date(utc + (3600000 * offset));

            this.textContent = tzTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        });

        // Update relative time info in panels
        d3.selectAll('.time-info').each(function() {
            const offset = parseFloat(this.dataset.offset);
            const browserOffset = -new Date().getTimezoneOffset() / 60;
            const relativeOffset = offset - browserOffset;

            let relativeText;
            if (Math.abs(relativeOffset) < 0.1) {
                relativeText = 'Same as your timezone';
            } else if (relativeOffset > 0) {
                const hours = Math.floor(relativeOffset);
                const minutes = Math.round((relativeOffset % 1) * 60);
                relativeText = minutes > 0
                    ? `${hours}h ${minutes}m ahead of your timezone`
                    : `${hours} hours ahead of your timezone`;
            } else {
                const hours = Math.floor(Math.abs(relativeOffset));
                const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
                relativeText = minutes > 0
                    ? `${hours}h ${minutes}m behind your timezone`
                    : `${hours} hours behind your timezone`;
            }

            this.textContent = relativeText;
        });
    }

    handleTimezoneHover(tz) {
        this.highlightedTz = tz.offset;
        this.updateHighlights();
    }

    handleTimezoneLeave() {
        this.highlightedTz = null;
        this.updateHighlights();
    }

    updateHighlights() {
        // Highlight timezone on map
        this.svg.selectAll('.timezone')
            .classed('highlighted', d => d.offset === this.highlightedTz);

        // Highlight corresponding label
        const highlightedOffset = this.highlightedTz;
        this.svg.selectAll('.timezone-label')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });

        // Highlight corresponding panel
        d3.selectAll('.timezone-panel')
            .classed('highlighted', function() {
                return parseFloat(this.dataset.offset) === highlightedOffset;
            });
    }

    handleTimezoneClick(tz) {
        // Check if panel already exists (only check in timezone-panels container)
        const existingPanel = d3.select(`#timezone-panels .timezone-panel[data-offset="${tz.offset}"]`);
        if (!existingPanel.empty()) {
            // Panel exists, scroll to it and highlight briefly
            existingPanel.node().scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        this.createTimezonePanel(tz);
    }

    createTimezonePanel(tz) {
        const container = d3.select('#timezone-panels');
        const browserOffset = -new Date().getTimezoneOffset() / 60;
        const relativeOffset = tz.offset - browserOffset;

        let relativeText;
        if (Math.abs(relativeOffset) < 0.1) {
            relativeText = 'Same as your timezone';
        } else if (relativeOffset > 0) {
            const hours = Math.floor(relativeOffset);
            const minutes = Math.round((relativeOffset % 1) * 60);
            relativeText = minutes > 0
                ? `${hours}h ${minutes}m ahead of your timezone`
                : `${hours} hours ahead of your timezone`;
        } else {
            const hours = Math.floor(Math.abs(relativeOffset));
            const minutes = Math.round((Math.abs(relativeOffset) % 1) * 60);
            relativeText = minutes > 0
                ? `${hours}h ${minutes}m behind your timezone`
                : `${hours} hours behind your timezone`;
        }

        const panel = container.append('div')
            .attr('class', 'timezone-panel')
            .attr('data-offset', tz.offset)
            .on('mouseover', () => {
                this.highlightedTz = tz.offset;
                this.updateHighlights();
            })
            .on('mouseout', () => {
                this.highlightedTz = null;
                this.updateHighlights();
            });

        const header = panel.append('div')
            .attr('class', 'panel-header');

        header.append('div')
            .attr('class', 'panel-title')
            .text(tz.offsetString);

        const controls = header.append('div')
            .attr('class', 'panel-controls');

        const pinBtn = controls.append('button')
            .attr('class', 'pin-btn')
            .text('📌 Pin')
            .on('click', (event) => {
                event.stopPropagation();
                this.togglePin(tz.offset, pinBtn, panel);
            });

        controls.append('button')
            .attr('class', 'close-btn')
            .text('✕')
            .on('click', (event) => {
                event.stopPropagation();
                this.closePanel(tz.offset, panel);
            });

        const content = panel.append('div')
            .attr('class', 'panel-content');

        content.append('div')
            .attr('class', 'time-display')
            .attr('data-offset', tz.offset)
            .text(this.getCurrentTime(tz.offset));

        content.append('div')
            .attr('class', 'time-info')
            .attr('data-offset', tz.offset)
            .text(relativeText);

        if (tz.names && tz.names.length > 0) {
            content.append('div')
                .style('margin-top', '0.5rem')
                .style('font-size', '0.9rem')
                .style('color', '#666')
                .html(`<strong>Timezone:</strong> ${tz.names.join(', ')}`);
        }

        if (tz.cities && tz.cities.length > 0) {
            const citiesList = content.append('div')
                .attr('class', 'cities-list');

            citiesList.append('h3').text('Major Cities');

            const citiesContainer = citiesList.append('div')
                .attr('class', 'cities');

            tz.cities.forEach(city => {
                citiesContainer.append('span')
                    .attr('class', 'city-tag')
                    .text(city);
            });
        }
    }

    togglePin(offset, button, panel) {
        if (this.pinnedTimezones.has(offset)) {
            this.pinnedTimezones.delete(offset);
            button.classed('pinned', false);
            button.text('📌 Pin');
        } else {
            this.pinnedTimezones.add(offset);
            button.classed('pinned', true);
            button.text('📌 Pinned');
        }
    }

    closePanel(offset, panel) {
        this.pinnedTimezones.delete(offset);
        panel.remove();
    }

    setColorScheme(schemeFunction) {
        this.colorScale = schemeFunction;
        this.render();
    }
}

// OKLCH Color Utilities
const ColorUtils = {
    // Convert OKLCH to RGB using proper OKLab color space
    // L: 0-1 (lightness), C: 0-0.4 (chroma), H: 0-360 (hue)
    oklchToRgb(l, c, h) {
        // OKLCH to OKLab
        const hRad = (h * Math.PI) / 180;
        const a = c * Math.cos(hRad);
        const b = c * Math.sin(hRad);

        // OKLab to linear RGB using correct matrices
        // First: OKLab -> LMS (cone response)
        const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        // LMS to linear RGB
        let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        // Linear RGB to sRGB (gamma correction)
        const toSRGB = (c) => {
            const abs = Math.abs(c);
            if (abs > 0.0031308) {
                return (Math.sign(c) || 1) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
            }
            return 12.92 * c;
        };

        r = toSRGB(r);
        g = toSRGB(g);
        bl = toSRGB(bl);

        // Convert to 0-255 and clamp
        r = Math.max(0, Math.min(255, Math.round(r * 255)));
        g = Math.max(0, Math.min(255, Math.round(g * 255)));
        bl = Math.max(0, Math.min(255, Math.round(bl * 255)));

        return `rgb(${r}, ${g}, ${bl})`;
    },

    // Get current hour in a timezone (0-23)
    getHourInTimezone(offset) {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const tzTime = new Date(utc + (offset * 3600000));
        return tzTime.getHours();
    },

    // Map hour to time of day category
    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }
};

// Color Scheme Definitions
const ColorSchemes = {
    rainbow: {
        name: 'Rainbow Gradient (Current)',
        description: 'Continuous rainbow spectrum from west to east. Beautiful but adjacent colors are similar.',
        generator: (timezones) => {
            const scale = d3.scaleSequential()
                .domain([d3.min(timezones, d => d.offset), d3.max(timezones, d => d.offset)])
                .interpolator(d3.interpolateRainbow);
            return (offset) => {
                const color = d3.color(scale(offset));
                color.opacity = 0.3;
                return color;
            };
        }
    },

    hueStepsLightnessWave: {
        name: 'Progressive Hue + Lightness Wave',
        description: 'Hue steps evenly through spectrum (~13° per zone), while lightness oscillates high/low. Adjacent zones differ in BOTH hue and lightness for maximum local contrast while maintaining global progression.',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();

            sorted.forEach((tz, i) => {
                // Hue: step through full spectrum
                const hue = (i / sorted.length) * 360;

                // Lightness: oscillate between light and dark
                // Creates a wave pattern: light, dark, light, dark...
                const lightnessWave = Math.sin((i / sorted.length) * Math.PI * 6); // 6 full waves
                const lightness = 0.68 + lightnessWave * 0.15; // Range: 0.53 to 0.83

                // Moderate chroma for balanced saturation
                const chroma = 0.15;

                colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, chroma, hue));
            });

            return (offset) => colorMap.get(offset);
        }
    },

    discreteHueFamilies: {
        name: 'Discrete Hue Families (Reference Style)',
        description: 'Groups zones into 7 color families (purple, pink, orange, yellow, green, teal, blue). Within each family, lightness varies from dark to light. Enables semantic descriptions like "the lightest yellow one".',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();

            // Define 7 color families with base hue and chroma
            // Based on reference timezone map
            const families = [
                { name: 'purple', baseH: 280, baseC: 0.14, baseL: 0.58, count: 4 },  // Deep purple to lavender
                { name: 'pink',   baseH: 340, baseC: 0.15, baseL: 0.70, count: 4 },  // Hot pink to pale pink
                { name: 'orange', baseH: 30,  baseC: 0.16, baseL: 0.68, count: 4 },  // Dark orange to peach
                { name: 'yellow', baseH: 80,  baseC: 0.15, baseL: 0.80, count: 4 },  // Golden to pale yellow
                { name: 'green',  baseH: 130, baseC: 0.14, baseL: 0.72, count: 4 },  // Forest to lime
                { name: 'teal',   baseH: 180, baseC: 0.13, baseL: 0.68, count: 4 },  // Teal to cyan
                { name: 'blue',   baseH: 220, baseC: 0.13, baseL: 0.70, count: 3 }   // Deep blue to sky
            ];

            // Distribute timezones across families
            let tzIndex = 0;
            families.forEach(family => {
                const zonesInFamily = Math.min(family.count, sorted.length - tzIndex);

                for (let i = 0; i < zonesInFamily; i++) {
                    const tz = sorted[tzIndex];

                    // Vary lightness within family: darkest first, lightest last
                    const t = zonesInFamily > 1 ? i / (zonesInFamily - 1) : 0.5;
                    const lightness = family.baseL - 0.15 + (t * 0.30); // Range of 0.30 in lightness

                    // Slight hue variation within family for extra distinction
                    const hueOffset = (t - 0.5) * 15; // ±7.5 degrees
                    const hue = family.baseH + hueOffset;

                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, family.baseC, hue));
                    tzIndex++;
                }
            });

            return (offset) => colorMap.get(offset);
        }
    },

    oklchDistinct: {
        name: 'OKLCH Distinct Hues',
        description: 'Evenly spaced hues in perceptually uniform OKLCH color space. Maximum differentiation between adjacent timezones.',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();
            sorted.forEach((tz, i) => {
                const hue = (i / sorted.length) * 360;
                colorMap.set(tz.offset, ColorUtils.oklchToRgb(0.75, 0.15, hue));
            });
            return (offset) => colorMap.get(offset);
        }
    },

    alternatingContrast: {
        name: 'Alternating High Contrast',
        description: 'Adjacent timezones get maximally different colors. Easy to distinguish neighbors.',
        generator: (timezones) => {
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();
            sorted.forEach((tz, i) => {
                // Alternate between opposite sides of color wheel
                const hue = (i % 2 === 0) ? (i / 2) * (360 / Math.ceil(sorted.length / 2)) :
                                             180 + ((i - 1) / 2) * (360 / Math.floor(sorted.length / 2));
                const lightness = 0.7 + (i % 3) * 0.1; // Vary lightness too
                colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, 0.15, hue % 360));
            });
            return (offset) => colorMap.get(offset);
        }
    },

    timeOfDay: {
        name: 'Time of Day (Semantic)',
        description: 'Color represents current time of day in that zone: Yellow=morning, Blue=afternoon, Purple=evening, Dark=night. Conveys real information!',
        generator: (timezones) => {
            const colorMap = new Map();
            const timeColors = {
                morning: ColorUtils.oklchToRgb(0.85, 0.15, 80),   // Warm yellow
                afternoon: ColorUtils.oklchToRgb(0.75, 0.15, 220), // Sky blue
                evening: ColorUtils.oklchToRgb(0.65, 0.15, 280),   // Purple
                night: ColorUtils.oklchToRgb(0.45, 0.12, 260)      // Dark blue
            };
            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                const timeOfDay = ColorUtils.getTimeOfDay(hour);
                colorMap.set(tz.offset, timeColors[timeOfDay]);
            });
            return (offset) => colorMap.get(offset);
        }
    },

    timeOfDayHueRotate: {
        name: 'Time of Day + Hue Variation',
        description: 'Groups by time of day (warmth/brightness), then rotates hue within each group to distinguish individual timezones.',
        generator: (timezones) => {
            // Group timezones by time of day
            const groups = { morning: [], afternoon: [], evening: [], night: [] };
            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                const timeOfDay = ColorUtils.getTimeOfDay(hour);
                groups[timeOfDay].push(tz);
            });

            // Sort each group by offset for consistent hue assignment
            Object.values(groups).forEach(group => group.sort((a, b) => a.offset - b.offset));

            const colorMap = new Map();

            // Define base parameters for each time of day
            const timeParams = {
                morning:   { baseL: 0.85, baseC: 0.15, baseH: 70,  hueRange: 40 },  // Yellow-orange range
                afternoon: { baseL: 0.75, baseC: 0.15, baseH: 200, hueRange: 60 },  // Cyan-blue range
                evening:   { baseL: 0.65, baseC: 0.15, baseH: 280, hueRange: 50 },  // Purple-magenta range
                night:     { baseL: 0.50, baseC: 0.13, baseH: 250, hueRange: 40 }   // Dark blue range
            };

            // Assign colors within each group
            Object.entries(groups).forEach(([timeOfDay, tzList]) => {
                const params = timeParams[timeOfDay];
                tzList.forEach((tz, i) => {
                    const hueOffset = tzList.length > 1
                        ? (i / (tzList.length - 1)) * params.hueRange - params.hueRange / 2
                        : 0;
                    const hue = params.baseH + hueOffset;
                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(params.baseL, params.baseC, hue));
                });
            });

            return (offset) => colorMap.get(offset);
        }
    },

    timeOfDayLightnessShift: {
        name: 'Time of Day + Lightness Variation',
        description: 'Groups by time of day (base warmth), then varies lightness within each group. Subtle but effective.',
        generator: (timezones) => {
            const groups = { morning: [], afternoon: [], evening: [], night: [] };
            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                const timeOfDay = ColorUtils.getTimeOfDay(hour);
                groups[timeOfDay].push(tz);
            });

            Object.values(groups).forEach(group => group.sort((a, b) => a.offset - b.offset));

            const colorMap = new Map();

            const timeParams = {
                morning:   { baseL: 0.85, lRange: 0.15, baseC: 0.15, baseH: 75 },
                afternoon: { baseL: 0.75, lRange: 0.15, baseC: 0.15, baseH: 210 },
                evening:   { baseL: 0.65, lRange: 0.12, baseC: 0.15, baseH: 285 },
                night:     { baseL: 0.50, lRange: 0.12, baseC: 0.13, baseH: 255 }
            };

            Object.entries(groups).forEach(([timeOfDay, tzList]) => {
                const params = timeParams[timeOfDay];
                tzList.forEach((tz, i) => {
                    const lightnessOffset = tzList.length > 1
                        ? (i / (tzList.length - 1)) * params.lRange - params.lRange / 2
                        : 0;
                    const lightness = params.baseL + lightnessOffset;
                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, params.baseC, params.baseH));
                });
            });

            return (offset) => colorMap.get(offset);
        }
    },

    timeOfDayChromaShift: {
        name: 'Time of Day + Chroma Variation',
        description: 'Groups by time of day, then varies color saturation within each group. More saturated = more distinct.',
        generator: (timezones) => {
            const groups = { morning: [], afternoon: [], evening: [], night: [] };
            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                const timeOfDay = ColorUtils.getTimeOfDay(hour);
                groups[timeOfDay].push(tz);
            });

            Object.values(groups).forEach(group => group.sort((a, b) => a.offset - b.offset));

            const colorMap = new Map();

            const timeParams = {
                morning:   { baseL: 0.85, baseC: 0.15, cRange: 0.08, baseH: 75 },
                afternoon: { baseL: 0.75, baseC: 0.15, cRange: 0.08, baseH: 210 },
                evening:   { baseL: 0.65, baseC: 0.15, cRange: 0.08, baseH: 285 },
                night:     { baseL: 0.50, baseC: 0.13, cRange: 0.06, baseH: 255 }
            };

            Object.entries(groups).forEach(([timeOfDay, tzList]) => {
                const params = timeParams[timeOfDay];
                tzList.forEach((tz, i) => {
                    const chromaOffset = tzList.length > 1
                        ? (i / (tzList.length - 1)) * params.cRange - params.cRange / 2
                        : 0;
                    const chroma = Math.max(0.05, params.baseC + chromaOffset);
                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(params.baseL, chroma, params.baseH));
                });
            });

            return (offset) => colorMap.get(offset);
        }
    },

    timeOfDayHueLightness: {
        name: 'Time of Day + Hue & Lightness',
        description: 'Groups by time of day, then varies BOTH hue and lightness within groups. Maximum distinction while preserving semantic meaning.',
        generator: (timezones) => {
            const groups = { morning: [], afternoon: [], evening: [], night: [] };
            timezones.forEach(tz => {
                const hour = ColorUtils.getHourInTimezone(tz.offset);
                const timeOfDay = ColorUtils.getTimeOfDay(hour);
                groups[timeOfDay].push(tz);
            });

            Object.values(groups).forEach(group => group.sort((a, b) => a.offset - b.offset));

            const colorMap = new Map();

            const timeParams = {
                morning:   { baseL: 0.85, lRange: 0.12, baseC: 0.16, baseH: 70,  hueRange: 35 },
                afternoon: { baseL: 0.75, lRange: 0.12, baseC: 0.16, baseH: 200, hueRange: 50 },
                evening:   { baseL: 0.65, lRange: 0.10, baseC: 0.16, baseH: 280, hueRange: 45 },
                night:     { baseL: 0.50, lRange: 0.10, baseC: 0.14, baseH: 250, hueRange: 35 }
            };

            Object.entries(groups).forEach(([timeOfDay, tzList]) => {
                const params = timeParams[timeOfDay];
                tzList.forEach((tz, i) => {
                    const t = tzList.length > 1 ? i / (tzList.length - 1) : 0.5;
                    const hueOffset = (t - 0.5) * params.hueRange;
                    const lightnessOffset = (t - 0.5) * params.lRange;
                    const hue = params.baseH + hueOffset;
                    const lightness = params.baseL + lightnessOffset;
                    colorMap.set(tz.offset, ColorUtils.oklchToRgb(lightness, params.baseC, hue));
                });
            });

            return (offset) => colorMap.get(offset);
        }
    },

    warmCoolDiverge: {
        name: 'Warm/Cool Diverging',
        description: 'Warm colors for positive UTC offsets (east), cool colors for negative (west). Centered at UTC+0.',
        generator: (timezones) => {
            const maxOffset = d3.max(timezones, d => Math.abs(d.offset));
            return (offset) => {
                if (offset === 0) return ColorUtils.oklchToRgb(0.75, 0.05, 120); // Neutral green
                const normalized = offset / maxOffset;
                if (offset > 0) {
                    // Warm colors: yellow to red
                    const hue = 60 - (normalized * 20); // 60 (yellow) to 40 (orange-red)
                    return ColorUtils.oklchToRgb(0.75, 0.15, hue);
                } else {
                    // Cool colors: cyan to blue
                    const hue = 220 + (normalized * 20); // 200 (cyan) to 240 (blue)
                    return ColorUtils.oklchToRgb(0.75, 0.15, hue);
                }
            };
        }
    },

    categoricalBold: {
        name: 'Categorical Bold (8 Colors)',
        description: 'Small set of maximally distinct bold colors that repeat. Very easy to match by eye.',
        generator: (timezones) => {
            // 8 maximally distinct colors in OKLCH space
            const palette = [
                ColorUtils.oklchToRgb(0.65, 0.20, 30),   // Red-orange
                ColorUtils.oklchToRgb(0.80, 0.18, 140),  // Green
                ColorUtils.oklchToRgb(0.70, 0.20, 260),  // Blue
                ColorUtils.oklchToRgb(0.85, 0.18, 80),   // Yellow
                ColorUtils.oklchToRgb(0.60, 0.18, 320),  // Magenta
                ColorUtils.oklchToRgb(0.75, 0.16, 180),  // Cyan
                ColorUtils.oklchToRgb(0.70, 0.18, 0),    // Red
                ColorUtils.oklchToRgb(0.75, 0.15, 110),  // Lime
            ];
            const sorted = [...timezones].sort((a, b) => a.offset - b.offset);
            const colorMap = new Map();
            sorted.forEach((tz, i) => {
                colorMap.set(tz.offset, palette[i % palette.length]);
            });
            return (offset) => colorMap.get(offset);
        }
    }
};

// Color Scheme Prototype Manager
class ColorSchemePrototypes {
    constructor(mapInstance) {
        this.mapInstance = mapInstance;
        this.currentScheme = 'rainbow';
        this.render();
    }

    render() {
        const container = d3.select('#prototype-list');
        container.html(''); // Clear existing

        Object.entries(ColorSchemes).forEach(([key, scheme]) => {
            const item = container.append('div')
                .attr('class', 'prototype-item');

            const header = item.append('div')
                .attr('class', 'prototype-header');

            header.append('div')
                .attr('class', 'prototype-name')
                .text(scheme.name);

            const btn = header.append('button')
                .attr('class', 'apply-scheme-btn')
                .classed('active', key === this.currentScheme)
                .text(key === this.currentScheme ? '✓ Active' : 'Apply')
                .on('click', () => this.applyScheme(key));

            item.append('div')
                .attr('class', 'prototype-description')
                .text(scheme.description);

            // Render color swatches
            const swatches = item.append('div')
                .attr('class', 'color-swatches');

            const colorFunction = scheme.generator(this.mapInstance.timezones);
            const sorted = [...this.mapInstance.timezones].sort((a, b) => a.offset - b.offset);

            sorted.forEach(tz => {
                const color = colorFunction(tz.offset);
                swatches.append('div')
                    .attr('class', 'color-swatch')
                    .attr('data-offset', tz.offsetString)
                    .style('background-color', color);
            });
        });
    }

    applyScheme(key) {
        this.currentScheme = key;
        const colorFunction = ColorSchemes[key].generator(this.mapInstance.timezones);
        this.mapInstance.setColorScheme(colorFunction);
        this.render(); // Update button states
    }
}

// Initialize the application when DOM is ready
let mapInstance;
document.addEventListener('DOMContentLoaded', () => {
    mapInstance = new TimeZoneMap();
    // Wait a bit for map to load, then render prototypes
    setTimeout(() => {
        new ColorSchemePrototypes(mapInstance);
    }, 1000);
});
