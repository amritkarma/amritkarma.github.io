/**
 * Copyright (C) 2013 OSM Buildings, Jan Marsch
 * A leightweight JavaScript library for visualizing 3D building geometry on interactive maps.
 * @osmbuildings, http://osmbuildings.org
 */
//****** file: prefix.js ******

var OSMBuildings = (function() {

    'use strict';


//****** file: shortcuts.js ******

// object access shortcuts
var Int32Array = Int32Array || Array,
    Uint8Array = Uint8Array || Array,
    m = Math,
    exp = m.exp,
    log = m.log,
    sin = m.sin,
    cos = m.cos,
    tan = m.tan,
    atan = m.atan,
    min = m.min,
    max = m.max,
    ceil = m.ceil,
    floor = m.floor,
    doc = document;




//****** file: Color.js ******

var Color = (function() {

    function hsla2rgb(hsla) { // h belongs to [0, 360]; s,l,a belong to [0, 1]
        var r, g, b;

        if (hsla.s === 0) {
            r = g = b = hsla.l; // achromatic
        } else {
            var q = hsla.l < 0.5 ? hsla.l * (1+hsla.s) : hsla.l + hsla.s - hsla.l * hsla.s,
                p = 2 * hsla.l-q;
            hsla.h /= 360;
            r = hue2rgb(p, q, hsla.h + 1/3);
            g = hue2rgb(p, q, hsla.h);
            b = hue2rgb(p, q, hsla.h - 1/3);
        }
        return new Color(
            r * 255 <<0,
            g * 255 <<0,
            b * 255 <<0,
            hsla.a
        );
    }

    function hue2rgb(p, q, t) {
        if (t < 0) {
            t += 1;
        }
        if (t > 1) {
            t -= 1;
        }
        if (t < 1 / 6) {
            return p + (q-p) * 6 * t;
        }
        if (t < 1 / 2) {
            return q;
        }
        if (t < 2 / 3) {
            return p + (q-p) * (2/3 - t) * 6;
        }
        return p;
    }

    function Color(r, g, b, a) { // r,g,b belong to [0, 255]; a belongs to [0,1]
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = arguments.length < 4 ? 1 : a;
    }

    var proto = Color.prototype;

    proto.toString = function() {
//        if (this.a === 1) {
//            return '#' + ((1 << 24) + (this.r << 16) + (this.g << 8) + this.b).toString(16).slice(1, 7);
//        }
        return 'rgba(' + [this.r <<0, this.g <<0, this.b <<0, this.a.toFixed(2)].join(',') + ')';
    };

    proto.setLightness = function(l) {
        var hsla = Color.toHSLA(this);
        hsla.l *= l;
        hsla.l = Math.min(1, Math.max(0, hsla.l));
        return hsla2rgb(hsla);
    };

    proto.setAlpha = function(a) {
        return new Color(this.r, this.g, this.b, this.a * a);
    };

    /*
     * str can be in any of the following forms:
     * "#[00-ff][00-ff][00-ff]", "#[00-ff][00-ff][00-ff][00-ff]",
     * "rgb([0-255],[0-255],[0-255])", "rgba([0-255],[0-255],[0-255],[0-1])",
     * "hsl([0-360],[0-1],[0-1])", "hsla([0-360],[0-1],[0-1],[0-1])"
     */
    Color.parse = function(str) {
        var m;
        str += '';
        if (~str.indexOf('#') && (m = str.match(/^#?(\w{2})(\w{2})(\w{2})(\w{2})?$/))) {
            return new Color(
                parseInt(m[1], 16),
                parseInt(m[2], 16),
                parseInt(m[3], 16),
                m[4] ? parseInt(m[4], 16) / 255 : 1
            );
        }

        if ((m = str.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)(\D+([\d.]+))?\)/))) {
            return new Color(
                parseInt(m[1], 10),
                parseInt(m[2], 10),
                parseInt(m[3], 10),
                m[4] ? parseFloat(m[5]) : 1
            );
        }

        if ((m = str.match(/hsla?\(([\d.]+)\D+([\d.]+)\D+([\d.]+)(\D+([\d.]+))?\)/))) {
            return hsla2rgb({
                h: parseInt(m[1], 10),
                s: parseFloat(m[2]),
                l: parseFloat(m[3]),
                a: m[4] ? parseFloat(m[5]) : 1
            });
        }
    };

    Color.toHSLA = function(rgba) { // r,g,b belong to [0, 255]; a belongs to [0,1]
        var r = rgba.r/255,
            g = rgba.g/255,
            b = rgba.b/255,
            max = Math.max(r, g, b), min = Math.min(r, g, b),
            h, s, l = (max+min) / 2,
            d;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            d = max-min;
            s = l > 0.5 ? d / (2-max-min) : d / (max+min);
            switch (max) {
                case r: h = (g-b) / d + (g < b ? 6 : 0); break;
                case g: h = (b-r) / d + 2; break;
                case b: h = (r-g) / d + 4; break;
            }
            h /= 6;
        }

        return { h:h*360, s:s, l:l, a:rgba.a };
    };

    return Color;

}());


//****** file: SunPosition.js ******

// calculations are based on http://aa.quae.nl/en/reken/zonpositie.html
// code credits to Vladimir Agafonkin (@mourner)

var getSunPosition = (function() {

    var m = Math,
      PI = m.PI,
      sin = m.sin,
      cos = m.cos,
      tan = m.tan,
      asin = m.asin,
      atan = m.atan2;

    var rad = PI/180,
      dayMs = 1000*60*60*24,
      J1970 = 2440588,
      J2000 = 2451545,
      e = rad*23.4397; // obliquity of the Earth

    function toJulian(date) {
      return date.valueOf()/dayMs - 0.5+J1970;
    }
    function toDays(date) {
      return toJulian(date)-J2000;
    }
    function getRightAscension(l, b) {
      return atan(sin(l)*cos(e) - tan(b)*sin(e), cos(l));
    }
    function getDeclination(l, b) {
      return asin(sin(b)*cos(e) + cos(b)*sin(e)*sin(l));
    }
    function getAzimuth(H, phi, dec) {
      return atan(sin(H), cos(H)*sin(phi) - tan(dec)*cos(phi));
    }
    function getAltitude(H, phi, dec) {
      return asin(sin(phi)*sin(dec) + cos(phi)*cos(dec)*cos(H));
    }
    function getSiderealTime(d, lw) {
      return rad * (280.16 + 360.9856235*d) - lw;
    }
    function getSolarMeanAnomaly(d) {
      return rad * (357.5291 + 0.98560028*d);
    }
    function getEquationOfCenter(M) {
      return rad * (1.9148*sin(M) + 0.0200 * sin(2*M) + 0.0003 * sin(3*M));
    }
    function getEclipticLongitude(M, C) {
      var P = rad*102.9372; // perihelion of the Earth
      return M+C+P+PI;
    }

    return function getSunPosition(date, lat, lon) {
      var lw = rad*-lon,
        phi = rad*lat,
        d = toDays(date),
        M = getSolarMeanAnomaly(d),
        C = getEquationOfCenter(M),
        L = getEclipticLongitude(M, C),
        D = getDeclination(L, 0),
        A = getRightAscension(L, 0),
        t = getSiderealTime(d, lw),
        H = t-A;

      return {
        altitude: getAltitude(H, phi, D),
        azimuth: getAzimuth(H, phi, D) - PI/2 // origin: north
      };
    };

}());


