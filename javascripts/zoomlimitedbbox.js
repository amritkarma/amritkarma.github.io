function setStatusText(text){
            var html_node = document.getElementById("statusline");
            if (html_node != null){
              var div = html_node.firstChild;
              div.deleteData(0, div.nodeValue.length);
              div.appendData(text);
            }
          }

ZoomLimitedBBOXStrategy = OpenLayers.Class(OpenLayers.Strategy.BBOX, {

zoom_data_limit: 13,

initialize: function(zoom_data_limit) {
    this.zoom_data_limit = zoom_data_limit;
},

update: function(options) {
this.ratio = this.layer.ratio;
    var mapBounds = this.getMapBounds();
    if (this.layer && this.layer.map && this.layer.map.getZoom() < this.zoom_data_limit) {
        setStatusText("Please zoom in to view data.");
        zoom_valid = false;

        this.bounds = null;
    }
    else if (mapBounds !== null && ((options && options.force) ||
                               this.invalidBounds(mapBounds))) {
        // ++load_counter;
        setStatusText("Loading data ...");
        zoom_valid = true;

        this.calculateBounds(mapBounds);
        this.resolution = this.layer.map.getResolution();
        this.triggerRead(options);
    }
},

CLASS_NAME: "ZoomLimitedBBOXStrategy"
});