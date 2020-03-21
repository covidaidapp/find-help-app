// Start of some namespacing stuff since we're vanilla JS
window.sourcecode = window.sourcecode || {}
var locations = window.locationData;
var sourcecode = window.sourcecode;

var markers = [];
var serviceCircles = [];
var markerCluster = null;
var visibleMarkers = [];
var infoWindow = null;
var activeMarker = null;

sourcecode.markers = markers;
sourcecode.serviceCircles = serviceCircles;
sourcecode.markerCluster = markerCluster;
sourcecode.visibleMarkers = visibleMarkers;
sourcecode.infoWindow = infoWindow;
// End of Namespacing 

sourcecode.clearActiveMarker = function () {
    // Clear an attached bubble
    if (infoWindow && infoWindow.setPosition) {
        infoWindow.setPosition()
    }
    activeMarker = null
}

// Filter markers by service type
sourcecode.filterVisibility = function (filter) {
    var activeMarkerStillMatchesQuery
    markers.forEach(function (marker) {
        if (filter) {
            // If filtering only set the markers that match to true
            var services = marker.title.split(',') // We hijack the title attribute of the marker to track it's services
            var visiblity = services.indexOf(filter) !== -1
            marker.setVisible(visiblity);

            if (activeMarker && activeMarker.getLabel && marker.getLabel() == activeMarker.getLabel()) {
                activeMarkerStillMatchesQuery = true;
            }
        } else {
            // If no filter set to true
            marker.setVisible(true);
            activeMarkerStillMatchesQuery = true;
        }
    })

    // Redraw all markers -- this will trigger the "clusterstart" and "clusterend" events so we can redraw all our extras as well
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

    // We iterate over all locations to create markers
    // This pretty much orchestrates everything since the map is the main interaction window
    markers = Object.values(locations)
        .map(function (location, i) {
            var marker = new google.maps.Marker({
                position: location,
                label: location.label,
                title: location.types.join(',')
            });

            marker.addListener('click', function () {
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

                // Reuse the info window or not
                if (infoWindow && infoWindow.setContent) {
                    infoWindow.open(map, marker);
                    infoWindow.setContent(contentString)
                } else {
                    infoWindow = new google.maps.InfoWindow({
                        content: contentString
                    })
                    infoWindow.open(map, marker);
                }
            });

            // The Marker Cluster app doesn't have events for when it renders a single marker without a cluster.
            // We want to piggyback on an existing event so that we can render a circle of influence
            // when the marker cluster lib tells us it's singled out a marker.
            marker.addListener('title_changed', function () {

                // Save some processing juice here by skipping on hidden markers (based on a filter users select for service types)
                if (!marker.getVisible()) {
                    return;
                }

                var color;
                var services = marker.title.split(',')
                if (services.indexOf('mobility') !== -1) {
                    color = '#742388'
                } else if (services.indexOf('medicine') !== -1) {
                    color = '#4285F4'
                } else if (services.indexOf('food') !== -1) {
                    color = '#DB4437'
                } else if (services.indexOf('supplies') !== -1) {
                    color = '#0F9D58'
                } else {
                    color = '#F4B400'
                }

                // Issue: Product is too dark at zoom levels
                // Solution: If + Else: Use this to create a border color change on the map itself vs rendering the radius to map.
                // Only push this if the radius is less than the diagonal distance on the map screen.
                // If it covers the whole map we don't want to render the circle as too many circles make the map unreadable.
                // Additional UX Improvement -- Increase the stroke logrithmically to a max stroke so users are nudged slightly that we are no longer
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

    // Set up event listeners to tell us when the map has started refreshing.
    markerCluster.addListener('clusteringbegin', function (mc) {
        $("#visible-markers").html('<h2>Loading List View ... </h2>');

        serviceCircles.forEach(function (circle) {
            // Check this first since not everything we put into serviceCircles is a valid circle object, some may be null
            if (circle.setMap) {
                circle.setMap(null);
            }
        })
    })

    // The clusters have been computed so we can 
    markerCluster.addListener('clusteringend', function (newClusterParent) {
        visibleMarkers = [];
        serviceCircles = [];

        newClusterParent.getClusters().forEach(function (cluster) {
            var maxMarkerRadius = 0;
            var maxMarker;

            // Figure out which marker in each cluster will generate a circle.
            cluster.getMarkers().forEach(function (singleMarker) {
                // Update maxMarker to higher value if found.
                var newPotentialMaxMarkerRadius = Math.max(maxMarkerRadius, locations[singleMarker.label].serviceRadius);
                maxMarker = newPotentialMaxMarkerRadius > maxMarkerRadius ? singleMarker : maxMarker
                visibleMarkers.push(singleMarker); // Register it so we can clear or manipulate it later
            })

            // Draw a circle for the marker with the largest radius for each cluster (even clusters with 1 marker)
            if (maxMarker) {
                maxMarker.setTitle(maxMarker.getTitle()) // Trigger Radius Drawing on max radius marker for the cluster
            }
        });

        // Prepare HTML content for side list view
        var newListContent = ''
        // Rebuild list using currently visible markers
        visibleMarkers.forEach(function (marker) {
            var location = locations[marker.getLabel()]
            newListContent +=
                '<a onclick="window.sourcecode.activateMarker(' + marker.getLabel() + ');" class="list-group-item list-group-item-action flex-column align-items-start">' +
                '<div class="d-flex w-100 justify-content-between">' +
                '<h5 class="mb-1">' + location.contentTitle + '</h5>' +
                '<small class="text-muted">' + location.types.join(', ') + '</small>' +
                '</div >' +
                '<p class="mb-1">' + location.contentBody + '</p>' +
                '</a >'
        })

        // In case there aren't any visible markers show a friendly message
        if (!newListContent) {
            newListContent = '<a href="#" class="list-group-item list-group-item-action flex-column align-items-start">' +
                '<div class="d-flex w-100 justify-content-between">' +
                '<h5 class="mb-1">No Locations Found</h5>' +
                '</div >' +
                '<p class="mb-1">Try looking at a different area of the map</p>' +
                '</a >'
        }

        // Refresh the HTML element on the right scroll view
        $("#visible-markers").html(newListContent);
    })
}

// Handle click events in the right scroll view by triggering the info window for the map view
sourcecode.activateMarker = function (markerLabel) {
    var foundMarker;

    visibleMarkers.forEach(function (marker) {
        // using only == here (vs. ===) because one is an int and the other is a string so we want auto type resolution
        if (marker.getLabel() == markerLabel) {
            foundMarker = marker;
            return;
        }
    });

    // Force a click event on the marker to trigger the info bubble using the map 
    // view to control rendering beacuse it's less error prone to API changes with low maintenance.
    new google.maps.event.trigger(foundMarker, 'click');
}