//****** file: Import.js ******

var Import = (function() {

    var me = {};

    var _clockwise = 'CW', _counterClockwise = 'CCW';

    // detect winding direction: clockwise or counter clockwise
    function _getWinding(points) {
        var x1, y1, x2, y2,
            a = 0,
            i, il;
        for (i = 0, il = points.length-3; i < il; i += 2) {
            x1 = points[i];
            y1 = points[i+1];
            x2 = points[i+2];
            y2 = points[i+3];
            a += x1*y2 - x2*y1;
        }
        return (a/2) > 0 ? _clockwise : _counterClockwise;
    }

    // enforce a polygon winding direcetion. Needed for proper backface culling.
    function _makeWinding(points, direction) {
        var winding = _getWinding(points);
        if (winding === direction) {
            return points;
        }
        var revPoints = [];
        for (var i = points.length-2; i >= 0; i -= 2) {
            revPoints.push(points[i], points[i+1]);
        }
        return revPoints;
    }

    me.windOuterPolygon = function(points) {
        return _makeWinding(points, _clockwise);
    };

    me.windInnerPolygon = function(points) {
        return _makeWinding(points, _counterClockwise);
    };

    me.YARD_TO_METER = 0.9144;
    me.FOOT_TO_METER = 0.3048;
    me.INCH_TO_METER = 0.0254;
    me.METERS_PER_LEVEL = 3;

    me.getDimension = function(str) {
        var value = parseFloat(str);
        if (value === str) {
            return value <<0;
        }
        if (~str.indexOf('m')) {
            return value <<0;
        }
        if (~str.indexOf('yd')) {
            return value*me.YARD_TO_METER <<0;
        }
        if (~str.indexOf('ft')) {
            return value*me.FOOT_TO_METER <<0;
        }
        if (~str.indexOf('\'')) {
            var parts = str.split('\'');
            var res = parts[0]*me.FOOT_TO_METER + parts[1]*me.INCH_TO_METER;
            return res <<0;
        }
        return value <<0;
    };

    var _materialColors = {
        brick:'#cc7755',
        bronze:'#ffeecc',
        canvas:'#fff8f0',
        concrete:'#999999',
        copper:'#a0e0d0',
        glass:'#e8f8f8',
        gold:'#ffcc00',
        plants:'#009933',
        metal:'#aaaaaa',
        panel:'#fff8f0',
        plaster:'#999999',
        roof_tiles:'#f08060',
        silver:'#cccccc',
        slate:'#666666',
        stone:'#996666',
        tar_paper:'#333333',
        wood:'#deb887'
    };

    var _baseMaterials = {
        asphalt:'tar_paper',
        bitumen:'tar_paper',
        block:'stone',
        bricks:'brick',
        glas:'glass',
        glassfront:'glass',
        grass:'plants',
        masonry:'stone',
        granite:'stone',
        panels:'panel',
        paving_stones:'stone',
        plastered:'plaster',
        rooftiles:'roof_tiles',
        roofingfelt:'tar_paper',
        sandstone:'stone',
        sheet:'canvas',
        sheets:'canvas',
        shingle:'tar_paper',
        shingles:'tar_paper',
        slates:'slate',
        steel:'metal',
        tar:'tar_paper',
        tent:'canvas',
        thatch:'plants',
        tile:'roof_tiles',
        tiles:'roof_tiles'
    };

    // cardboard
    // eternit
    // limestone
    // straw

    me.getMaterialColor = function(str) {
        str = str.toLowerCase();
        if (str[0] === '#') {
            return str;
        }
        return _materialColors[_baseMaterials[str] || str] || null;
    };

    return me;

}());


//****** file: GeoJSON.js ******

var readGeoJSON = function(collection) {
    var i, il, j, jl, k, kl,
        res = [],
        feature,
        geometry, properties, coordinates,
        wallColor, roofColor,
        last,
        polygon, footprint, holes,
        lat = 1, lon = 0,
        item;

    for (i = 0, il = collection.length; i < il; i++) {
        feature = collection[i];
        if (feature.type !== 'Feature') {
            continue;
        }

        geometry = feature.geometry;
        properties = feature.properties;

        if (geometry.type === 'LineString') {
            last = coordinates.length-1;
            if (coordinates[0][0] === coordinates[last][0] && coordinates[0][1] === coordinates[last][1]) {
                coordinates = geometry.coordinates;
            }
        }

        if (geometry.type === 'Polygon') {
            coordinates = geometry.coordinates;
        }

        // just use the outer ring
        if (geometry.type === 'MultiPolygon') {
            coordinates = geometry.coordinates[0];
        }

        if (!coordinates) {
            continue;
        }

        if (properties.color || properties.wallColor) {
            wallColor = properties.color || properties.wallColor;
        }

        if (properties.roofColor) {
            roofColor = properties.roofColor;
        }

        polygon   = coordinates[0];
        footprint = [];
        for (j = 0, jl = polygon.length; j < jl; j++) {
            footprint.push(polygon[j][lat], polygon[j][lon]);
        }

        holes = [];
        for (j = 1, jl = coordinates.length; j < jl; j++) {
            polygon = coordinates[j];
            holes[j-1] = [];
            for (k = 0, kl = polygon.length; k < kl; k++) {
                holes[j-1].push(polygon[k][lat], polygon[k][lon]);

            }
            holes[j-1] = Import.windInnerPolygon(holes[j-1]);
        }

        // one item per coordinates ring (usually just one ring)
        item = {
            id:properties.id || (footprint[0] + ',' + footprint[1]),
            footprint:Import.windOuterPolygon(footprint)
        };

        if (properties.height)    item.height    = Import.getDimension(properties.height);
        if (properties.minHeight) item.minHeight = Import.getDimension(properties.minHeight);
        if (wallColor)            item.wallColor = wallColor;
        if (roofColor)            item.roofColor = roofColor;
        if (holes.length)         item.holes     = holes;
        res.push(item);
    }

    return res;
};


