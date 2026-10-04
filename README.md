# Suburb Address Count

A single-page browser app (`index.html`) that takes zipped shapefiles and counts how many address points fall inside each suburb polygon.

- **Suburbs**: polygon shapefile(s), e.g. LINZ *NZ Suburbs and Localities* (SHP export)
- **Addresses**: point shapefile(s), e.g. LINZ *NZ Addresses* (SHP export)

Inputs are additive. Add one zip holding `nz-addresses/` and `nz-suburbs-and-localities/` folders, the two LINZ zips separately, or several zips (for example regional extracts), in one go or a few at a time. Every polygon layer found is combined into the suburb list and every point layer is counted against it. Layers are assumed not to overlap, so nothing is de-duplicated.

Everything runs locally in a Web Worker: the zip is read with `File.slice` (only the needed entries are decompressed, Zip64 supported), the `.shp`/`.dbf` are parsed directly, and points are assigned with an even-odd ray cast backed by a grid index over suburbs and a strip index over each polygon's edges. About 2 million points join in a couple of seconds.

Output: per-suburb counts, addresses outside every polygon, a coordinate-system check (`.prj` comparison), and CSV export with columns `M_SUBURB`, `TYPE`, `M_TERRITORY`, `M_SUBURB_HH_COUNT`.

Both layers must use the same coordinate system (LINZ defaults to NZGD2000 for both).
