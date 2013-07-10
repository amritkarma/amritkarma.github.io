OSM 3D buildings

osmbuildings.org: 
(http://osmbuildings.org/documentation/api.php)
	advantages:
		integrates with openlayers and leaflet https://www.github.com/kekscom/osmbuildings
		reads GeoJSON
	searching for way to convert overpass json format to GeoJSON
		possible solutions: setup own osm server and configure the output format
		accepted solution:
			overpass ide converts data into geojson client side (look at the code)
				osmbuildings requires either z-coordinate or height property, overpass-ide does not give these. need to configure them.
				progress: openlayers can make ajax calls to overpass and store them as features.
					used layer addedfeature event to make geojson for osmbuilding. 
				todo: convert those features to be used by 3dbuildings.
					need to overwrite write function() to append height property to geojson


			offline process:
				use overpass ide to select data
				export from overpass in geojson format
				open that file in quantumgis
				make it editable layer(convert to shapefile)
				add height column in attribute table and derive building height from building_l(originally building:level) field
				save it as geojson file
				open the file in text editor, copy it's contents and paste it in main html page( temrorary solution as reading from file is creating errors)
				assign an object to the pasted json string
				display it using osm3dbuilding
