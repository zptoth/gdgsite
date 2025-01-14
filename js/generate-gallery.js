'use strict';

var justified_layout = require('justified-layout');
var default_layout_options = {
  containerWidth: 960,
  containerPadding: 0,
  boxSpacing: 6,
  targetRowHeight: 240
};

var gallery_parameters = {
  gallery: 0,
  width: 0,
  sizes: [],
  has_shown: false
};


/*
Example gallery item:

<figure itemprop="associatedMedia" itemscope itemtype="http://schema.org/ImageObject">
  <a href="large-image.jpg" itemprop="contentUrl" data-size="600x400">
    <img src="small-image.jpg" itemprop="thumbnail" alt="Image description" />
  </a>
  <figcaption itemprop="caption description">Image caption</figcaption>
</figure>

 */

var generate_gallery = function(gallery, sizes) {  
  // set the container width parameter
  var layout_options = default_layout_options;
  layout_options.containerWidth = gallery.clientWidth;
  //console.log(layout_options)
  var geometry = justified_layout(sizes, layout_options);
  gallery.style.height = geometry.containerHeight + "px";
  //console.log(geometry);
  // now check for a scrollbar shrinking our width
  if (gallery.clientWidth !== layout_options.containerWidth) {
    layout_options.containerWidth = gallery.clientWidth;
    geometry = justified_layout(sizes, layout_options);
    gallery.style.height = geometry.containerHeight + "px";
  }
  //console.log(layout_options)

  // console.log(geometry);
  var boxes = geometry.boxes;
  //console.log(boxes);

  var gallery_children = gallery.children;
  for (var i = 0; i < gallery_children.length; i++) {
    var transform = "translate(" + boxes[i].left + "px, " + boxes[i].top + "px)"
    gallery_children[i].style.transform = transform;
    gallery_children[i].style.width = boxes[i].width + "px";
    gallery_children[i].style.height = boxes[i].height + "px";
  }

  gallery_parameters.gallery = gallery;
  gallery_parameters.sizes = sizes;
  gallery_parameters.has_shown = true;
  gallery_parameters.width = gallery.clientWidth;
};


window.onresize = function(event) {
  if (
    gallery_parameters.has_shown && 
    gallery_parameters.gallery.clientWidth !== gallery_parameters.width
  ) {
    //console.log("resize! " + gallery_parameters.gallery.clientWidth);
    generate_gallery(gallery_parameters.gallery, gallery_parameters.sizes);
  }
};


