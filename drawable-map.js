class DrawableMap {
    constructor(container) {
        this.drawingManager = null;
        this.allOverlays = [];
        this.selectedShape = null;
        this.colors = ['#1E90FF', '#FF1493', '#32CD32', '#FF8C00', '#4B0082'];
        this.selectedColor = null;
        this.colorButtons = {};
        this.currentLocationMarker = new google.maps.Marker();
        this.map = null;
        this.container = container;
    }
    clearSelection() {
        if (this.selectedShape) {
            this.selectedShape.setEditable(false);
            this.selectedShape = null;
        }
    }
    setSelection(shape) {
        this.clearSelection();
        this.selectedShape = shape;
        this.selectedShape.setEditable(true);
        this.selectColor(this.selectedShape.get('fillColor') || this.selectedShape.get('strokeColor'));
    }
    deleteSelectedShape() {
        if (this.selectedShape) {
            this.selectedShape.setMap(null);
        }
        this.allOverlays.splice(
            this.allOverlays.indexOf(this.selectedShape),
            1
        );
    }
    deleteAllShapes() {
        for (var i = 0; i < this.allOverlays.length; i++) {
            this.allOverlays[i].setMap(null);
        }
        this.allOverlays = [];
    }
    selectColor(color) {
        this.selectedColor = color;
        for (var i = 0; i < this.colors.length; ++i) {
            var currColor = this.colors[i];
            this.colorButtons[currColor].style.border = currColor == color ? '2px solid #789' : '2px solid #fff';
        }

        // Retrieves the current options from the drawing manager and replaces the
        // stroke or fill color as appropriate.

        var polygonOptions = this.drawingManager.get('polygonOptions');
        polygonOptions.fillColor = color;
        this.drawingManager.set('polygonOptions', polygonOptions);
    }
    setSelectedShapeColor(color) {
        if (this.selectedShape) {
            if (this.selectedShape.type == google.maps.drawing.OverlayType.POLYLINE) {
                this.selectedShape.set('strokeColor', color);
            } else {
                this.selectedShape.set('fillColor', color);
            }
        }
    }
    makeColorButton(color) {
        var button = document.createElement('span');
        button.className = 'color-button';
        button.style.backgroundColor = color;
        let drawableMap = this;
        google.maps.event.addDomListener(button, 'click', function () {
            drawableMap.selectColor(color);
            drawableMap.setSelectedShapeColor(color);
        });

        return button;
    }
    buildColorPalette() {
        var colorPalette = this.container.getElementsByClassName('color-palette')[0];
        for (var i = 0; i < this.colors.length; ++i) {
            var currColor = this.colors[i];
            var colorButton = this.makeColorButton(currColor);
            colorPalette.appendChild(colorButton);
            this.colorButtons[currColor] = colorButton;
        }
        this.selectColor(this.colors[0]);
    }
    getAllShapes() {
        let shapes = [];
        for (let overlay of this.allOverlays) {
            if (overlay.type == "polygon") {
                let coordinates = [];
                overlay.getPath().getArray().forEach(
                    function (el) {
                        coordinates.push(
                            {
                                lat: el.lat(), lng: el.lng()
                            }
                        );
                    }
                )
                shapes.push({
                    type: "polygon",
                    paths: coordinates,
                    fillColor: overlay.fillColor,
                });
            } else {
                shapes.push({
                    type: "marker",
                    position: {
                        lat: overlay.position.lat(),
                        lng: overlay.position.lng()
                    },
                });
            }
        }
        return shapes;
    }
    setShapes(shapes) {
        for (let shape of shapes) {
            let widget = null;
            if (shape.type == "polygon") {
                widget = new google.maps.Polygon(shape);
            } else if (shape.type == "marker") {
                widget = new google.maps.Marker(shape);
            }
            widget.setMap(this.map);
            drawableMap.allOverlays.push(widget);
            google.maps.event.addListener(widget, 'click', function () {
                drawableMap.setSelection(widget);
            });
        }
    }
    updateCurrentLocation(center, locationUpdateCount) {
        if (locationUpdateCount == 0) {
            this.map.setCenter(center);
            this.map.setZoom(14);
            this.currentLocationMarker.setMap(this.map);
            this.currentLocationMarker.setTitle("You");
            this.currentLocationMarker.setIcon("https://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_blue.png");
        }
        this.currentLocationMarker.setPosition(center);
    }

    static initialize(container) {
        var drawableMap = new DrawableMap(container);
        container.classList.add("drawable-map");
        container.innerHTML = `<div class="map-container">
            <div class="google-map""></div>
        </div>
        <div class="panel">
            <div class="color-palette"></div>
            <div>
                <button class="delete-button">Delete Selected Shape</button>
                <button class="delete-all-button">Delete All Shapes</button>
            </div>
            <div>
                Search
                <input type="search" class="map-search">
            </div>
        </div>`;

        drawableMap.map = new google.maps.Map(container.getElementsByClassName("google-map")[0], {
            zoom: 2,
            center: { lng: 0, lat: 0 },
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            disableDefaultUI: true,
            zoomControl: true
        });

        var polyOptions = {
            editable: true
        };
        // Creates a drawing manager attached to the map that allows the user to draw
        // markers, lines, and shapes.
        drawableMap.drawingManager = new google.maps.drawing.DrawingManager({
            drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [
                    google.maps.drawing.OverlayType.MARKER,
                    google.maps.drawing.OverlayType.POLYGON,
                ],
            },
            markerOptions: {
                draggable: true
            },
            polygonOptions: polyOptions,
            map: drawableMap.map
        });
        google.maps.event.addListener(drawableMap.drawingManager, 'overlaycomplete', function (e) {
            drawableMap.allOverlays.push(e.overlay);
            if (e.type != google.maps.drawing.OverlayType.MARKER) {
                // Switch back to non-drawing mode after drawing a shape.
                drawableMap.drawingManager.setDrawingMode(null);

                // Add an event listener that selects the newly-drawn shape when the user
                // mouses down on it.
                var newShape = e.overlay;
                newShape.type = e.type;
                google.maps.event.addListener(newShape, 'click', function () {
                    drawableMap.setSelection(newShape);
                });
                drawableMap.setSelection(newShape);
            }
        });

        // Clear the current selection when the drawing mode is changed, or when the
        // map is clicked.
        google.maps.event.addListener(drawableMap.drawingManager, 'drawingmode_changed', function () {
            drawableMap.clearSelection();
        });
        google.maps.event.addListener(drawableMap.map, 'click', function () {
            drawableMap.clearSelection();
        });
        google.maps.event.addDomListener(container.getElementsByClassName('delete-button')[0], 'click', function () {
            drawableMap.deleteSelectedShape();
        });
        google.maps.event.addDomListener(container.getElementsByClassName('delete-all-button')[0], 'click', function () {
            drawableMap.deleteAllShapes();
        });

        drawableMap.buildColorPalette();

        let input = container.getElementsByClassName("map-search")[0];
        let options = {
            fields: ["address_components", "geometry", "icon", "name"],
            strictBounds: false,
            types: ["establishment"],
        };
        let searchBox = new google.maps.places.SearchBox(input, options);

        google.maps.event.addListener(searchBox, 'places_changed', function () {
            searchBox.set('map', null);
            var places = searchBox.getPlaces();
            var bounds = new google.maps.LatLngBounds();
            var i, place;
            for (i = 0; place = places[i]; i++) {
                var marker = new google.maps.Marker({
                    position: place.geometry.location
                });
                marker.bindTo('map', searchBox, 'map');
                google.maps.event.addListener(marker, 'map_changed', function () {
                    if (!this.getMap()) {
                        this.unbindAll();
                    }
                });
                bounds.extend(place.geometry.location);
            }
            drawableMap.map.fitBounds(bounds);
            searchBox.set('map', drawableMap.map);
            drawableMap.map.setZoom(Math.min(drawableMap.map.getZoom(), 15));
        });
        return drawableMap;
    }
}