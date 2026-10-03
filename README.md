# Suburb Address Count

A single-page browser app (`index.html`) that takes two zipped shapefiles and counts how many address points fall inside each suburb polygon.

- **Suburbs zip**: polygon shapefile, e.g. LINZ *NZ Suburbs and Localities* (SHP export)
- **Addresses zip**: point shapefile, e.g. LINZ *NZ Addresses* (SHP export)

Everything runs locally in a Web Worker: the zip is read with `File.slice` (only the needed entries are decompressed, Zip64 supported), the `.shp`/`.dbf` are parsed directly, and points are assigned with an even-odd ray cast backed by a grid index over suburbs and a strip index over each polygon's edges. About 2 million points join in a couple of seconds.

Output: per-suburb counts, an optional PRVD code per territorial authority (entered in the app, remembered in the browser, exported as a `PRVD` column), addresses outside every polygon, a coordinate-system check (`.prj` comparison), and CSV export.

Both layers must use the same coordinate system (LINZ defaults to NZGD2000 for both).