var initPhotoSwipeFromDOM = function(gallerySelector) {

    // parse slide data (url, title, size ...) from DOM elements 
    // (children of gallerySelector)
    var parseThumbnailElements = function(el) {
        var thumbElements = el.childNodes,
            numNodes = thumbElements.length,
            items = [],
            figureEl,
            linkEl,
            size,
            item;

        for(var i = 0; i < numNodes; i++) {

            figureEl = thumbElements[i]; // <figure> element

            // include only element nodes 
            if(figureEl.nodeType !== 1) {
                continue;
            }

            linkEl = figureEl.children[0]; // <a> element

            size = linkEl.getAttribute('data-size').split('x');

            // create slide object
            item = {
                src: linkEl.getAttribute('href'),
                w: parseInt(size[0], 10),
                h: parseInt(size[1], 10)
            };

            item.pid = item.src.split('/').pop().split('.')[0];

            if(figureEl.children.length > 1) {
                // <figcaption> content
                item.title = figureEl.children[1].innerHTML; 
            }

            if(linkEl.children.length > 0) {
                // <img> thumbnail element, retrieving thumbnail url
                item.msrc = linkEl.children[0].getAttribute('src');
            } 

            item.el = figureEl; // save link to element for getThumbBoundsFn
            items.push(item);
        }

        return items;
    };

    // find nearest parent element
    var closest = function closest(el, fn) {
        return el && ( fn(el) ? el : closest(el.parentNode, fn) );
    };

    // triggers when user clicks on thumbnail
    var onThumbnailsClick = function(e) {
        e = e || window.event;
        e.preventDefault ? e.preventDefault() : e.returnValue = false;

        var eTarget = e.target || e.srcElement;

        // find root element of slide
        var clickedListItem = closest(eTarget, function(el) {
            return (el.tagName && el.tagName.toUpperCase() === 'FIGURE');
        });

        if(!clickedListItem) {
            return;
        }

        // find index of clicked item by looping through all child nodes
        // alternatively, you may define index via data- attribute
        var clickedGallery = clickedListItem.parentNode,
            childNodes = clickedListItem.parentNode.childNodes,
            numChildNodes = childNodes.length,
            nodeIndex = 0,
            index;

        for (var i = 0; i < numChildNodes; i++) {
            if(childNodes[i].nodeType !== 1) { 
                continue; 
            }

            if(childNodes[i] === clickedListItem) {
                index = nodeIndex;
                break;
            }
            nodeIndex++;
        }



        if(index >= 0) {
            // open PhotoSwipe if valid index found
            openPhotoSwipe( index, clickedGallery );
        }
        return false;
    };

    // parse picture index and gallery index from URL (#&pid=1&gid=2)
    var photoswipeParseHash = function() {
        var hash = window.location.hash.substring(1),
        params = {};

        if(hash.length < 5) {
            return params;
        }

        var vars = hash.split('&');
        for (var i = 0; i < vars.length; i++) {
            if(!vars[i]) {
                continue;
            }
            var pair = vars[i].split('=');  
            if(pair.length < 2) {
                continue;
            }           
            params[pair[0]] = pair[1];
        }

        /*if(params.gid) {
            params.gid = parseInt(params.gid, 10);
        }*/

        return params;
    };

    var openPhotoSwipe = function(index, galleryElement, disableAnimation, fromURL) {
        var pswpElement = document.querySelectorAll('.pswp')[0],
            gallery,
            options,
            items;

        items = parseThumbnailElements(galleryElement);

        // define options (if needed)
        options = {

            // define gallery index (for URL)
            galleryUID: galleryElement.getAttribute('data-pswp-uid'),

            galleryPIDs: true,

            getThumbBoundsFn: function(index) {
                // See Options -> getThumbBoundsFn section of documentation for more info
                var thumbnail = items[index].el.getElementsByTagName('img')[0], // find thumbnail
                    pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
                    rect = thumbnail.getBoundingClientRect(); 

                return {x:rect.left, y:rect.top + pageYScroll, w:rect.width};
            }

        };

        // PhotoSwipe opened from URL
        if(fromURL) {
            if(options.galleryPIDs) {
                // parse real index when custom PIDs are used 
                // http://photoswipe.com/documentation/faq.html#custom-pid-in-url
                for(var j = 0; j < items.length; j++) {
                    if(items[j].pid == index) {
                        options.index = j;
                        break;
                    }
                }
            } else {
                // in URL indexes start from 1
                options.index = parseInt(index, 10) - 1;
            }
        } else {
            options.index = parseInt(index, 10);
        }

        // exit if index not found
        if( isNaN(options.index) ) {
            return;
        }

        if(disableAnimation) {
            options.showAnimationDuration = 0;
        }

        options.clickToCloseNonZoomable = false;

        options.shareButtons = [
            {id:'facebook', label:'Megosztás Facebook-on', url:'https://www.facebook.com/sharer/sharer.php?u={{url}}'},
            {id:'twitter', label:'Tweet', url:'https://twitter.com/intent/tweet?text={{text}}&url={{url}}'},
            {id:'pinterest', label:'Pinteres Pin', url:'http://www.pinterest.com/pin/create/button/?url={{url}}&media={{image_url}}&description={{text}}'},
            {id:'download', label:'Kép letöltése', url:'{{raw_image_url}}', download:true}
        ];


        // Pass data to PhotoSwipe and initialize it
        gallery = new PhotoSwipe( pswpElement, PhotoSwipeUI_Default, items, options);
        gallery.init();
    };

    // loop through all gallery elements and bind events
    var galleryElements = document.querySelectorAll( gallerySelector );

    for(var i = 0, l = galleryElements.length; i < l; i++) {
        galleryElements[i].setAttribute('data-pswp-uid', i+1);
        galleryElements[i].onclick = onThumbnailsClick;
    }

    // Parse URL and open gallery if it contains #&pid=3&gid=1
    var hashData = photoswipeParseHash();
    if(hashData.pid) {
        openPhotoSwipe( hashData.pid ,  galleryElements[0], true, true );
    }
};