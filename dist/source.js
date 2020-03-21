// Start of some namespacing stuff since we're vanilla JS
window.sourcecode = window.sourcecode || {}
var locations = window.locationData;
var sourcecode = window.sourcecode;

var markers = [];
var serviceCircles = [];
var markerCluster = null;

sourcecode.markers = markers;
sourcecode.serviceCircles = serviceCircles;
sourcecode.markerCluster = markerCluster;
// End of Namespacing 

// Filter markers by service type
sourcecode.filterVisibility = function (filter) {
    markers.forEach(function (marker) {

        if (filter) {
            // If filtering only set the markers that match to true
            var services = marker.title.split(',')
            var visiblity = services.indexOf(filter) !== -1
            marker.setVisible(visiblity);
        } else {
            // If no filter set to true
            marker.setVisible(true);
        }


    })

    markerCluster.repaint ? markerCluster.repaint() : null
}

sourcecode.initMap = function () {
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 3,
        center: { lat: -28.024, lng: 140.887 },
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        clickableIcons: false,
        mapTypeControl: false

    });

    var infoWindows = Object.values(locations)
        .map(function (location) {
            var contentString = '<div id="content">' +
                '<div id="siteNotice">' +
                '</div>' +
                '<h1 id="firstHeading" class="firstHeading">' + location.contentTitle + '</h1>' +
                '<div id="bodyContent">' +
                location.contentBody +
                '</div>' +
                '<div>' +
                '<hr>' +
                '<p>Email: <a href="mailto:' + location.contact.email + '">' + location.contact.email + '</a></p>' +
                '<p>Phone: <a href="tel:' + location.contact.number + '">' + location.contact.number + '</a></p>' +
                '<div>' +
                '</div>';

            return new google.maps.InfoWindow({
                content: contentString
            })
        })

    markers = Object.values(locations)
        .map(function (location, i) {
            var marker = new google.maps.Marker({
                position: location,
                label: location.label,
                title: location.types.join(',')
            });

            marker.addListener('click', function () {
                infoWindows[i].open(map, marker);
            });


            marker.addListener('title_changed', function () {
                if (!marker.getVisible()) {
                    return;
                }

                var color;
                var services = marker.title.split(',')
                if (services.indexOf('mobility') !== -1) {
                    color = '#4285F4'
                } else if (services.indexOf('food') !== -1) {
                    color = '#DB4437'
                } else if (services.indexOf('supplies') !== -1) {
                    color = '#0F9D58'
                } else {
                    color = '#F4B400'
                }

                // Only push this if Radius is less than current radius
                // TODO: Write the above code
                serviceCircles.push(new google.maps.Circle({
                    strokeColor: color,
                    strokeOpacity: 0.3,
                    strokeWeight: 1,
                    fillColor: color,
                    fillOpacity: 0.15,
                    map: map,
                    center: marker.position,
                    radius: locations[marker.getLabel()].serviceRadius
                }));
                // Issue: Product is too dark at zoom levels
                // Solution: Else use this to create a border color change on the map
                // Increase the stroke logrithmically to a max
                // TODO: Write the above
            });

            return marker;
        });

    // Add a marker clusterer to manage the markers.
    markerCluster = new MarkerClusterer(map, markers, {
        imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
        ignoreHidden: true,
        averageCenter: true,
        gridSize: 30
    });

    markerCluster.addListener('clusteringbegin', function (mc) {
        serviceCircles.forEach(function (circle) {
            // Check this first since not everything we out in here is a useful (aka may include nulls due to previous business logic)
            if (circle.setMap) {
                circle.setMap(null);
            }
        })

        // Clear it to save space (even as an array of nulls)
        serviceCircles = [];
    })

    markerCluster.addListener('clusteringend', function (mc) {
        var visibleMarkers = [];
        mc.getClusters().forEach(function (cluster) {
            if (cluster.getSize() === 1) {
                var singleMarker = cluster.getMarkers()[0]
                singleMarker.setTitle(singleMarker.getTitle()) // Trigger Radius Drawing
                visibleMarkers.push(singleMarker);
            } else {
                var maxMarkerRadius = 0;
                var maxMarker;
                cluster.getMarkers().forEach(function (singleMarker) {
                    // Update maxMarker to higher value if found.
                    var newPotentialMaxMarkerRadius = Math.max(maxMarkerRadius, locations[singleMarker.label].serviceRadius);
                    maxMarker = newPotentialMaxMarkerRadius > maxMarkerRadius ? singleMarker : maxMarker
                    visibleMarkers.push(singleMarker); // Register it so we can clear or manipulate it later
                })
                if (maxMarker) {
                    maxMarker.setTitle(maxMarker.getTitle()) // Trigger Radius Drawing on max radius marker for the cluster
                }
            }
        });
        var newListContent = ''
        visibleMarkers.forEach(function (marker) {
            var location = locations[marker.getLabel()]
            newListContent +=
                '<a href="#" class="list-group-item list-group-item-action flex-column align-items-start">' +
                '<div class="d-flex w-100 justify-content-between">' +
                '<h5 class="mb-1">' + location.contentTitle + '</h5>' +
                '<small class="text-muted">' + location.types.join(', ') + '</small>' +
                '</div >' +
                '<p class="mb-1">' + location.contentBody + '</p>' +
                '</a >'
        })

        if (!newListContent) {
            newListContent = '<a href="#" class="list-group-item list-group-item-action flex-column align-items-start">' +
                '<div class="d-flex w-100 justify-content-between">' +
                '<h5 class="mb-1">No Locations Found</h5>' +
                '</div >' +
                '<p class="mb-1">Try looking at a different area of the map</p>' +
                '</a >'
        }
        var listDiv = $("#visible-markers").html(newListContent);
    })
}

sourcecode.initMap();