//****** file: OSMXAPI.js ******

var readOSMXAPI = (function() {

    function isBuilding(data) {
        var tags = data.tags;
        return (tags &&
            !tags.landuse &&
            (tags.building || tags['building:part']) &&
            (!tags.layer || tags.layer >= 0));
    }

//  living:'bricks',
//  nonliving:'tar_paper',
//  worship:'copper'

    function getBuildingType(tags) {
        if (tags.amenity === 'place_of_worship') {
            return 'worship';
        }

        var type = tags.building;
        if (type === 'yes' || type === 'roof') {
            type = tags['building:use'];
        }
        if (!type) {
            type = tags.amenity;
        }

        switch (type) {
            case 'apartments':
            case 'house':
            case 'residential':
            case 'hut':
                return 'living';
            case 'church':
                return 'worship';
        }

        return 'nonliving';
    }

    function getRelationWays(members) {
        var m, outer, inner = [];
        for (var i = 0, il = members.length; i < il; i++) {
            m = members[i];
            if (m.type !== 'way' || !ways[m.ref]) {
                continue;
            }
            if (!m.role || m.role === 'outer') {
                outer = ways[m.ref];
                continue;
            }
            if (m.role === 'inner' || m.role === 'enclave') {
                inner.push(ways[m.ref]);
                continue;
            }
        }
        if (!outer || !outer.tags) {
            return;
        }
        return { outer:outer, inner:inner };
    }

    function getFootprint(points) {
        if (!points) {
            return;
        }

        var footprint = [], p;
        for (var i = 0, il = points.length; i < il; i++) {
            p = nodes[ points[i] ];
            footprint.push(p[0], p[1]);
        }

        // do not close polygon yet
        if (footprint[footprint.length-2] !== footprint[0] && footprint[footprint.length-1] !== footprint[1]) {
            footprint.push(footprint[0], footprint[1]);
        }

        // can't span a polygon with just 2 points (+ start & end)
        if (footprint.length < 8) {
            return;
        }

        return footprint;
    }

    function mergeTags(dst, src) {
        for (var p in src) {
            if (!dst[p]) {
                dst[p] = src[p];
            }
        }
        return dst;
    }

    function filterTags(tags) {
        var height = 0, minHeight = 0;

        if (tags.height) {
            height = Import.getDimension(tags.height);
        }
        if (!height && tags['building:height']) {
            height = Import.getDimension(tags['building:height']);
        }

        if (!height && tags.levels) {
            height = tags.levels*Import.METERS_PER_LEVEL <<0;
        }
        if (!height && tags['building:levels']) {
            height = tags['building:levels']*Import.METERS_PER_LEVEL <<0;
        }

        // min_height
        if (tags.min_height) {
            minHeight = Import.getDimension(tags.min_height);
        }
        if (!minHeight && tags['building:min_height']) {
            minHeight = Import.getDimension(tags['building:min_height']);
        }

        if (!minHeight && tags.min_level) {
            minHeight = tags.min_level*Import.METERS_PER_LEVEL <<0;
        }
        if (!minHeight && tags['building:min_level']) {
            minHeight = tags['building:min_level']*Import.METERS_PER_LEVEL <<0;
        }

        var wallColor, roofColor;

        // wall material
        if (tags['building:material']) {
            wallColor = Import.getMaterialColor(tags['building:material']);
        }
        if (tags['building:facade:material']) {
            wallColor = Import.getMaterialColor(tags['building:facade:material']);
        }
        if (tags['building:cladding']) {
            wallColor = Import.getMaterialColor(tags['building:cladding']);
        }
        // wall color
        if (tags['building:color']) {
            wallColor = tags['building:color'];
        }
        if (tags['building:colour']) {
            wallColor = tags['building:colour'];
        }

        // roof material
        if (tags['roof:material']) {
            roofColor = Import.getMaterialColor(tags['roof:material']);
        }
        if (tags['building:roof:material']) {
            roofColor = Import.getMaterialColor(tags['building:roof:material']);
        }
        // roof color
        if (tags['roof:color']) {
            roofColor = tags['roof:color'];
        }
        if (tags['roof:colour']) {
            roofColor = tags['roof:colour'];
        }
        if (tags['building:roof:color']) {
            roofColor = tags['building:roof:color'];
        }
        if (tags['building:roof:colour']) {
            roofColor = tags['building:roof:colour'];
        }

        return {
            height:    height,
            minHeight: minHeight,
            wallColor: wallColor,
            roofColor: roofColor
        };
    }

    function processNode(node) {
        nodes[node.id] = [node.lat, node.lon];
    }

    function processWay(way) {
        var tags, footprint;
        if (isBuilding(way)) {
            tags = filterTags(way.tags);
            if ((footprint = getFootprint(way.nodes))) {
                addResult(way.id, tags, footprint);
            }
        } else {
            tags = way.tags;
            if (!tags || (!tags.highway && !tags.railway && !tags.landuse)) { // TODO: add more filters
                ways[way.id] = way;
            }
        }
    }

    function processRelation(relation) {
        var relationWays, outerWay, holes = [],
            tags, outerFootprint, innerFootprint;
        if (isBuilding(relation) && (relation.tags.type === 'multipolygon' || relation.tags.type === 'building')) {
            if ((relationWays = getRelationWays(relation.members))) {
                var relTags = filterTags(relation.tags);
                if ((outerWay = relationWays.outer)) {
                    tags = filterTags(outerWay.tags);
                    if ((outerFootprint = getFootprint(outerWay.nodes))) {
                        tags = mergeTags(tags, relTags);
                        for (var i = 0, il = relationWays.inner.length; i < il; i++) {
                            if ((innerFootprint = getFootprint(relationWays.inner[i].nodes))) {
                                holes.push(Import.windInnerPolygon(innerFootprint));
                            }
                        }
                        addResult(outerWay.id, tags, outerFootprint, holes.length ? holes : null);
                    }
                }
            }
        }
    }

    function addResult(id, tags, footprint, holes) {
        var item = { id:id, footprint:Import.windOuterPolygon(footprint), holes:holes };
        if (tags.height)    item.height    = tags.height;
        if (tags.minHeight) item.minHeight = tags.minHeight;
        if (tags.wallColor) item.wallColor = tags.wallColor;
        if (tags.roofColor) item.roofColor = tags.roofColor;
        if (holes)          item.holes     = holes;
        res.push(item);
    }

    var nodes, ways, res;

    return function(data) {
        nodes = {};
        ways = {};
        res = [];

        var item;
        for (var i = 0, il = data.length; i < il; i++) {
            item = data[i];
            switch(item.type ) {
                case 'node':     processNode(item);     break;
                case 'way':      processWay(item);      break;
                case 'relation': processRelation(item); break;
            }
        }

        return res;
    };
})();


