#!/bin/bash

# Download timezone data from Natural Earth
# This is a simpler, cartography-focused dataset perfect for world maps

echo "Downloading Natural Earth timezone data..."
echo ""

# Natural Earth time zones (simplified for cartography)
URL="https://naciscdn.org/naturalearth/10m/cultural/ne_10m_time_zones.zip"

echo "Fetching from: $URL"
echo ""

# Download the zip file
curl -L -o ne_timezones.zip "$URL"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Download complete!"
    echo "Extracting..."

    # Extract the zip file
    unzip -o ne_timezones.zip -d ne_timezones/

    # Convert shapefile to GeoJSON using ogr2ogr (if available)
    if command -v ogr2ogr &> /dev/null; then
        echo "Converting to GeoJSON..."
        ogr2ogr -f GeoJSON timezones-natural-earth.geojson ne_timezones/ne_10m_time_zones.shp
        echo "✓ Converted to GeoJSON"
    else
        echo ""
        echo "Note: ogr2ogr not found. You'll need to convert the shapefile manually."
        echo "Install GDAL: sudo apt-get install gdal-bin (or brew install gdal on Mac)"
        echo "Or use an online converter: https://mygeodata.cloud/converter/shp-to-geojson"
    fi

    echo ""
    echo "Files extracted to: ne_timezones/"
    echo ""
else
    echo ""
    echo "❌ Download failed"
    echo ""
    echo "Manual download instructions:"
    echo "1. Visit: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/"
    echo "2. Download 'Time Zones'"
    echo "3. Extract the ZIP file"
    echo "4. Convert .shp to .geojson using ogr2ogr or online tool"
fi
