# World Time Zone Map

An interactive web application displaying world time zones with live time updates, built with D3.js.

## Features

- **Interactive World Map**: Accurate visualization of continents and countries using Natural Earth data
- **Time Zone Overlays**: Visual representation of time zones with UTC offset labels
- **Live Time Display**: Current time for each timezone, updated every second based on browser time
- **Hover Highlighting**: Hover over time zones to highlight them on the map
- **Expandable Panels**: Click on a time zone to view detailed information including:
  - Current time with seconds
  - Time relative to your browser timezone
  - Major cities in that timezone
  - Timezone identifiers
- **Pin Functionality**: Pin multiple timezone panels to keep them visible while exploring
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Minimalist Styling**: Clean, modern interface focused on usability

## Technology Stack

- **D3.js v7**: For map rendering and data visualization
- **TopoJSON**: For efficient map data processing
- **Vanilla JavaScript**: No frameworks, pure ES6+
- **CSS3**: Modern, responsive styling
- **Natural Earth Data**: High-quality geographic data

## Setup

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd world-map-claude
   ```

2. Serve the files using a local web server. You can use any of these methods:

   **Using Python 3:**
   ```bash
   python -m http.server 8000
   ```

   **Using Python 2:**
   ```bash
   python -m SimpleHTTPServer 8000
   ```

   **Using Node.js (http-server):**
   ```bash
   npx http-server -p 8000
   ```

   **Using PHP:**
   ```bash
   php -S localhost:8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## Deployment to GitHub Pages

1. Push your code to a GitHub repository:
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Enable GitHub Pages:
   - Go to your repository on GitHub
   - Click on "Settings"
   - Navigate to "Pages" in the left sidebar
   - Under "Source", select "main" branch
   - Click "Save"

3. Your site will be available at:
   ```
   https://<your-username>.github.io/<repository-name>/
   ```

   Note: It may take a few minutes for the site to become available.

## File Structure

```
world-map-claude/
├── index.html          # Main HTML structure
├── style.css           # Styles and responsive design
├── app.js              # Application logic and D3.js visualization
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## How It Works

### Time Zone Data

The application uses simplified timezone polygons generated based on UTC offsets. Each timezone is approximately 15 degrees of longitude wide (360° / 24 hours), with adjustments for fractional offsets like India's UTC+5:30.

### Live Time Updates

Times are calculated in the browser using JavaScript's Date API:
1. Get current browser time
2. Convert to UTC
3. Add the timezone offset for each zone
4. Update displays every second

### Map Projection

The map uses D3's Natural Earth projection (`geoNaturalEarth1`), which provides a visually pleasing compromise between area and shape distortion, making it ideal for world maps.

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support (responsive design)

Requires JavaScript to be enabled.

## Customization

### Adding More Cities

Edit the `createTimezoneData()` method in `app.js` to add more cities to the timezone definitions:

```javascript
{ offset: -5, cities: ['New York', 'Toronto', 'Miami', 'YourCity'], names: ['America/New_York'] }
```

### Changing Map Colors

Modify the CSS classes in `style.css`:

```css
.country {
    fill: #e8e8e8;  /* Country fill color */
    stroke: #fff;   /* Border color */
}

.timezone:hover {
    fill: rgba(66, 133, 244, 0.3);  /* Highlight color */
}
```

### Adjusting Map Size

Change the width and height in the `TimeZoneMap` constructor in `app.js`:

```javascript
this.width = 1200;  // Adjust as needed
this.height = 600;  // Maintain aspect ratio
```

## Known Limitations

- **No DST Support**: The app does not handle Daylight Saving Time transitions. Times are calculated using current UTC offsets only. This means:
  - Timezones are grouped by their **current** UTC offset (e.g., EST and CDT might be grouped together when both are at UTC-5)
  - Time calculations may be incorrect for regions during DST transitions
  - Historical or future timezone offsets are not considered
- Complex timezone polygons: Uses Natural Earth data which may not reflect recent political boundary changes
- Some small island nations may not be clearly visible at the world-map scale

## Future Enhancements

- Add DST-aware timezone calculations
- Include more detailed timezone boundary data with country-specific adjustments
- Add search functionality to find specific cities or timezones
- Export feature for saving pinned timezones
- Dark mode toggle

## License

This project is open source and available for educational and personal use. Contact [Option Zero](https://optionzero.co) for commercial licensing.

## Credits

- Map data: [Natural Earth](https://www.naturalearthdata.com/)
- Visualization library: [D3.js](https://d3js.org/)
- TopoJSON: [TopoJSON](https://github.com/topojson/topojson)

## See also

https://xkcd.com/1335/