//****** file: constants.js ******

// constants, shared to all instances
var VERSION      = '0.1.8a',
    ATTRIBUTION  = '&copy; <a href="http://osmbuildings.org">OSM Buildings</a>',
    OSM_XAPI_URL = 'http://overpass-api.de/api/interpreter?data=[out:json];(way[%22building%22]({s},{w},{n},{e});node(w);way[%22building:part%22=%22yes%22]({s},{w},{n},{e});node(w);relation[%22building%22]({s},{w},{n},{e});way(r);node(w););out;',
//  OSM_XAPI_URL = 'http://overpass.osm.rambler.ru/cgi/interpreter?data=[out:json];(way[%22building%22]({s},{w},{n},{e});node(w);way[%22building:part%22=%22yes%22]({s},{w},{n},{e});node(w);relation[%22building%22]({s},{w},{n},{e});way(r);node(w););out;',

    PI         = Math.PI,
    HALF_PI    = PI/2,
    QUARTER_PI = PI/4,
    RAD        = 180/PI,

    MAP_TILE_SIZE  = 256,    // map tile size in pixels
    DATA_TILE_SIZE = 0.0075, // data tile size in geo coordinates, smaller: less data to load but more requests

    MIN_ZOOM = 15,

    LAT = 'latitude', LON = 'longitude',

    DEFAULT_HEIGHT = 5,
    HEIGHT_SCALE = 1;


//****** file: geometry.js ******

function getDistance(p1, p2) {
    var dx = p1[0]-p2[0],
        dy = p1[1]-p2[1];
    return dx*dx + dy*dy;
}

function crop(num) {
    return (num*10000 << 0) / 10000;
}

function getCenter(points) {
    var len, x = 0, y = 0;
    for (var i = 0, il = points.length-3; i < il; i += 2) {
        x += points[i];
        y += points[i+1];
    }
    len = (points.length-2) / 2;
    return [x/len <<0, y/len <<0];
}

function getSquareSegmentDistance(px, py, p1x, p1y, p2x, p2y) {
    var dx = p2x-p1x,
        dy = p2y-p1y,
        t;
    if (dx !== 0 || dy !== 0) {
        t = ((px-p1x) * dx + (py-p1y) * dy) / (dx*dx + dy*dy);
        if (t > 1) {
            p1x = p2x;
            p1y = p2y;
        } else if (t > 0) {
            p1x += dx*t;
            p1y += dy*t;
        }
    }
    dx = px-p1x;
    dy = py-p1y;
    return dx*dx + dy*dy;
}

