import math

def generate_snake(north, south, west, east, spacing_m):
    lat_step = spacing_m / 111_320.0
    mid = (north + south) / 2
    lon_step = spacing_m / (111_320.0 * max(0.1, math.cos(math.radians(mid))))
    pts = []
    lat = south
    row = 0
    while lat <= north + 1e-9:
        lons = []
        lon = west
        while lon <= east + 1e-9:
            lons.append(lon)
            lon += lon_step
        if row % 2:
            lons.reverse()
        pts.extend((lat, x) for x in lons)
        lat += lat_step
        row += 1
    return pts