function simplify(points) {
    var sqTolerance = 2,
        len = points.length/2,
        markers = new Uint8Array(len),

        first = 0,
        last  = len - 1,

        i,
        maxSqDist,
        sqDist,
        index,

        firstStack = [],
        lastStack  = [],

        newPoints  = [];

    markers[first] = markers[last] = 1;

    while (last) {
        maxSqDist = 0;

        for (i = first + 1; i < last; i++) {
            sqDist = getSquareSegmentDistance(
                points[i    *2], points[i    *2 + 1],
                points[first*2], points[first*2 + 1],
                points[last *2], points[last *2 + 1]
            );
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (maxSqDist > sqTolerance) {
            markers[index] = 1;

            firstStack.push(first);
            lastStack.push(index);

            firstStack.push(index);
            lastStack.push(last);
        }

        first = firstStack.pop();
        last = lastStack.pop();
    }

    for (i = 0; i < len; i++) {
        if (markers[i]) {
            newPoints.push(points[i*2], points[i*2 + 1]);
        }
    }

    return newPoints;
}


//****** file: variables.js ******

// private variables, specific to an instance
var width = 0, height = 0,
    halfWidth = 0, halfHeight = 0,
    originX = 0, originY = 0,
    zoom, size,

    activeRequest,

    context,

    defaultWallColor = new Color(200, 190, 180),
    defaultAltColor  = defaultWallColor.setLightness(0.8),
    defaultRoofColor = defaultWallColor.setLightness(1.2),

    wallColorAlpha = defaultWallColor + '',
    altColorAlpha  = defaultAltColor + '',
    roofColorAlpha = defaultRoofColor + '',

    fadeFactor = 1,
    animTimer,
    zoomAlpha = 1,

    minZoom = MIN_ZOOM,
    maxZoom = 20,
    maxHeight,

    camX, camY, camZ = 450,

    isZooming;


//****** file: functions.js ******

function pixelToGeo(x, y) {
    var res = {};
    x /= size;
    y /= size;
    res[LAT] = y <= 0  ? 90 : y >= 1 ? -90 : RAD * (2 * atan(exp(PI * (1 - 2*y))) - HALF_PI),
    res[LON] = (x === 1 ?  1 : (x%1 + 1) % 1) * 360 - 180;
    return res;
}

function geoToPixel(lat, lon) {
    var latitude  = min(1, max(0, 0.5 - (log(tan(QUARTER_PI + HALF_PI * lat / 180)) / PI) / 2)),
        longitude = lon/360 + 0.5;
    return {
        x: longitude*size <<0,
        y: latitude *size <<0
    };
}

function fromRange(sVal, sMin, sMax, dMin, dMax) {
    sVal = min(max(sVal, sMin), sMax);
    var rel = (sVal-sMin) / (sMax-sMin),
        range = dMax-dMin;
    return min(max(dMin + rel*range, dMin), dMax);
}

function xhr(_url, param, callback) {
    var url = _url.replace(/\{ *([\w_]+) *\}/g, function(tag, key) {
        return param[key] || tag;
    });

    var req = 'XDomainRequest' in window ? new XDomainRequest() : new XMLHttpRequest();

    function changeState(state) {
        if ('XDomainRequest' in window && state !== req.readyState) {
            req.readyState = state;
            if (req.onreadystatechange) {
                req.onreadystatechange();
            }
        }
    }

    req.onerror = function() {
        req.status = 500;
        req.statusText = 'Error';
        changeState(4);
    };

    req.ontimeout = function() {
        req.status = 408;
        req.statusText = 'Timeout';
        changeState(4);
    };

    req.onprogress = function() {
        changeState(3);
    };

    req.onload = function() {
        req.status = 200;
        req.statusText = 'Ok';
        changeState(4);
    };

    req.onreadystatechange = function() {
        if (req.readyState !== 4) {
            return;
        }
        if (!req.status || req.status < 200 || req.status > 299) {
            return;
        }
        if (callback && req.responseText) {
            callback(JSON.parse(req.responseText));
        }
    };

    changeState(0);
    req.open('GET', url);
    changeState(1);
    req.send(null);
    changeState(2);

    return req;
}


//****** file: Cache.js ******

var Cache = (function() {

    var _time = new Date(),
        _static = '__STATIC__',
        _data = {};

    var me = {};

    me.add = function(data, key) {
        key = key || _static;
        _data[key] = { data:data, time:Date.now() };
    };

    me.get = function(key) {
        key = key || _static;
        return _data[key] && _data[key].data;
    };

    me.purge = function() {
        _time.setMinutes(_time.getMinutes()-5);
        for (var key in _data) {
            if (_data[key].time < _time && key !== _static) {
                delete _data[key];
            }
        }
    };

    return me;

}());


//****** file: Data.js ******

var Data = (function() {

    var _url,
        _isStatic = true,
        _index = {}; // maintain a list of cached items in order to fade in new ones

    function _getSimpleFootprint(polygon) {
        var footprint = new Int32Array(polygon.length),
            px;
        for (var i = 0, il = polygon.length-1; i < il; i+=2) {
            px = geoToPixel(polygon[i], polygon[i+1]);
            footprint[i]   = px.x;
            footprint[i+1] = px.y;
        }
        footprint = simplify(footprint);
        if (footprint.length < 8) { // 3 points + end==start (*2)
            return;
        }
        return footprint;
    }

    function _closureForParse(cacheKey) {
        return function(res) {
            _parse(res, cacheKey);
        };
    }

    function _parse(data, cacheKey) {
        if (!data) {
            return;
        }

        var items;
        if (data.type === 'FeatureCollection') { // GeoJSON
            items = readGeoJSON(data.features);
        } else if (data.osm3s) { // XAPI
            items = readOSMXAPI(data.elements);
        }

        Cache.add(items, cacheKey);
        _addRenderItems(items, true);
    }

    function _addRenderItems(data, isNew) {
        var scaledItems = _scale(data, zoom, isNew),
            item;
        for (var i = 0, il = scaledItems.length; i < il; i++) {
            item = scaledItems[i];
            if (!_index[item.id]) {
                item.scale = isNew ? 0 : 1;
                renderItems.push(item);
                _index[item.id] = 1;
            }
        }
        fadeIn();
    }

    function _scale(items, zoom) {
        var i, il, j, jl,
            res = [],
            item,
            height, minHeight, footprint,
            color, wallColor, altColor, roofColor,
            holes, innerFootprint,
            zoomDelta = maxZoom-zoom;

        for (i = 0, il = items.length; i < il; i++) {

            item = items[i];

            height = (item.height || DEFAULT_HEIGHT)*HEIGHT_SCALE >> zoomDelta;
            if (!height) {
                continue;
            }

            minHeight = item.minHeight*HEIGHT_SCALE >> zoomDelta;
            if (minHeight > maxHeight) {
                continue;
            }

            if (!(footprint = _getSimpleFootprint(item.footprint))) {
                continue;
            }

            holes = [];
            if (item.holes) {
                for (j = 0, jl = item.holes.length; j < jl; j++) {
                    if ((innerFootprint = _getSimpleFootprint(item.holes[j]))) {
                        holes.push(innerFootprint);
                    }
                }
            }

            wallColor = null;
            altColor  = null;
            if (item.wallColor) {
                if ((color = Color.parse(item.wallColor))) {
                    wallColor = color.setAlpha(zoomAlpha);
                    altColor  = '' + wallColor.setLightness(0.8);
                    wallColor = '' + wallColor;
                }
            }

            roofColor = null;
            if (item.roofColor) {
                if ((color = Color.parse(item.roofColor))) {
                    roofColor = '' + color.setAlpha(zoomAlpha);
                }
            }

            res.push({
                id:        item.id,
                footprint: footprint,
                height:    min(height, maxHeight),
                minHeight: minHeight,
                wallColor: wallColor,
                altColor:  altColor,
                roofColor: roofColor,
                center:    getCenter(footprint),
                holes:     holes.length ? holes : null
            });
        }

        return res;
    }

    var me = {};

    me.load = function(url) {
        _url = url || OSM_XAPI_URL;
        _isStatic = !/(.+\{[nesw]\}){4,}/.test(_url);
        if (_isStatic) {
            Cache.add(null);
            xhr(_url, {}, _parse);
        }
        me.update();
    };

    me.update = function() {
        if (zoom < MIN_ZOOM) {
            return;
        }

        renderItems = [];
        _index = {};

        var lat, lon,
            cached, key;

        if (_isStatic) {
            if ((cached = Cache.get(key))) {
                _addRenderItems(cached);
            }
            return;
        }

        var nw = pixelToGeo(originX,       originY),
            se = pixelToGeo(originX+width, originY+height),
            sizeLat = DATA_TILE_SIZE,
            sizeLon = DATA_TILE_SIZE*2;

        var bounds = {
            n: ceil( nw.latitude /sizeLat) * sizeLat,
            e: ceil( se.longitude/sizeLon) * sizeLon,
            s: floor(se.latitude /sizeLat) * sizeLat,
            w: floor(nw.longitude/sizeLon) * sizeLon
        };

        for (lat = bounds.s; lat <= bounds.n; lat += sizeLat) {
            for (lon = bounds.w; lon <= bounds.e; lon += sizeLon) {
                key = lat + ',' + lon;
                if ((cached = Cache.get(key))) {
                    _addRenderItems(cached);
                } else {
                    xhr(_url, {
                        n: crop(lat+sizeLat),
                        e: crop(lon+sizeLon),
                        s: crop(lat),
                        w: crop(lon)
                    }, _closureForParse(key));
                }
            }
        }

        Cache.purge();
    };

    me.set = function(data) {
        _isStatic = true;
        renderItems = [];
        _index = {};
        _parse(data);
    };

    return me;

}());


//****** file: render.js ******

var renderItems = [];

function fadeIn() {
    if (animTimer) {
        return;
    }

    animTimer = setInterval(function() {
        var item, needed = false;
        for (var i = 0, il = renderItems.length; i < il; i++) {
            item = renderItems[i];
            if (item.scale < 1) {
                item.scale += 0.5*0.2; // amount*easing
                if (item.scale > 1) {
                    item.scale = 1;
                }
                needed = true;
            }
        }

        renderAll();

        if (!needed) {
            clearInterval(animTimer);
            animTimer = null;
        }
    }, 33);
}

function renderAll() {
    Shadows.render();
    FlatBuildings.render();
    render();
}

function render() {
    context.clearRect(0, 0, width, height);

    // show on high zoom levels only and avoid rendering during zoom
    if (zoom < minZoom || isZooming) {
        return;
    }

    var i, il, j, jl,
        item,
        h, _h, mh, _mh,
        flatMaxHeight = FlatBuildings.MAX_HEIGHT,
        sortCam = [camX+originX, camY+originY],
        vp = {
            minX: originX,
            maxX: originX+width,
            minY: originY,
            maxY: originY+height
        },
        footprint, roof, holes,
        isVisible,
        wallColor, altColor;

    // TODO: FlatBuildings are drawn separately, data has to be split
    renderItems.sort(function(a, b) {
        return getDistance(b.center, sortCam)/b.height - getDistance(a.center, sortCam)/a.height;
    });

    for (i = 0, il = renderItems.length; i < il; i++) {
        item = renderItems[i];

        if (item.height <= flatMaxHeight) {
            continue;
        }

        isVisible = false;
        footprint = item.footprint;
        for (j = 0, jl = footprint.length - 1; j < jl; j += 2) {
            // checking footprint is sufficient for visibility
            // TODO: pre-filter by data tile position
            if (!isVisible) {
                isVisible = (footprint[j] > vp.minX && footprint[j] < vp.maxX && footprint[j+1] > vp.minY && footprint[j+1] < vp.maxY);
            }
        }

        if (!isVisible) {
            continue;
        }

        // when fading in, use a dynamic height
        h = item.scale < 1 ? item.height*item.scale : item.height;
        // precalculating projection height factor
        _h = camZ / (camZ-h);

        _mh = 0;
        if (item.minHeight) {
            mh = item.scale < 1 ? item.minHeight*item.scale : item.minHeight;
            _mh = camZ / (camZ-mh);
        }

        wallColor = item.wallColor || wallColorAlpha;
        altColor  = item.altColor  || altColorAlpha;

        roof = renderPolygon(footprint, _h, _mh, wallColor, altColor);

        holes = [];
        if (item.holes) {
            for (j = 0, jl = item.holes.length; j < jl; j++) {
                holes[j] = renderPolygon(item.holes[j], _h, _mh, wallColor, altColor);
            }
        }

        // fill roof and optionally stroke it
        context.fillStyle   = item.roofColor || roofColorAlpha;
        context.strokeStyle = altColor;
        drawShape(roof, true, holes);
    }
}

function renderPolygon(polygon, h, mh, wallColor, altColor) {
    var a = { x:0, y:0 }, b = { x:0, y:0 },
        _a, _b,
        roof = [];
    for (var i = 0, il = polygon.length-3; i < il; i += 2) {
        a.x = polygon[i]  -originX;
        a.y = polygon[i+1]-originY;
        b.x = polygon[i+2]-originX;
        b.y = polygon[i+3]-originY;

        // project 3d to 2d on extruded footprint
        _a = project(a.x, a.y, h);
        _b = project(b.x, b.y, h);

        if (mh) {
            a = project(a.x, a.y, mh);
            b = project(b.x, b.y, mh);
        }

        // backface culling check
        if ((b.x-a.x) * (_a.y-a.y) > (_a.x-a.x) * (b.y-a.y)) {
            // depending on direction, set wall shading
            if ((a.x < b.x && a.y < b.y) || (a.x > b.x && a.y > b.y)) {
                context.fillStyle = altColor;
            } else {
                context.fillStyle = wallColor;
            }
            drawShape([
                b.x, b.y,
                a.x, a.y,
                _a.x, _a.y,
                _b.x, _b.y
            ]);
        }
        roof[i]   = _a.x;
        roof[i+1] = _a.y;
    }

    return roof;
}

function drawShape(points, stroke, holes) {
    if (!points.length) {
        return;
    }

    var i, il, j, jl;

    context.beginPath();

    context.moveTo(points[0], points[1]);
    for (i = 2, il = points.length; i < il; i += 2) {
        context.lineTo(points[i], points[i+1]);
    }

    if (holes) {
        for (i = 0, il = holes.length; i < il; i++) {
            points = holes[i];
            context.moveTo(points[0], points[1]);
            for (j = 2, jl = points.length; j < jl; j += 2) {
                context.lineTo(points[j], points[j+1]);
            }
        }
    }

    context.closePath();
    if (stroke) {
        context.stroke();
    }
    context.fill();
}

function project(x, y, m) {
    return {
        x: (x-camX) * m + camX <<0,
        y: (y-camY) * m + camY <<0
    };
}

/*
function debugMarker(x, y, color, size) {
    context.fillStyle = color || '#ffcc00';
    context.beginPath();
    context.arc(x, y, size || 3, 0, PI*2, true);
    context.closePath();
    context.fill();
}

function debugLine(ax, ay, bx, by, color) {
    context.strokeStyle = color || '#ff0000';
    context.beginPath();
    context.moveTo(ax, ay);
    context.lineTo(bx, by);
    context.closePath();
    context.stroke();
}
*/


//****** file: Shadows.js ******

var Shadows = (function() {

    var _context;
    var _enabled = true;
    var _color = new Color(0, 0, 0);
    var _date = null;
    var _direction = { x:0, y:0 };

    function _project(x, y, h) {
        return {
            x: x + _direction.x*h,
            y: y + _direction.y*h
        };
    }

    var me = {};

    me.setContext = function(context) {
        _context = context;
        // TODO: fix bad Date() syntax
        me.setDate(new Date().setHours(10)); // => render()
    };

    me.enable = function(flag) {
        _enabled = !!flag;
        // should call me.render() but it is usually set by setStyle() and there a renderAll() is called
    };

    me.render = function() {
        var center, sun, length, alpha, colorStr;

        _context.clearRect(0, 0, width, height);

        // show on high zoom levels only and avoid rendering during zoom
        if (!_enabled || zoom < minZoom || isZooming) {
            return;
        }

        // TODO: at some point, calculate me just on demand
        center = pixelToGeo(originX+halfWidth, originY+halfHeight);
        sun = getSunPosition(_date, center.latitude, center.longitude);

        if (sun.altitude <= 0) {
            return;
        }

        length = 1 / tan(sun.altitude);
        alpha = 0.4 / length;
        _direction.x = cos(sun.azimuth) * length;
        _direction.y = sin(sun.azimuth) * length;

        // TODO: maybe introduce Color.setAlpha()
        _color.a = alpha;
        colorStr = _color + '';

        var i, il, j, jl,
            item,
            f, h, g,
            x, y,
            footprint,
            mode,
            isVisible,
            ax, ay, bx, by,
            a, b, _a, _b,
            points,
            allFootprints = [];

        _context.beginPath();

        for (i = 0, il = renderItems.length; i < il; i++) {
            item = renderItems[i];

// TODO: no shadows when buildings are too flat => don't add them to renderItems then
//        if (item.height <= FlatBuildings.MAX_HEIGHT) {
//            continue;
//        }

            isVisible = false;
            f = item.footprint;
            footprint = [];
            for (j = 0, jl = f.length - 1; j < jl; j += 2) {
                footprint[j]   = x = f[j]  -originX;
                footprint[j+1] = y = f[j+1]-originY;

                // TODO: checking footprint is sufficient for visibility - NOT VALID FOR SHADOWS!
                if (!isVisible) {
                    isVisible = (x > 0 && x < width && y > 0 && y < height);
                }
            }

            if (!isVisible) {
                continue;
            }

            // when fading in, use a dynamic height
            h = item.scale < 1 ? item.height*item.scale : item.height;

            // prepare same calculations for min_height if applicable
            if (item.minHeight) {
                g = item.scale < 1 ? item.minHeight*item.scale : item.minHeight;
            }

            mode = null;

            for (j = 0, jl = footprint.length-3; j < jl; j += 2) {
                ax = footprint[j];
                ay = footprint[j+1];
                bx = footprint[j+2];
                by = footprint[j+3];

                _a = _project(ax, ay, h);
                _b = _project(bx, by, h);

                if (item.minHeight) {
                    a = _project(ax, ay, g);
                    b = _project(bx, by, g);
                    ax = a.x;
                    ay = a.y;
                    bx = b.x;
                    by = b.y;
                }

                // mode 0: floor edges, mode 1: roof edges
                if ((bx-ax) * (_a.y-ay) > (_a.x-ax) * (by-ay)) {
                    if (mode === 1) {
                        _context.lineTo(ax, ay);
                    }
                    mode = 0;
                    if (!j) {
                        _context.moveTo(ax, ay);
                    }
                    _context.lineTo(bx, by);
                } else {
                    if (mode === 0) {
                        _context.lineTo(_a.x, _a.y);
                    }
                    mode = 1;
                    if (!j) {
                        _context.moveTo(_a.x, _a.y);
                    }
                    _context.lineTo(_b.x, _b.y);
                }
            }

            _context.closePath();

            allFootprints.push(footprint);
        }

        _context.fillStyle = colorStr;
        _context.fill();

        // now draw all the footprints as negative clipping mask
        _context.globalCompositeOperation = 'destination-out';
        _context.beginPath();
        for (i = 0, il = allFootprints.length; i < il; i++) {
            points = allFootprints[i];
            _context.moveTo(points[0], points[1]);
            for (j = 2, jl = points.length; j < jl; j += 2) {
                _context.lineTo(points[j], points[j+1]);
            }
            _context.lineTo(points[0], points[1]);
            _context.closePath();
        }
        _context.fillStyle = '#00ff00';
        _context.fill();
        _context.globalCompositeOperation = 'source-over';
    };

    me.setDate = function(date) {
        _date = date;
        me.render();
    };

    return me;

}());


//****** file: FlatBuildings.js ******

var FlatBuildings = (function() {

    var _context;

    var me = {};

    me.MAX_HEIGHT = 8;

    me.setContext = function(context) {
        _context = context;
    };

    me.render = function() {
        _context.clearRect(0, 0, width, height);

        // show on high zoom levels only and avoid rendering during zoom
        if (zoom < minZoom || isZooming) {
            return;
        }

        var i, il, j, jl,
            item,
            f,
            x, y,
            footprint,
            isVisible,
            ax, ay;

        _context.beginPath();

        for (i = 0, il = renderItems.length; i < il; i++) {
            item = renderItems[i];

            if (item.height > me.MAX_HEIGHT) {
                continue;
            }

            isVisible = false;
            f = item.footprint;
            footprint = [];
            for (j = 0, jl = f.length-1; j < jl; j += 2) {
                footprint[j]   = x = f[j]  -originX;
                footprint[j+1] = y = f[j+1]-originY;

                // checking footprint is sufficient for visibility
                if (!isVisible) {
                    isVisible = (x > 0 && x < width && y > 0 && y < height);
                }
            }

            if (!isVisible) {
                continue;
            }

            for (j = 0, jl = footprint.length-3; j < jl; j += 2) {
                ax = footprint[j];
                ay = footprint[j + 1];
                if (!j) {
                    _context.moveTo(ax, ay);
                } else {
                    _context.lineTo(ax, ay);
                }
            }

            _context.closePath();
        }

        _context.fillStyle   = roofColorAlpha;
        _context.strokeStyle = altColorAlpha;

        _context.stroke();
        _context.fill();
    };

    return me;

}());


//****** file: Layers.js ******

var Layers = (function() {

    function _createItem() {
        var canvas = doc.createElement('CANVAS');
        canvas.style.webkitTransform = 'translate3d(0,0,0)'; // turn on hw acceleration
        canvas.style.imageRendering  = 'optimizeSpeed';
        canvas.style.position = 'absolute';
        canvas.style.left = 0;
        canvas.style.top  = 0;

        var context = canvas.getContext('2d');
        context.lineCap   = 'round';
        context.lineJoin  = 'round';
        context.lineWidth = 1;

        context.mozImageSmoothingEnabled    = false;
        context.webkitImageSmoothingEnabled = false;

        _items.push(canvas);
        _container.appendChild(canvas);

        return context;
    }

    var _container = doc.createElement('DIV');
    _container.style.pointerEvents = 'none';
    _container.style.position = 'absolute';
    _container.style.left = 0;
    _container.style.top  = 0;

    var _items = [];

    // TODO: improve this to _createItem(Layer) => layer.setContext(context)
    Shadows.setContext(      _createItem());
    FlatBuildings.setContext(_createItem());
    context = _createItem(); // default (global) render context

    var me = {};

    me.appendTo = function(parentNode) {
        parentNode.appendChild(_container);
    };

    me.remove = function() {
        _container.parentNode.removeChild(_container);
    };

    me.setSize = function(w, h) {
        for (var i = 0, il = _items.length; i < il; i++) {
            _items[i].width  = w;
            _items[i].height = h;
        }
    };

    // usually called after move: container jumps by move delta, cam is reset
    me.setPosition = function(x, y) {
        _container.style.left = x + 'px';
        _container.style.top  = y + 'px';
    };

    return me;

}());


//****** file: properties.js ******

function setOrigin(origin) {
    originX = origin.x;
    originY = origin.y;
}

function setCamOffset(offset) {
    camX = halfWidth + offset.x;
    camY = height    + offset.y;
}

function setSize(size) {
    width  = size.w;
    height = size.h;
    halfWidth  = width /2 <<0;
    halfHeight = height/2 <<0;
    camX = halfWidth;
    camY = height;
    Layers.setSize(width, height);
    maxHeight = camZ-50;
}

function setZoom(z) {
    zoom = z;
    size = MAP_TILE_SIZE <<zoom;

    zoomAlpha = 1 - fromRange(zoom, minZoom, maxZoom, 0, 0.3);

    wallColorAlpha = defaultWallColor.setAlpha(zoomAlpha) + '';
    altColorAlpha  = defaultAltColor.setAlpha( zoomAlpha) + '';
    roofColorAlpha = defaultRoofColor.setAlpha(zoomAlpha) + '';
}

function setStyle(style) {
    style = style || {};
    if (style.color || style.wallColor) {
        defaultWallColor = Color.parse(style.color || style.wallColor);
        wallColorAlpha = defaultWallColor.setAlpha(zoomAlpha) + '';

        defaultAltColor = defaultWallColor.setLightness(0.8);
        altColorAlpha = defaultAltColor.setAlpha(zoomAlpha) + '';

        defaultRoofColor = defaultWallColor.setLightness(1.2);
        roofColorAlpha = defaultRoofColor.setAlpha(zoomAlpha) + '';
    }

    if (style.roofColor) {
        defaultRoofColor = Color.parse(style.roofColor);
        roofColorAlpha = defaultRoofColor.setAlpha(zoomAlpha) + '';
    }

    if (style.shadows !== undefined) {
        Shadows.enable(style.shadows);
    }

    renderAll();
}


//****** file: events.js ******

function onResize(e) {
    setSize(e.width, e.height);
    renderAll();
    Data.update();
}

function onMoveEnd(e) {
    renderAll();
    Data.update(); // => fadeIn() => renderAll()
}

function onZoomStart() {
    isZooming = true;
    // effectively clears because of isZooming flag
    // TODO: introduce explicit clear()
    renderAll();
}

function onZoomEnd(e) {
    isZooming = false;
    setZoom(e.zoom);
    Data.update(); // => fadeIn()
    renderAll();
}


//****** file: OpenLayers.js ******

// based on a pull request from Jérémy Judéaux (https://github.com/Volune)

var parent = OpenLayers.Layer.prototype;

var osmb = function(map) {
    this.offset = { x:0, y:0 }; // cumulative cam offset during moveBy

    parent.initialize.call(this, this.name, { projection:'EPSG:900913' });
	map.addLayer(this);
};

var proto = osmb.prototype = new OpenLayers.Layer();

proto.name          = 'OSM Buildings';
proto.attribution   = ATTRIBUTION;
proto.isBaseLayer   = false;
proto.alwaysInRange = true;

proto.setOrigin = function() {
    var map = this.map,
        origin = map.getLonLatFromPixel(new OpenLayers.Pixel(0, 0)),
        res = map.resolution,
        ext = this.maxExtent,
        x = (origin.lon - ext.left) / res <<0,
        y = (ext.top - origin.lat)  / res <<0;
    setOrigin({ x:x, y:y });
};

proto.setMap = function(map) {
    if (!this.map) {
        parent.setMap.call(this, map);
    }
    Layers.appendTo(this.div);
    maxZoom = map.baseLayer.numZoomLevels;
    setSize(map.size);
    setZoom(map.zoom);
    this.setOrigin();

    Data.update();
    renderAll();
};

proto.removeMap = function(map) {
    Layers.remove();
    parent.removeMap.call(this, map);
    this.map = null;
};

proto.onMapResize = function() {
    var map = this.map;
    parent.onMapResize.call(this);
    onResize({ width:map.size.w, height:map.size.h });
};

proto.moveTo = function(bounds, zoomChanged, isDragging) {
    var map = this.map,
        res = parent.moveTo.call(this, bounds, zoomChanged, isDragging);

    if (!isDragging) {
        var offsetLeft = parseInt(map.layerContainerDiv.style.left, 10),
            offsetTop  = parseInt(map.layerContainerDiv.style.top,  10);

        this.div.style.left = -offsetLeft + 'px';
        this.div.style.top  = -offsetTop  + 'px';
    }

    this.setOrigin();
    this.offset.x = 0;
    this.offset.y = 0;
    setCamOffset(this.offset);

    if (zoomChanged) {
        onZoomEnd({ zoom:map.zoom });
    } else {
        onMoveEnd();
    }

    return res;
};

proto.moveByPx = function(dx, dy) {
    this.offset.x += dx;
    this.offset.y += dy;
    var res = parent.moveByPx.call(this, dx, dy);
    setCamOffset(this.offset);
    render();
    return res;
};


//****** file: suffix.js ******

proto.setStyle = function(style) {
    setStyle(style);
    return this;
};

proto.setDate = function(date) {
    Shadows.setDate(date);
    return this;
};

proto.loadData = function(url) {
    Data.load(url);
    return this;
};

proto.setData = function(data) {
    Data.set(data);
    return this;
};

osmb.VERSION     = VERSION;
osmb.ATTRIBUTION = ATTRIBUTION;

return osmb;

}());

